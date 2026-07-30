import type { APIRoute } from 'astro';
import { db } from '../../../db/db';
import { playerProfiles } from '../../../db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';
import { portalAthleteUpdateSchema } from '../../../lib/schemas';
import { rejectCrossOriginRequest } from '../../../lib/request-security';
import { ensureCanonicalPortalUser } from '../../../lib/portal-ownership';

export const POST: APIRoute = async ({ request }) => {
  try {
    const originError = rejectCrossOriginRequest(request);
    if (originError) return originError;

    let session = null;
    try {
      session = await getSession(request);
    } catch (authErr) {
      console.error('Auth Session Error (non-fatal):', authErr);
    }

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const portalUser = await ensureCanonicalPortalUser(session.user);
    if (!portalUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const validation = portalAthleteUpdateSchema.safeParse(await request.json());
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: validation.error.issues[0]?.message || 'Invalid player details',
      }), { status: 400 });
    }
    const { id, firstName, lastName, grade, tshirtSize, medicalInfo } = validation.data;

    const [ownedAthlete] = await db.select({ id: playerProfiles.id })
    .from(playerProfiles)
    .where(and(
      eq(playerProfiles.id, id),
      eq(playerProfiles.parentId, portalUser.id),
      isNull(playerProfiles.archivedAt),
      isNull(playerProfiles.mergedIntoProfileId)
    ))
    .limit(1);

    if (!ownedAthlete) {
      return new Response(JSON.stringify({ error: 'Athlete not found' }), { status: 404 });
    }

    await db.update(playerProfiles)
      .set({
        firstName,
        lastName,
        grade,
        tshirtSize,
        medicalInfo,
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(playerProfiles.id, id),
        eq(playerProfiles.parentId, portalUser.id),
        isNull(playerProfiles.archivedAt),
        isNull(playerProfiles.mergedIntoProfileId)
      ));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Update Athlete Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
