import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/db';
import { clubSeasonRegistrations } from '../../../db/schema';
import { getOwnedClubSeasonOffers, getVerifiedClubSeasonUser } from '../../../lib/club-season-access';
import { saveClubSeasonDraftSchema } from '../../../lib/club-season-draft';
import { canAccessClubSeasonRegistration, isClubSeasonRouteAvailable } from '../../../lib/club-season-feature';
import { getClubDate } from '../../../lib/event-eligibility';
import { rejectCrossOriginRequest } from '../../../lib/request-security';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ request }) => {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;
  if (!db) return json({ error: 'Database configuration missing.' }, 500);

  try {
    const user = await getVerifiedClubSeasonUser(request);
    if (!user) return json({ error: 'Authentication required.' }, 401);
    if (!isClubSeasonRouteAvailable(user.email)) return json({ error: 'Not found.' }, 404);

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 65_536) return json({ error: 'Registration draft is too large.' }, 413);
    const rawBody = await request.text();
    if (rawBody.length > 65_536) return json({ error: 'Registration draft is too large.' }, 413);

    let requestBody: unknown;
    try {
      requestBody = JSON.parse(rawBody);
    } catch {
      return json({ error: 'Invalid registration draft.' }, 400);
    }
    const parsed = saveClubSeasonDraftSchema.safeParse(requestBody);
    if (!parsed.success) {
      return json({
        error: parsed.error.issues[0]?.message || 'Invalid registration draft.',
        details: parsed.error.flatten().fieldErrors,
      }, 400);
    }

    const ownedOffers = await getOwnedClubSeasonOffers(request);
    const item = ownedOffers.find(({ offer }) => offer.id === parsed.data.offerId);
    if (!item || item.draft?.ownerUserId !== user.id) {
      return json({ error: 'Registration draft not found.' }, 404);
    }
    if (!canAccessClubSeasonRegistration(user.email, item.season.publicRegistrationEnabled)) {
      return json({ error: 'Season registration is not currently available.' }, 403);
    }
    if (item.offer.acceptanceDeadline && item.offer.acceptanceDeadline < getClubDate()) {
      return json({ error: 'This offer has expired. Please contact TVVC.' }, 410);
    }
    if (item.offer.status !== 'registration_started' || item.draft.status !== 'draft') {
      return json({ error: 'This registration draft can no longer be edited.' }, 409);
    }
    if (item.draft.draftSchemaVersion !== 1) {
      return json({ error: 'This registration draft requires an update before it can be edited.' }, 409);
    }

    const now = new Date().toISOString();
    const [updated] = await db.update(clubSeasonRegistrations).set({
      currentStep: parsed.data.currentStep,
      draftData: JSON.stringify(parsed.data.data),
      version: parsed.data.version + 1,
      lastSavedAt: now,
      updatedAt: now,
    }).where(and(
      eq(clubSeasonRegistrations.id, item.draft.id),
      eq(clubSeasonRegistrations.ownerUserId, user.id),
      eq(clubSeasonRegistrations.status, 'draft'),
      eq(clubSeasonRegistrations.version, parsed.data.version)
    )).returning({
      id: clubSeasonRegistrations.id,
      version: clubSeasonRegistrations.version,
      currentStep: clubSeasonRegistrations.currentStep,
      lastSavedAt: clubSeasonRegistrations.lastSavedAt,
    });

    if (!updated) {
      const [current] = await db.select({
        version: clubSeasonRegistrations.version,
        currentStep: clubSeasonRegistrations.currentStep,
        draftData: clubSeasonRegistrations.draftData,
        lastSavedAt: clubSeasonRegistrations.lastSavedAt,
      }).from(clubSeasonRegistrations).where(and(
        eq(clubSeasonRegistrations.id, item.draft.id),
        eq(clubSeasonRegistrations.ownerUserId, user.id)
      )).limit(1);

      return json({
        error: 'This registration was updated in another tab. Reload before continuing.',
        current,
      }, 409);
    }

    return json({ draft: updated });
  } catch (error) {
    console.error('Save club season registration draft error:', error);
    return json({ error: 'Unable to save the registration draft.' }, 500);
  }
};
