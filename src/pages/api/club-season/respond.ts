import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/db';
import {
  athletes,
  clubSeasonOffers,
  clubSeasonRegistrations,
  clubSeasons,
  registrations,
} from '../../../db/schema';
import { getVerifiedClubSeasonUser } from '../../../lib/club-season-access';
import { isClubSeasonRegistrationEnabled } from '../../../lib/club-season-feature';
import { getClubDate } from '../../../lib/event-eligibility';
import { rejectCrossOriginRequest } from '../../../lib/request-security';

export const prerender = false;

const responseSchema = z.object({
  offerId: z.string().uuid(),
  action: z.enum(['start', 'decline']),
  declineReason: z.string().trim().max(80).optional(),
  declineDetails: z.string().trim().max(500).optional(),
}).strict();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;
  if (!isClubSeasonRegistrationEnabled()) return json({ error: 'Not found.' }, 404);
  if (!db) return json({ error: 'Database configuration missing.' }, 500);

  try {
    const parsed = responseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message || 'Invalid response.' }, 400);
    }

    const user = await getVerifiedClubSeasonUser(request);
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const [ownedOffer] = await db.select({
      offer: clubSeasonOffers,
      publicRegistrationEnabled: clubSeasons.publicRegistrationEnabled,
      registrationUserId: registrations.userId,
      athleteParentId: athletes.parentId,
      athleteRegistrationId: athletes.registrationId,
    })
      .from(clubSeasonOffers)
      .innerJoin(clubSeasons, eq(clubSeasonOffers.seasonId, clubSeasons.id))
      .innerJoin(registrations, eq(clubSeasonOffers.sourceRegistrationId, registrations.id))
      .innerJoin(athletes, eq(clubSeasonOffers.sourceAthleteId, athletes.id))
      .where(and(
        eq(clubSeasonOffers.id, parsed.data.offerId),
        eq(clubSeasonOffers.recipientEmail, user.email.trim().toLowerCase()),
        eq(registrations.userId, user.id),
        eq(athletes.parentId, user.id)
      ))
      .limit(1);

    if (!ownedOffer) return json({ error: 'Offer not found.' }, 404);
    if (!ownedOffer.publicRegistrationEnabled) {
      return json({ error: 'Season registration is not currently available.' }, 403);
    }
    if (ownedOffer.athleteRegistrationId !== ownedOffer.offer.sourceRegistrationId) {
      return json({ error: 'Offer ownership could not be verified.' }, 403);
    }

    const offer = ownedOffer.offer;
    if (offer.acceptanceDeadline && offer.acceptanceDeadline < getClubDate()) {
      return json({ error: 'This offer has expired. Please contact TVVC.' }, 410);
    }
    if (offer.status === 'revoked') return json({ error: 'This offer is no longer available.' }, 410);
    if (offer.status === 'accepted') return json({ error: 'This offer has already been accepted.' }, 409);

    const now = new Date().toISOString();

    if (parsed.data.action === 'decline') {
      if (offer.status === 'registration_started') {
        return json({ error: 'Contact TVVC to withdraw after starting registration.' }, 409);
      }
      if (offer.status === 'declined') return json({ status: 'declined' });
      if (offer.status !== 'offered') return json({ error: 'This offer cannot be declined.' }, 409);

      await db.update(clubSeasonOffers).set({
        status: 'declined',
        recipientUserId: user.id,
        declineReason: parsed.data.declineReason || null,
        declineDetails: parsed.data.declineDetails || null,
        respondedAt: now,
        updatedAt: now,
      }).where(and(
        eq(clubSeasonOffers.id, offer.id),
        eq(clubSeasonOffers.status, 'offered')
      ));

      return json({ status: 'declined' });
    }

    if (offer.status !== 'offered' && offer.status !== 'registration_started') {
      return json({ error: 'This offer cannot start registration.' }, 409);
    }

    const draftId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      if (offer.status === 'offered') {
        await tx.update(clubSeasonOffers).set({
          status: 'registration_started',
          recipientUserId: user.id,
          viewedAt: offer.viewedAt || now,
          respondedAt: now,
          updatedAt: now,
        }).where(and(
          eq(clubSeasonOffers.id, offer.id),
          eq(clubSeasonOffers.status, 'offered')
        ));
      }

      await tx.insert(clubSeasonRegistrations).values({
        id: draftId,
        offerId: offer.id,
        seasonId: offer.seasonId,
        teamId: offer.teamId,
        ownerUserId: user.id,
        playerProfileId: offer.sourceProfileId,
        status: 'draft',
        currentStep: 1,
        startedAt: now,
        lastSavedAt: now,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    });

    const [draft] = await db.select({
      id: clubSeasonRegistrations.id,
      status: clubSeasonRegistrations.status,
      currentStep: clubSeasonRegistrations.currentStep,
    }).from(clubSeasonRegistrations).where(and(
      eq(clubSeasonRegistrations.offerId, offer.id),
      eq(clubSeasonRegistrations.ownerUserId, user.id)
    )).limit(1);

    if (!draft) return json({ error: 'Unable to start registration.' }, 500);
    return json({ status: 'registration_started', draft });
  } catch (error) {
    console.error('Club season offer response error:', error);
    return json({ error: 'Unable to save your response.' }, 500);
  }
};
