import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../../../db/db';
import { athletes, playerProfiles } from '../../../db/schema';
import { ensureCanonicalPortalUser } from '../../../lib/portal-ownership';
import { rejectCrossOriginRequest } from '../../../lib/request-security';
import { portalPlayerLifecycleSchema } from '../../../lib/schemas';

type LifecycleResult = {
  success: boolean;
  status: number;
  error?: string;
};

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const originError = rejectCrossOriginRequest(request);
    if (originError) return originError;

    const session = await getSession(request);
    if (!session) return json({ error: 'Unauthorized' }, 401);

    const portalUser = await ensureCanonicalPortalUser(session.user);
    if (!portalUser) return json({ error: 'Unauthorized' }, 401);

    const validation = portalPlayerLifecycleSchema.safeParse(await request.json());
    if (!validation.success) {
      return json({
        error: validation.error.issues[0]?.message || 'Invalid player action',
      }, 400);
    }

    const now = new Date().toISOString();
    const result = await db.transaction<LifecycleResult>(async (tx) => {
      if (validation.data.action === 'merge') {
        const { sourceProfileId, targetProfileId } = validation.data;
        if (sourceProfileId === targetProfileId) {
          return { success: false, status: 400, error: 'Choose a different player to keep.' };
        }

        const profiles = await tx.select({
          id: playerProfiles.id,
        })
          .from(playerProfiles)
          .where(and(
            eq(playerProfiles.parentId, portalUser.id),
            inArray(playerProfiles.id, [sourceProfileId, targetProfileId]),
            isNull(playerProfiles.archivedAt),
            isNull(playerProfiles.mergedIntoProfileId)
          ));

        if (profiles.length !== 2) {
          return {
            success: false,
            status: 404,
            error: 'Both active player profiles are required to merge.',
          };
        }

        await tx.update(athletes)
          .set({ profileId: targetProfileId })
          .where(eq(athletes.profileId, sourceProfileId));

        // Keep previous merges pointed at the final active keeper instead of
        // building a chain through a newly archived intermediary.
        await tx.update(playerProfiles)
          .set({
            mergedIntoProfileId: targetProfileId,
            updatedAt: now,
          })
          .where(and(
            eq(playerProfiles.parentId, portalUser.id),
            eq(playerProfiles.mergedIntoProfileId, sourceProfileId)
          ));

        await tx.update(playerProfiles)
          .set({
            archivedAt: now,
            mergedIntoProfileId: targetProfileId,
            updatedAt: now,
          })
          .where(and(
            eq(playerProfiles.id, sourceProfileId),
            eq(playerProfiles.parentId, portalUser.id),
            isNull(playerProfiles.archivedAt),
            isNull(playerProfiles.mergedIntoProfileId)
          ));

        return { success: true, status: 200 };
      }

      const { profileId } = validation.data;

      if (validation.data.action === 'archive') {
        const [profile] = await tx.select({ id: playerProfiles.id })
          .from(playerProfiles)
          .where(and(
            eq(playerProfiles.id, profileId),
            eq(playerProfiles.parentId, portalUser.id),
            isNull(playerProfiles.archivedAt),
            isNull(playerProfiles.mergedIntoProfileId)
          ))
          .limit(1);

        if (!profile) {
          return { success: false, status: 404, error: 'Active player profile not found.' };
        }

        await tx.update(playerProfiles)
          .set({ archivedAt: now, updatedAt: now })
          .where(and(
            eq(playerProfiles.id, profileId),
            eq(playerProfiles.parentId, portalUser.id),
            isNull(playerProfiles.archivedAt)
          ));

        return { success: true, status: 200 };
      }

      const [profile] = await tx.select({ id: playerProfiles.id })
        .from(playerProfiles)
        .where(and(
          eq(playerProfiles.id, profileId),
          eq(playerProfiles.parentId, portalUser.id),
          isNotNull(playerProfiles.archivedAt),
          isNull(playerProfiles.mergedIntoProfileId)
        ))
        .limit(1);

      if (!profile) {
        return {
          success: false,
          status: 404,
          error: 'Archived player profile not found or cannot be restored after a merge.',
        };
      }

      await tx.update(playerProfiles)
        .set({
          archivedAt: null,
          updatedAt: now,
        })
        .where(and(
          eq(playerProfiles.id, profileId),
          eq(playerProfiles.parentId, portalUser.id),
          isNotNull(playerProfiles.archivedAt),
          isNull(playerProfiles.mergedIntoProfileId)
        ));

      return { success: true, status: 200 };
    });

    return result.success
      ? json({ success: true }, result.status)
      : json({ error: result.error }, result.status);
  } catch (error) {
    console.error('Manage Athlete Error:', error);
    return json({ error: 'Unable to update player profile.' }, 500);
  }
};
