import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../db/db';
import {
  athletes,
  householdGuardians,
  playerProfiles,
  registrations,
  users,
} from '../db/schema';

type SessionUser = {
  id?: unknown;
  email?: string | null;
};

export type CanonicalPortalUser = {
  id: string;
  email: string;
  stripeCustomerId: string | null;
  emergencyPhone: string | null;
};

export type PortalAccessContext = {
  user: CanonicalPortalUser;
  readableOwnerIds: string[];
  sharedOwnerIds: string[];
};

/**
 * Claims pre-portal purchases for a verified primary parent account, then
 * returns the canonical user identity used for all authorization checks.
 *
 * A legacy row is claimable only while registration.userId is NULL. Once a
 * registration belongs to an account, matching email text can never transfer
 * it to another account.
 */
export async function ensureCanonicalPortalUser(
  sessionUser: SessionUser
): Promise<CanonicalPortalUser | null> {
  if (!db) return null;

  const userId = typeof sessionUser.id === 'string' ? sessionUser.id.trim() : '';
  const normalizedEmail = sessionUser.email?.trim().toLowerCase() || '';
  if (!userId || !normalizedEmail) return null;

  const [account] = await db.select({
    id: users.id,
    email: users.email,
    emailVerified: users.emailVerified,
    stripeCustomerId: users.stripeCustomerId,
    emergencyPhone: users.emergencyPhone,
  })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (
    !account?.emailVerified ||
    account.email.trim().toLowerCase() !== normalizedEmail
  ) {
    return null;
  }

  return db.transaction(async (tx) => {
    const legacyRegistrations = await tx.select({ id: registrations.id })
      .from(registrations)
      .where(and(
        isNull(registrations.userId),
        sql`lower(trim(${registrations.parentEmail})) = ${normalizedEmail}`
      ));

    const legacyIds = legacyRegistrations.map((registration) => registration.id);

    if (legacyIds.length > 0) {
      const unlinkedSnapshots = await tx.select()
        .from(athletes)
        .where(and(
          isNull(athletes.profileId),
          inArray(athletes.registrationId, legacyIds)
        ));

      for (const snapshot of unlinkedSnapshots) {
        const [profile] = await tx.insert(playerProfiles).values({
          parentId: account.id,
          firstName: snapshot.firstName,
          lastName: snapshot.lastName,
          preferredName: snapshot.preferredName,
          dateOfBirth: snapshot.dateOfBirth,
          gender: snapshot.gender,
          grade: snapshot.grade,
          school: snapshot.school,
          gradYear: snapshot.gradYear,
          division: snapshot.division,
          tshirtSize: snapshot.tshirtSize,
          jerseySize: snapshot.jerseySize,
          experience: snapshot.experience,
          positions: snapshot.positions,
          medicalInfo: snapshot.medicalInfo,
          metadata: snapshot.metadata,
        }).returning({ id: playerProfiles.id });

        if (!profile) {
          throw new Error('Failed to create a player profile for a legacy registration.');
        }

        await tx.update(athletes)
          .set({
            parentId: account.id,
            profileId: profile.id,
          })
          .where(eq(athletes.id, snapshot.id));
      }

      await tx.update(registrations)
        .set({ userId: account.id })
        .where(and(
          isNull(registrations.userId),
          inArray(registrations.id, legacyIds)
        ));

      await tx.update(athletes)
        .set({ parentId: account.id })
        .where(and(
          isNull(athletes.parentId),
          inArray(athletes.registrationId, legacyIds)
        ));
    }

    let stripeCustomerId = account.stripeCustomerId;
    if (!stripeCustomerId) {
      const [paidRegistration] = await tx.select({
        stripeCustomerId: registrations.stripeCustomerId,
      })
        .from(registrations)
        .where(and(
          eq(registrations.userId, account.id),
          eq(registrations.status, 'paid'),
          isNotNull(registrations.stripeCustomerId)
        ))
        .orderBy(desc(registrations.createdAt))
        .limit(1);

      stripeCustomerId = paidRegistration?.stripeCustomerId || null;

      if (stripeCustomerId) {
        await tx.update(users)
          .set({ stripeCustomerId })
          .where(and(
            eq(users.id, account.id),
            isNull(users.stripeCustomerId)
          ));
      }
    }

    return {
      id: account.id,
      email: account.email,
      stripeCustomerId,
      emergencyPhone: account.emergencyPhone,
    };
  });
}

/**
 * Activates pending invitations only after the invited email has completed a
 * verified portal sign-in, then returns the household owners this account may
 * view. Shared access is intentionally read-only; write APIs continue to
 * authorize against ensureCanonicalPortalUser().id.
 */
export async function ensurePortalAccessContext(
  sessionUser: SessionUser
): Promise<PortalAccessContext | null> {
  const user = await ensureCanonicalPortalUser(sessionUser);
  if (!user || !db) return null;

  const normalizedEmail = user.email.trim().toLowerCase();
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    await tx.update(householdGuardians)
      .set({
        guardianUserId: user.id,
        status: 'active',
        acceptedAt: now,
        revokedAt: null,
        updatedAt: now,
      })
      .where(and(
        eq(householdGuardians.guardianEmail, normalizedEmail),
        eq(householdGuardians.status, 'pending'),
        isNull(householdGuardians.revokedAt)
      ));

    const sharedHouseholds = await tx.select({
      ownerUserId: householdGuardians.ownerUserId,
    })
      .from(householdGuardians)
      .where(and(
        eq(householdGuardians.guardianUserId, user.id),
        eq(householdGuardians.status, 'active'),
        isNull(householdGuardians.revokedAt)
      ));

    const sharedOwnerIds = Array.from(new Set(
      sharedHouseholds
        .map((access) => access.ownerUserId)
        .filter((ownerId) => ownerId !== user.id)
    ));

    return {
      user,
      sharedOwnerIds,
      readableOwnerIds: [user.id, ...sharedOwnerIds],
    };
  });
}
