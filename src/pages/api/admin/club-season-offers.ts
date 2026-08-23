import type { APIRoute } from 'astro';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db';
import {
  athletes,
  clubAgeGroups,
  clubSeasonAdminAuditLog,
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
import { isClubSeasonRegistrationEnabled } from '../../../lib/club-season-feature';

export const prerender = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PREPARATION_STATUSES = ['draft', 'ready'] as const;
const RELEASED_STATUSES = ['offered', 'registration_started', 'accepted', 'declined', 'revoked'] as const;
const WAVE_DATES = {
  nov8: '2026-11-08',
  nov15: '2026-11-15',
} as const;

const bulkOfferSchema = z.object({
  seasonId: z.string().trim().min(1),
  teamId: z.string().trim().min(1),
  athleteIds: z.array(z.number().int().positive()).min(1).max(200),
  acceptanceDeadline: z.string().regex(ISO_DATE).nullable().optional(),
  wave: z.enum(['nov8', 'nov15']).optional(),
}).strict();

const updateOfferSchema = z.discriminatedUnion('action', [
  z.object({ offerId: z.string().uuid(), action: z.literal('edit'), teamId: z.string().trim().min(1), acceptanceDeadline: z.string().regex(ISO_DATE).nullable() }).strict(),
  z.object({ offerIds: z.array(z.string().uuid()).min(1).max(200), action: z.literal('ready'), confirmation: z.literal('MARK READY') }).strict(),
  z.object({ offerId: z.string().uuid(), action: z.enum(['revoke', 'restore']) }).strict(),
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function normalizedEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || '';
}

type Database = ReturnType<typeof getDb>;
type TryoutCandidateRow = Awaited<ReturnType<typeof findTryoutCandidateRows>>[number];

async function findTryoutCandidateRows(db: Database, athleteIds?: number[]) {
  const filters = [eq(events.type, 'tryout'), eq(events.active, true), eq(registrations.status, 'paid')];
  if (athleteIds?.length) filters.push(inArray(athletes.id, athleteIds));
  return db.select({
    athleteId: athletes.id,
    registrationId: registrations.id,
    profileId: athletes.profileId,
    firstName: athletes.firstName,
    lastName: athletes.lastName,
    grade: athletes.grade,
    tryoutId: events.id,
    tryoutName: events.name,
    tryoutDate: events.startDate,
    parentName: registrations.parentName,
    parentEmail: registrations.parentEmail,
    registrationUserId: registrations.userId,
    athleteParentId: athletes.parentId,
    ownerEmail: users.email,
  })
    .from(registrationItems)
    .innerJoin(events, eq(registrationItems.eventId, events.id))
    .innerJoin(registrations, eq(registrationItems.registrationId, registrations.id))
    .innerJoin(athletes, and(eq(registrationItems.athleteId, athletes.id), eq(athletes.registrationId, registrations.id)))
    .leftJoin(users, eq(registrations.userId, users.id))
    .where(and(...filters))
    .orderBy(asc(athletes.lastName), asc(athletes.firstName), asc(events.startDate), asc(events.name));
}

function groupTryoutCandidates(rows: TryoutCandidateRow[]) {
  const grouped = new Map<number, Omit<TryoutCandidateRow, 'tryoutId' | 'tryoutName' | 'tryoutDate'> & {
    tryoutSessions: Array<{ id: string; name: string; date: string | null }>;
    waveIds: Array<keyof typeof WAVE_DATES>;
  }>();
  for (const row of rows) {
    const current = grouped.get(row.athleteId) || {
      athleteId: row.athleteId,
      registrationId: row.registrationId,
      profileId: row.profileId,
      firstName: row.firstName,
      lastName: row.lastName,
      grade: row.grade,
      parentName: row.parentName,
      parentEmail: row.parentEmail,
      registrationUserId: row.registrationUserId,
      athleteParentId: row.athleteParentId,
      ownerEmail: row.ownerEmail,
      tryoutSessions: [],
      waveIds: [],
    };
    if (!current.tryoutSessions.some((session) => session.id === row.tryoutId)) {
      current.tryoutSessions.push({ id: row.tryoutId, name: row.tryoutName, date: row.tryoutDate });
    }
    for (const [wave, date] of Object.entries(WAVE_DATES) as Array<[keyof typeof WAVE_DATES, string]>) {
      if (row.tryoutDate === date && !current.waveIds.includes(wave)) current.waveIds.push(wave);
    }
    grouped.set(row.athleteId, current);
  }
  return Array.from(grouped.values());
}

async function activeTeam(db: Database, seasonId: string, teamId: string) {
  const [team] = await db.select({
    id: clubTeams.id,
    seasonId: clubTeams.seasonId,
    name: clubTeams.name,
    active: clubTeams.active,
    defaultDeadline: clubTeams.acceptanceDeadlineOverride,
  }).from(clubTeams)
    .innerJoin(clubAgeGroups, eq(clubTeams.ageGroupId, clubAgeGroups.id))
    .where(and(eq(clubTeams.id, teamId), eq(clubTeams.seasonId, seasonId), eq(clubTeams.active, true), eq(clubAgeGroups.active, true)))
    .limit(1);
  return team;
}

function auditValues(userId: string, action: string, offerId: string, before: unknown, after: unknown, reason?: string) {
  return {
    id: crypto.randomUUID(), adminUserId: userId, action, entityType: 'club_season_offer', entityId: offerId,
    reason: reason || null, beforeSnapshot: before ? JSON.stringify(before) : null,
    afterSnapshot: after ? JSON.stringify(after) : null, createdAt: new Date().toISOString(),
  };
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const authorization = await requireAdminApiSession(request);
    if (!authorization.authorized) return authorization.response;
    const seasonId = url.searchParams.get('seasonId')?.trim();
    const wave = url.searchParams.get('wave');
    if (!seasonId) return json({ error: 'seasonId is required.' }, 400);
    if (wave && !(wave in WAVE_DATES)) return json({ error: 'Unknown tryout wave.' }, 400);

    const { db } = authorization;
    const [season] = await db.select().from(clubSeasons).where(eq(clubSeasons.id, seasonId)).limit(1);
    if (!season) return json({ error: 'Club season not found.' }, 404);
    const [allTeams, candidateRows, offers, seasonRegistrations, mediaAcceptances] = await Promise.all([
      db.select({ id: clubTeams.id, name: clubTeams.name, active: clubTeams.active, ageGroupId: clubTeams.ageGroupId, ageGroupLabel: clubAgeGroups.label, acceptanceDeadlineOverride: clubTeams.acceptanceDeadlineOverride })
        .from(clubTeams).innerJoin(clubAgeGroups, eq(clubTeams.ageGroupId, clubAgeGroups.id))
        .where(and(eq(clubTeams.seasonId, seasonId), eq(clubAgeGroups.active, true)))
        .orderBy(asc(clubAgeGroups.sortOrder), asc(clubTeams.name)),
      findTryoutCandidateRows(db),
      db.select().from(clubSeasonOffers).where(eq(clubSeasonOffers.seasonId, seasonId)),
      db.select({ id: clubSeasonRegistrations.id, offerId: clubSeasonRegistrations.offerId, status: clubSeasonRegistrations.status })
        .from(clubSeasonRegistrations).where(eq(clubSeasonRegistrations.seasonId, seasonId)),
      db.select({ registrationId: clubSeasonAgreementAcceptances.registrationId, response: clubSeasonAgreementAcceptances.response, acceptedAt: clubSeasonAgreementAcceptances.acceptedAt })
        .from(clubSeasonAgreementAcceptances)
        .innerJoin(clubSeasonRegistrations, eq(clubSeasonAgreementAcceptances.registrationId, clubSeasonRegistrations.id))
        .where(and(eq(clubSeasonRegistrations.seasonId, seasonId), eq(clubSeasonAgreementAcceptances.agreementKeySnapshot, 'media-release')))
        .orderBy(asc(clubSeasonAgreementAcceptances.acceptedAt)),
    ]);
    const teamById = new Map(allTeams.map((team) => [team.id, team]));
    const offerByAthlete = new Map(offers.map((offer) => [offer.sourceAthleteId, offer]));
    const registrationByOffer = new Map(seasonRegistrations.map((registration) => [registration.offerId, registration]));
    const mediaByRegistration = new Map(mediaAcceptances.map((acceptance) => [acceptance.registrationId, acceptance.response]));
    const grouped = groupTryoutCandidates(candidateRows);
    const waveCandidates = wave ? grouped.filter((candidate) => candidate.waveIds.includes(wave as keyof typeof WAVE_DATES)) : grouped;
    const candidates = waveCandidates.map((candidate) => {
      const parentEmail = normalizedEmail(candidate.parentEmail);
      const ownerEmail = normalizedEmail(candidate.ownerEmail);
      const ownershipConflict = Boolean(candidate.registrationUserId && (!candidate.athleteParentId || candidate.athleteParentId !== candidate.registrationUserId || ownerEmail !== parentEmail));
      const offer = offerByAthlete.get(candidate.athleteId) || null;
      const offerTeam = offer ? teamById.get(offer.teamId) || null : null;
      const registration = offer ? registrationByOffer.get(offer.id) || null : null;
      const issues = [
        !parentEmail ? 'Missing parent email' : null,
        ownershipConflict ? 'Portal ownership does not match the tryout email' : null,
        offer && (!offerTeam || !offerTeam.active) ? 'Existing offer references an inactive team' : null,
      ].filter(Boolean) as string[];
      return {
        ...candidate, parentEmail, ownerEmail: ownerEmail || null,
        eligible: Boolean(parentEmail) && !ownershipConflict,
        issue: issues[0] || null, issues, offer,
        existingTeam: offerTeam ? { id: offerTeam.id, name: offerTeam.name, ageGroupLabel: offerTeam.ageGroupLabel, active: offerTeam.active } : null,
        registrationStatus: registration?.status || null,
        mediaReleaseStatus: registration ? mediaByRegistration.get(registration.id) || null : null,
      };
    });
    const candidateIds = new Set(candidates.map((candidate) => candidate.athleteId));
    const waveOffers = offers.filter((offer) => candidateIds.has(offer.sourceAthleteId));
    const countsByTeam = Array.from(new Map(waveOffers.map((offer) => {
      const team = teamById.get(offer.teamId);
      return [offer.teamId, { teamId: offer.teamId, teamName: team?.name || 'Unknown team', count: 0 }];
    })).values());
    for (const item of countsByTeam) item.count = waveOffers.filter((offer) => offer.teamId === item.teamId).length;
    return json({
      season,
      accessLocks: { database: Boolean(season.publicRegistrationEnabled), featureFlag: isClubSeasonRegistrationEnabled() },
      wave: wave || 'all',
      waves: [
        { id: 'nov8', date: WAVE_DATES.nov8, label: 'November 8', ages: '10U–14U', deadline: '2026-11-12' },
        { id: 'nov15', date: WAVE_DATES.nov15, label: 'November 15', ages: '15U–18U', deadline: '2026-11-19' },
      ],
      teams: allTeams.filter((team) => team.active),
      candidates,
      summary: {
        eligible: candidates.filter((candidate) => candidate.eligible).length,
        draft: waveOffers.filter((offer) => offer.status === 'draft').length,
        ready: waveOffers.filter((offer) => offer.status === 'ready').length,
        released: waveOffers.filter((offer) => RELEASED_STATUSES.includes(offer.status as typeof RELEASED_STATUSES[number])).length,
        unassigned: candidates.filter((candidate) => candidate.eligible && !candidate.offer).length,
        blocking: candidates.filter((candidate) => candidate.issues.length > 0).length,
        blockerCounts: {
          missingEmail: candidates.filter((candidate) => candidate.issues.includes('Missing parent email')).length,
          ownershipMismatch: candidates.filter((candidate) => candidate.issues.includes('Portal ownership does not match the tryout email')).length,
          inactiveTeam: candidates.filter((candidate) => candidate.issues.includes('Existing offer references an inactive team')).length,
        },
        countsByTeam,
      },
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
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || 'Invalid offer request.' }, 400);
    const { db, user } = authorization;
    const { seasonId, teamId, acceptanceDeadline, wave } = parsed.data;
    const athleteIds = Array.from(new Set(parsed.data.athleteIds));
    const team = await activeTeam(db, seasonId, teamId);
    if (!team) return json({ error: 'Active team not found for this season.' }, 400);
    const candidates = groupTryoutCandidates(await findTryoutCandidateRows(db, athleteIds));
    const candidateById = new Map(candidates.map((candidate) => [candidate.athleteId, candidate]));
    const existingOffers = await db.select().from(clubSeasonOffers).where(and(eq(clubSeasonOffers.seasonId, seasonId), inArray(clubSeasonOffers.sourceAthleteId, athleteIds)));
    const existingByAthlete = new Map(existingOffers.map((offer) => [offer.sourceAthleteId, offer]));
    const existingTeams = await db.select({ id: clubTeams.id, name: clubTeams.name }).from(clubTeams).where(eq(clubTeams.seasonId, seasonId));
    const teamNames = new Map(existingTeams.map((item) => [item.id, item.name]));
    const results: Array<Record<string, unknown>> = [];

    for (const athleteId of athleteIds) {
      const existing = existingByAthlete.get(athleteId);
      if (existing) {
        results.push({ athleteId, status: 'already_assigned', offerId: existing.id, existingStatus: existing.status, existingTeamId: existing.teamId, existingTeamName: teamNames.get(existing.teamId) || 'Unknown team' });
        continue;
      }
      const candidate = candidateById.get(athleteId);
      if (!candidate) { results.push({ athleteId, status: 'invalid', error: 'Paid tryout registration not found.' }); continue; }
      if (wave && !candidate.waveIds.includes(wave)) { results.push({ athleteId, status: 'invalid', error: 'Player is not registered for the selected tryout wave.' }); continue; }
      const recipientEmail = normalizedEmail(candidate.parentEmail);
      const ownerEmail = normalizedEmail(candidate.ownerEmail);
      const ownershipConflict = Boolean(candidate.registrationUserId && (!candidate.athleteParentId || candidate.athleteParentId !== candidate.registrationUserId || ownerEmail !== recipientEmail));
      if (!recipientEmail || ownershipConflict) {
        results.push({ athleteId, status: 'invalid', error: !recipientEmail ? 'Tryout registration has no parent email.' : 'Portal ownership does not match the tryout registration email.' });
        continue;
      }
      const offerId = crypto.randomUUID();
      const now = new Date().toISOString();
      const created = await db.transaction(async (tx) => {
        const inserted = await tx.insert(clubSeasonOffers).values({
          id: offerId, seasonId, teamId, sourceRegistrationId: candidate.registrationId,
          sourceAthleteId: athleteId, sourceProfileId: candidate.profileId,
          recipientEmail, recipientUserId: candidate.registrationUserId,
          status: 'draft', acceptanceDeadline: acceptanceDeadline ?? team.defaultDeadline ?? null,
          createdByUserId: user.id, offeredAt: null, createdAt: now, updatedAt: now,
        }).onConflictDoNothing().returning();
        if (inserted[0]) await tx.insert(clubSeasonAdminAuditLog).values(auditValues(user.id, 'offer_draft_created', offerId, null, inserted[0]));
        return inserted[0];
      });
      if (created) results.push({ athleteId, status: 'created', offerId });
      else {
        const [current] = await db.select().from(clubSeasonOffers).where(and(eq(clubSeasonOffers.seasonId, seasonId), eq(clubSeasonOffers.sourceAthleteId, athleteId))).limit(1);
        results.push({ athleteId, status: 'already_assigned', offerId: current?.id, existingStatus: current?.status, existingTeamId: current?.teamId, existingTeamName: current ? teamNames.get(current.teamId) || 'Unknown team' : 'Unknown team' });
      }
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
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || 'Invalid offer update.' }, 400);
    const { db, user } = authorization;

    if (parsed.data.action === 'ready') {
      const offerIds = Array.from(new Set(parsed.data.offerIds));
      const offers = await db.select().from(clubSeasonOffers).where(inArray(clubSeasonOffers.id, offerIds));
      const byId = new Map(offers.map((offer) => [offer.id, offer]));
      const results: Array<Record<string, unknown>> = [];
      for (const offerId of offerIds) {
        const offer = byId.get(offerId);
        if (!offer) { results.push({ offerId, status: 'not_found' }); continue; }
        if (offer.status === 'ready') { results.push({ offerId, status: 'already_ready' }); continue; }
        if (offer.status !== 'draft') { results.push({ offerId, status: 'locked', currentStatus: offer.status }); continue; }
        const team = await activeTeam(db, offer.seasonId, offer.teamId);
        if (!team) { results.push({ offerId, status: 'invalid', error: 'Assigned team is inactive.' }); continue; }
        const now = new Date().toISOString();
        const updated = await db.transaction(async (tx) => {
          const [row] = await tx.update(clubSeasonOffers).set({ status: 'ready', updatedAt: now })
            .where(and(eq(clubSeasonOffers.id, offer.id), eq(clubSeasonOffers.status, 'draft'))).returning();
          if (row) await tx.insert(clubSeasonAdminAuditLog).values(auditValues(user.id, 'offer_marked_ready', offer.id, offer, row));
          return row;
        });
        results.push({ offerId, status: updated ? 'ready' : 'already_ready' });
      }
      return json({ results }, 207);
    }

    const [offer] = await db.select().from(clubSeasonOffers).where(eq(clubSeasonOffers.id, parsed.data.offerId)).limit(1);
    if (!offer) return json({ error: 'Offer not found.' }, 404);
    if (parsed.data.action === 'edit') {
      if (!PREPARATION_STATUSES.includes(offer.status as typeof PREPARATION_STATUSES[number])) return json({ error: 'Released offers cannot be edited in preparation.' }, 409);
      const team = await activeTeam(db, offer.seasonId, parsed.data.teamId);
      if (!team) return json({ error: 'Active team not found for this season.' }, 400);
      if (offer.teamId === team.id && offer.acceptanceDeadline === parsed.data.acceptanceDeadline) return json({ offer, unchanged: true });
      const now = new Date().toISOString();
      const [updated] = await db.transaction(async (tx) => {
        const rows = await tx.update(clubSeasonOffers).set({ teamId: team.id, acceptanceDeadline: parsed.data.acceptanceDeadline, updatedAt: now })
          .where(and(eq(clubSeasonOffers.id, offer.id), inArray(clubSeasonOffers.status, [...PREPARATION_STATUSES]))).returning();
        if (rows[0]) await tx.insert(clubSeasonAdminAuditLog).values(auditValues(user.id, 'offer_preparation_corrected', offer.id, offer, rows[0]));
        return rows;
      });
      if (!updated) return json({ error: 'Offer state changed before the edit completed.' }, 409);
      return json({ offer: updated });
    }

    if (offer.status === 'registration_started' || offer.status === 'accepted' || PREPARATION_STATUSES.includes(offer.status as typeof PREPARATION_STATUSES[number])) {
      return json({ error: 'This offer cannot be revoked or restored here.' }, 409);
    }
    if (parsed.data.action === 'restore' && offer.status !== 'revoked') return json({ error: 'Only revoked offers can be restored.' }, 409);
    if (parsed.data.action === 'revoke' && !['offered', 'declined'].includes(offer.status)) return json({ error: 'Only released offers can be revoked.' }, 409);
    const status = parsed.data.action === 'revoke' ? 'revoked' : 'offered';
    const now = new Date().toISOString();
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(clubSeasonOffers).set({ status, respondedAt: status === 'revoked' ? now : null, updatedAt: now })
        .where(and(eq(clubSeasonOffers.id, offer.id), eq(clubSeasonOffers.status, offer.status))).returning();
      if (rows[0]) await tx.insert(clubSeasonAdminAuditLog).values(auditValues(user.id, parsed.data.action === 'revoke' ? 'offer_revoked' : 'offer_restored', offer.id, offer, rows[0]));
      return rows;
    });
    if (!updated) return json({ error: 'Offer state changed before the update completed.' }, 409);
    return json({ offer: updated });
  } catch (error) {
    console.error('Update club season offer error:', error);
    return json({ error: 'Unable to update the offer.' }, 500);
  }
};
