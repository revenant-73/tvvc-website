import type { APIRoute } from 'astro';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db';
import {
  athletes,
  clubAgeGroups,
  clubSeasonAgreementAcceptances,
  clubSeasonOffers,
  clubSeasonRegistrations,
  clubSeasons,
  clubTeams,
  events,
  registrationItems,
  registrations,
  users,
} from '../../../db/schema';
import { requireAdminApiSession } from '../../../lib/admin-auth';

export const prerender = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const bulkOfferSchema = z.object({
  seasonId: z.string().trim().min(1),
  teamId: z.string().trim().min(1),
  athleteIds: z.array(z.number().int().positive()).min(1).max(200),
  acceptanceDeadline: z.string().regex(ISO_DATE).nullable().optional(),
}).strict();

const updateOfferSchema = z.object({
  offerId: z.string().uuid(),
  action: z.enum(['revoke', 'restore']),
}).strict();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizedEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || '';
}

function uniqueByAthlete<T extends { athleteId: number }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((row) => [row.athleteId, row])).values());
}

type Database = ReturnType<typeof getDb>;

async function findTryoutCandidates(
  db: Database,
  athleteIds?: number[]
) {
  const filters = [
    eq(events.type, 'tryout'),
    eq(events.active, true),
    eq(registrations.status, 'paid'),
  ];
  if (athleteIds?.length) filters.push(inArray(athletes.id, athleteIds));

  const rows = await db.select({
    athleteId: athletes.id,
    registrationId: registrations.id,
    profileId: athletes.profileId,
    firstName: athletes.firstName,
    lastName: athletes.lastName,
    grade: athletes.grade,
    tryoutName: events.name,
    parentName: registrations.parentName,
    parentEmail: registrations.parentEmail,
    registrationUserId: registrations.userId,
    athleteParentId: athletes.parentId,
    ownerEmail: users.email,
  })
    .from(registrationItems)
    .innerJoin(events, eq(registrationItems.eventId, events.id))
    .innerJoin(registrations, eq(registrationItems.registrationId, registrations.id))
    .innerJoin(athletes, and(
      eq(registrationItems.athleteId, athletes.id),
      eq(athletes.registrationId, registrations.id)
    ))
    .leftJoin(users, eq(registrations.userId, users.id))
    .where(and(...filters))
    .orderBy(asc(athletes.lastName), asc(athletes.firstName));

  return uniqueByAthlete(rows);
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const authorization = await requireAdminApiSession(request);
    if (!authorization.authorized) return authorization.response;

    const seasonId = url.searchParams.get('seasonId')?.trim();
    if (!seasonId) return json({ error: 'seasonId is required.' }, 400);

    const { db } = authorization;
    const [season] = await db.select().from(clubSeasons)
      .where(eq(clubSeasons.id, seasonId)).limit(1);
    if (!season) return json({ error: 'Club season not found.' }, 404);

    const [teams, candidates, offers, seasonRegistrations, mediaAcceptances] = await Promise.all([
      db.select({
        id: clubTeams.id,
        name: clubTeams.name,
        ageGroupId: clubTeams.ageGroupId,
        ageGroupLabel: clubAgeGroups.label,
        acceptanceDeadlineOverride: clubTeams.acceptanceDeadlineOverride,
      })
        .from(clubTeams)
        .innerJoin(clubAgeGroups, eq(clubTeams.ageGroupId, clubAgeGroups.id))
        .where(and(
          eq(clubTeams.seasonId, seasonId),
          eq(clubTeams.active, true),
          eq(clubAgeGroups.active, true)
        ))
        .orderBy(asc(clubAgeGroups.sortOrder), asc(clubTeams.name)),
      findTryoutCandidates(db),
      db.select().from(clubSeasonOffers)
        .where(eq(clubSeasonOffers.seasonId, seasonId)),
      db.select({
        id: clubSeasonRegistrations.id,
        offerId: clubSeasonRegistrations.offerId,
        status: clubSeasonRegistrations.status,
      }).from(clubSeasonRegistrations)
        .where(eq(clubSeasonRegistrations.seasonId, seasonId)),
      db.select({
        registrationId: clubSeasonAgreementAcceptances.registrationId,
        response: clubSeasonAgreementAcceptances.response,
        acceptedAt: clubSeasonAgreementAcceptances.acceptedAt,
      })
        .from(clubSeasonAgreementAcceptances)
        .innerJoin(
          clubSeasonRegistrations,
          eq(clubSeasonAgreementAcceptances.registrationId, clubSeasonRegistrations.id)
        )
        .where(and(
          eq(clubSeasonRegistrations.seasonId, seasonId),
          eq(clubSeasonAgreementAcceptances.agreementKeySnapshot, 'media-release')
        ))
        .orderBy(asc(clubSeasonAgreementAcceptances.acceptedAt)),
    ]);

    const offerByAthlete = new Map(offers.map((offer) => [offer.sourceAthleteId, offer]));
    const registrationByOffer = new Map(seasonRegistrations.map((registration) => [registration.offerId, registration]));
    const mediaResponseByRegistration = new Map(
      mediaAcceptances.map((acceptance) => [acceptance.registrationId, acceptance.response])
    );
    return json({
      season,
      teams,
      candidates: candidates.map((candidate) => {
        const parentEmail = normalizedEmail(candidate.parentEmail);
        const ownerEmail = normalizedEmail(candidate.ownerEmail);
        const ownershipConflict = Boolean(
          candidate.registrationUserId && (
            !candidate.athleteParentId ||
            candidate.athleteParentId !== candidate.registrationUserId ||
            ownerEmail !== parentEmail
          )
        );

        const offer = offerByAthlete.get(candidate.athleteId) || null;
        const registration = offer ? registrationByOffer.get(offer.id) || null : null;
        const mediaResponse = registration ? mediaResponseByRegistration.get(registration.id) : null;

        return {
          ...candidate,
          parentEmail,
          ownerEmail: ownerEmail || null,
          eligible: Boolean(parentEmail) && !ownershipConflict,
          issue: !parentEmail
            ? 'Missing parent email'
            : ownershipConflict
              ? 'Portal ownership does not match the tryout email'
              : null,
          offer,
          registrationStatus: registration?.status || null,
          mediaReleaseStatus: mediaResponse === 'granted' || mediaResponse === 'declined'
            ? mediaResponse
            : null,
        };
      }),
    });
  } catch (error) {
    console.error('Load club season offer candidates error:', error);
    return json({ error: 'Unable to load offer candidates.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const authorization = await requireAdminApiSession(request);
    if (!authorization.authorized) return authorization.response;

    const parsed = bulkOfferSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message || 'Invalid offer request.' }, 400);
    }

    const { db, user } = authorization;
    const { seasonId, teamId, acceptanceDeadline } = parsed.data;
    const athleteIds = Array.from(new Set(parsed.data.athleteIds));

    const [team] = await db.select({
      id: clubTeams.id,
      seasonId: clubTeams.seasonId,
      active: clubTeams.active,
      defaultDeadline: clubTeams.acceptanceDeadlineOverride,
    }).from(clubTeams)
      .innerJoin(clubAgeGroups, eq(clubTeams.ageGroupId, clubAgeGroups.id))
      .where(and(
      eq(clubTeams.id, teamId),
      eq(clubTeams.seasonId, seasonId),
      eq(clubTeams.active, true),
      eq(clubAgeGroups.active, true)
    )).limit(1);
    if (!team) return json({ error: 'Active team not found for this season.' }, 400);

    const candidates = await findTryoutCandidates(db, athleteIds);
    const candidateById = new Map(candidates.map((candidate) => [candidate.athleteId, candidate]));
    const existingOffers = await db.select().from(clubSeasonOffers).where(and(
      eq(clubSeasonOffers.seasonId, seasonId),
      inArray(clubSeasonOffers.sourceAthleteId, athleteIds)
    ));
    const existingByAthlete = new Map(existingOffers.map((offer) => [offer.sourceAthleteId, offer]));
    const now = new Date().toISOString();
    const results: Array<Record<string, unknown>> = [];

    for (const athleteId of athleteIds) {
      const existing = existingByAthlete.get(athleteId);
      if (existing) {
        results.push({ athleteId, status: 'already_offered', offerId: existing.id });
        continue;
      }

      const candidate = candidateById.get(athleteId);
      if (!candidate) {
        results.push({ athleteId, status: 'invalid', error: 'Paid tryout registration not found.' });
        continue;
      }

      const recipientEmail = normalizedEmail(candidate.parentEmail);
      const ownerEmail = normalizedEmail(candidate.ownerEmail);
      const ownershipConflict = Boolean(
        candidate.registrationUserId && (
          !candidate.athleteParentId ||
          candidate.athleteParentId !== candidate.registrationUserId ||
          ownerEmail !== recipientEmail
        )
      );
      if (!recipientEmail || ownershipConflict) {
        results.push({
          athleteId,
          status: 'invalid',
          error: !recipientEmail
            ? 'Tryout registration has no parent email.'
            : 'Portal ownership does not match the tryout registration email.',
        });
        continue;
      }

      const offerId = crypto.randomUUID();
      const inserted = await db.insert(clubSeasonOffers).values({
        id: offerId,
        seasonId,
        teamId,
        sourceRegistrationId: candidate.registrationId,
        sourceAthleteId: athleteId,
        sourceProfileId: candidate.profileId,
        recipientEmail,
        recipientUserId: candidate.registrationUserId,
        status: 'offered',
        acceptanceDeadline: acceptanceDeadline ?? team.defaultDeadline ?? null,
        createdByUserId: user.id,
        offeredAt: now,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing().returning({ id: clubSeasonOffers.id });

      results.push(inserted.length
        ? { athleteId, status: 'created', offerId }
        : { athleteId, status: 'already_offered' });
    }

    return json({ results }, 207);
  } catch (error) {
    console.error('Create club season offers error:', error);
    return json({ error: 'Unable to create club season offers.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const authorization = await requireAdminApiSession(request);
    if (!authorization.authorized) return authorization.response;

    const parsed = updateOfferSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Invalid offer update.' }, 400);

    const { db } = authorization;
    const [offer] = await db.select().from(clubSeasonOffers)
      .where(eq(clubSeasonOffers.id, parsed.data.offerId)).limit(1);
    if (!offer) return json({ error: 'Offer not found.' }, 404);
    if (offer.status === 'registration_started' || offer.status === 'accepted') {
      return json({ error: 'An offer with registration activity cannot be revoked here.' }, 409);
    }

    const status = parsed.data.action === 'revoke' ? 'revoked' : 'offered';
    const [updated] = await db.update(clubSeasonOffers).set({
      status,
      respondedAt: status === 'revoked' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }).where(eq(clubSeasonOffers.id, offer.id)).returning();

    return json({ offer: updated });
  } catch (error) {
    console.error('Update club season offer error:', error);
    return json({ error: 'Unable to update the offer.' }, 500);
  }
};
