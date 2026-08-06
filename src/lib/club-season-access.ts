import { and, eq } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';
import { db } from '../db/db';
import {
  athletes,
  clubAgeGroups,
  clubPricingTiers,
  clubSeasonOffers,
  clubSeasonRegistrations,
  clubSeasons,
  clubTeams,
  registrations,
} from '../db/schema';
import { ensureCanonicalPortalUser } from './portal-ownership';

export type OwnedClubSeasonOffer = Awaited<ReturnType<typeof getOwnedClubSeasonOffers>>[number];

export async function getVerifiedClubSeasonUser(request: Request) {
  const session = await getSession(request);
  return ensureCanonicalPortalUser(session?.user || {});
}

/**
 * Resolve offers through the immutable tryout registration ownership chain.
 * Matching email text alone is intentionally insufficient authorization.
 */
export async function getOwnedClubSeasonOffers(request: Request) {
  if (!db) return [];

  const user = await getVerifiedClubSeasonUser(request);
  if (!user) return [];

  return db.select({
    offer: clubSeasonOffers,
    season: clubSeasons,
    team: clubTeams,
    ageGroup: clubAgeGroups,
    pricingTier: clubPricingTiers,
    athlete: athletes,
    draft: clubSeasonRegistrations,
  })
    .from(clubSeasonOffers)
    .innerJoin(clubSeasons, eq(clubSeasonOffers.seasonId, clubSeasons.id))
    .innerJoin(clubTeams, eq(clubSeasonOffers.teamId, clubTeams.id))
    .innerJoin(clubAgeGroups, eq(clubTeams.ageGroupId, clubAgeGroups.id))
    .innerJoin(clubPricingTiers, eq(clubAgeGroups.pricingTierId, clubPricingTiers.id))
    .innerJoin(registrations, eq(clubSeasonOffers.sourceRegistrationId, registrations.id))
    .innerJoin(athletes, eq(clubSeasonOffers.sourceAthleteId, athletes.id))
    .leftJoin(clubSeasonRegistrations, eq(clubSeasonOffers.id, clubSeasonRegistrations.offerId))
    .where(and(
      eq(registrations.userId, user.id),
      eq(athletes.parentId, user.id),
      eq(athletes.registrationId, registrations.id),
      eq(clubSeasonOffers.recipientEmail, user.email.trim().toLowerCase())
    ));
}
