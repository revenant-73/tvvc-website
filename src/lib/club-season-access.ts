import { and, asc, eq, inArray } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';
import { db } from '../db/db';
import {
  athletes,
  clubAgeGroups,
  clubSeasonAgreementVersions,
  clubPricingTiers,
  clubSeasonOffers,
  clubSeasonRegistrations,
  clubSeasons,
  clubTeams,
  registrations,
} from '../db/schema';
import { ensureCanonicalPortalUser } from './portal-ownership';
import { getPendingInitialPlan } from './club-season-initial-plan';

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

  const offers = await db.select({
    offer: clubSeasonOffers,
    season: clubSeasons,
    team: clubTeams,
    ageGroup: clubAgeGroups,
    pricingTier: clubPricingTiers,
    athlete: athletes,
    sourceRegistration: {
      parentName: registrations.parentName,
      parentEmail: registrations.parentEmail,
      parentPhone: registrations.parentPhone,
      secondaryParentName: registrations.secondaryParentName,
      secondaryParentEmail: registrations.secondaryParentEmail,
      secondaryParentPhone: registrations.secondaryParentPhone,
      emergencyPhone: registrations.emergencyPhone,
    },
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
      eq(clubSeasonOffers.recipientEmail, user.email.trim().toLowerCase()),
      // Preparation states are an administrator-only workspace. Keeping this
      // at the shared ownership boundary protects every parent page/API that
      // resolves offers through this helper.
      inArray(clubSeasonOffers.status, [
        'offered',
        'registration_started',
        'accepted',
        'declined',
        'revoked',
      ])
    ));
  return Promise.all(offers.map(async (item) => {
    const custom = item.draft?.status === 'awaiting_payment'
      ? await getPendingInitialPlan(db, item.draft.id)
      : null;
    return {
      ...item,
      customPaymentTerms: custom ? {
        ...custom.terms,
        proposalId: custom.version.id,
        termsFingerprint: custom.version.termsFingerprint,
        reason: custom.snapshot.reason,
        authorizationText: custom.authorizationText,
      } : null,
    };
  }));
}

export async function getPublishedClubSeasonAgreements(seasonId: string) {
  if (!db) return [];

  return db.select().from(clubSeasonAgreementVersions)
    .where(and(
      eq(clubSeasonAgreementVersions.seasonId, seasonId),
      eq(clubSeasonAgreementVersions.status, 'published')
    ))
    .orderBy(asc(clubSeasonAgreementVersions.sortOrder));
}
