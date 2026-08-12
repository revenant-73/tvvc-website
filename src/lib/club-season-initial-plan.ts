import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index.ts';
import {
  athletes,
  clubAgeGroups,
  clubPricingTiers,
  clubSeasonAdminAuditLog,
  clubSeasonOffers,
  clubSeasonPaymentInstallments,
  clubSeasonPaymentPlans,
  clubSeasonPaymentPlanVersions,
  clubSeasonRegistrations,
  clubTeams,
  registrations,
} from '../db/schema.ts';
import { hashClubSeasonPaymentTerms, type ClubSeasonPaymentTerms } from './club-season-payment.ts';

type Db = ReturnType<typeof getDb>;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const proposeInitialPlanSchema = z.object({
  action: z.literal('propose_initial_plan'),
  registrationId: z.string().trim().min(1).max(100),
  dueNowAmount: z.number().int().positive().max(2_000_000),
  charges: z.array(z.object({
    dueDate: z.string().regex(datePattern),
    amount: z.number().int().positive().max(2_000_000),
  }).strict()).min(1).max(18),
  reason: z.string().trim().min(3).max(240),
  adminNote: z.string().trim().max(1000).optional(),
}).strict();

export const cancelInitialPlanSchema = z.object({
  action: z.literal('cancel_initial_plan'),
  proposalId: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(3).max(240),
}).strict();

export type InitialCustomCharge = { sequence: number; type: 'installment'; dueDate: string; amount: number };

export type InitialCustomPlanSnapshot = {
  kind: 'initial_custom_plan';
  currency: 'usd';
  seasonTotal: number;
  dueNowAmount: number;
  proposedOn: string;
  reason: string;
  adminNote: string | null;
  charges: InitialCustomCharge[];
};

export function normalizeInitialCustomCharges(
  charges: Array<{ dueDate: string; amount: number }>,
  today: string,
  seasonTotal: number,
  dueNowAmount: number
): InitialCustomCharge[] {
  if (!Number.isInteger(seasonTotal) || seasonTotal <= 0) throw new Error('INVALID_SEASON_TOTAL');
  if (!Number.isInteger(dueNowAmount) || dueNowAmount <= 0 || dueNowAmount >= seasonTotal) {
    throw new Error('INVALID_DUE_NOW_AMOUNT');
  }
  const normalized = charges.map((charge, index) => ({
    sequence: index + 1,
    type: 'installment' as const,
    dueDate: charge.dueDate,
    amount: charge.amount,
  }));
  if (new Set(normalized.map((charge) => charge.dueDate)).size !== normalized.length) {
    throw new Error('DUPLICATE_DUE_DATE');
  }
  if (normalized.some((charge) => charge.dueDate <= today)) throw new Error('DUE_DATE_NOT_FUTURE');
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].dueDate <= normalized[index - 1].dueDate) throw new Error('DUE_DATES_NOT_ASCENDING');
  }
  const scheduledTotal = normalized.reduce((sum, charge) => sum + charge.amount, 0);
  if (dueNowAmount + scheduledTotal !== seasonTotal) throw new Error('INITIAL_PLAN_TOTAL_MISMATCH');
  return normalized;
}

export function initialPlanAuthorizationText(terms: ClubSeasonPaymentTerms): string {
  const schedule = terms.charges
    .filter((charge) => charge.type === 'installment')
    .map((charge) => `${charge.dueDate}: $${(charge.amount / 100).toFixed(2)}`)
    .join('; ');
  return `I authorize Tualatin Valley Volleyball Club to charge $${(terms.dueNowAmount / 100).toFixed(2)} at checkout and to charge my saved payment method automatically for the remaining $${((terms.totalAmount - terms.dueNowAmount) / 100).toFixed(2)} according to this schedule: ${schedule}. I understand that Stripe securely stores the payment method, that TVVC will initiate these charges automatically, and that a failed payment does not automatically remove the player from the team or cancel the registration.`;
}

export function initialPlanTermsFromSnapshot(snapshot: InitialCustomPlanSnapshot): ClubSeasonPaymentTerms {
  return {
    paymentOption: 'custom_plan',
    totalAmount: snapshot.seasonTotal,
    dueNowAmount: snapshot.dueNowAmount,
    currency: 'usd',
    billingDay: null,
    charges: [
      { sequence: 0, type: 'deposit', dueDate: snapshot.proposedOn, amount: snapshot.dueNowAmount },
      ...snapshot.charges,
    ],
  };
}

export async function getInitialPlanCandidates(db: Db, seasonId: string) {
  const rows = await db.select({
    registration: clubSeasonRegistrations,
    playerFirstName: athletes.firstName,
    playerLastName: athletes.lastName,
    parentName: registrations.parentName,
    parentEmail: registrations.parentEmail,
    teamName: clubTeams.name,
    seasonTotal: clubPricingTiers.totalAmount,
    standardDeposit: clubPricingTiers.depositAmount,
    plan: clubSeasonPaymentPlans,
  }).from(clubSeasonRegistrations)
    .innerJoin(clubSeasonOffers, eq(clubSeasonRegistrations.offerId, clubSeasonOffers.id))
    .innerJoin(athletes, eq(clubSeasonOffers.sourceAthleteId, athletes.id))
    .innerJoin(registrations, eq(clubSeasonOffers.sourceRegistrationId, registrations.id))
    .innerJoin(clubTeams, eq(clubSeasonRegistrations.teamId, clubTeams.id))
    .innerJoin(clubAgeGroups, eq(clubTeams.ageGroupId, clubAgeGroups.id))
    .innerJoin(clubPricingTiers, eq(clubAgeGroups.pricingTierId, clubPricingTiers.id))
    .leftJoin(clubSeasonPaymentPlans, eq(clubSeasonRegistrations.id, clubSeasonPaymentPlans.registrationId))
    .where(and(
      eq(clubSeasonRegistrations.seasonId, seasonId),
      eq(clubSeasonRegistrations.status, 'awaiting_payment'),
      sql`(${clubSeasonPaymentPlans.id} IS NULL OR ${clubSeasonPaymentPlans.status} IN ('custom_pending_authorization', 'custom_cancelled'))`
    ));
  const planIds = rows.flatMap((row) => row.plan?.id ? [row.plan.id] : []);
  const versions = planIds.length ? await db.select().from(clubSeasonPaymentPlanVersions)
    .where(inArray(clubSeasonPaymentPlanVersions.paymentPlanId, planIds)) : [];
  const currentByPlan = new Map(versions.map((version) => [`${version.paymentPlanId}:${version.version}`, version]));
  return rows.map((row) => {
    const version = row.plan ? currentByPlan.get(`${row.plan.id}:${row.plan.currentVersion}`) : undefined;
    let pendingInitialPlan = null;
    if (version?.paymentOption === 'custom_plan' && version.status === 'pending_authorization') {
      const snapshot = JSON.parse(version.scheduleSnapshot) as InitialCustomPlanSnapshot;
      const terms = initialPlanTermsFromSnapshot(snapshot);
      pendingInitialPlan = {
        proposalId: version.id,
        versionId: version.id,
        termsFingerprint: version.termsFingerprint,
        dueNowAmount: snapshot.dueNowAmount,
        charges: snapshot.charges,
        reason: snapshot.reason,
        adminNote: snapshot.adminNote,
        status: version.status,
        authorizationText: initialPlanAuthorizationText(terms),
      };
    }
    return {
      registrationId: row.registration.id,
      playerName: `${row.playerFirstName} ${row.playerLastName}`.trim(),
      parentName: row.parentName,
      parentEmail: row.parentEmail,
      teamName: row.teamName,
      seasonTotal: row.seasonTotal,
      standardDeposit: row.standardDeposit,
      pendingInitialPlan,
    };
  });
}

export async function getPendingInitialPlan(db: Db, registrationId: string) {
  const [row] = await db.select({ plan: clubSeasonPaymentPlans, version: clubSeasonPaymentPlanVersions })
    .from(clubSeasonPaymentPlans)
    .innerJoin(clubSeasonPaymentPlanVersions, and(
      eq(clubSeasonPaymentPlanVersions.paymentPlanId, clubSeasonPaymentPlans.id),
      eq(clubSeasonPaymentPlanVersions.version, clubSeasonPaymentPlans.currentVersion)
    ))
    .where(and(
      eq(clubSeasonPaymentPlans.registrationId, registrationId),
      inArray(clubSeasonPaymentPlans.status, ['custom_pending_authorization', 'pending_checkout', 'checkout_open']),
      eq(clubSeasonPaymentPlanVersions.paymentOption, 'custom_plan'),
      inArray(clubSeasonPaymentPlanVersions.status, ['pending_authorization', 'pending_checkout'])
    )).limit(1);
  if (!row) return null;
  const snapshot = JSON.parse(row.version.scheduleSnapshot) as InitialCustomPlanSnapshot;
  const terms = initialPlanTermsFromSnapshot(snapshot);
  return {
    plan: row.plan,
    version: row.version,
    snapshot,
    terms,
    authorizationText: initialPlanAuthorizationText(terms),
  };
}

export async function proposeInitialCustomPlan(db: Db, input: {
  registrationId: string;
  dueNowAmount: number;
  charges: Array<{ dueDate: string; amount: number }>;
  reason: string;
  adminNote?: string;
  today: string;
  adminUserId: string;
}) {
  const candidates = await getInitialPlanCandidatesForRegistration(db, input.registrationId);
  const candidate = candidates[0];
  if (!candidate) throw new Error('REGISTRATION_NOT_ELIGIBLE');
  if (candidate.pendingInitialPlan) throw new Error('INITIAL_PLAN_ALREADY_PENDING');
  const charges = normalizeInitialCustomCharges(input.charges, input.today, candidate.seasonTotal, input.dueNowAmount);
  const snapshot: InitialCustomPlanSnapshot = {
    kind: 'initial_custom_plan', currency: 'usd', seasonTotal: candidate.seasonTotal,
    dueNowAmount: input.dueNowAmount, proposedOn: input.today, reason: input.reason,
    adminNote: input.adminNote?.trim() || null, charges,
  };
  const terms = initialPlanTermsFromSnapshot(snapshot);
  const fingerprint = await hashClubSeasonPaymentTerms(terms);
  const now = new Date().toISOString();
  const versionId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    let [plan] = await tx.select().from(clubSeasonPaymentPlans)
      .where(eq(clubSeasonPaymentPlans.registrationId, input.registrationId)).limit(1);
    let nextVersion = 1;
    if (!plan) {
      [plan] = await tx.insert(clubSeasonPaymentPlans).values({
        id: crypto.randomUUID(), registrationId: input.registrationId,
        ownerUserId: candidate.ownerUserId, status: 'custom_pending_authorization',
        financialStatus: 'not_started', currentVersion: 1, createdAt: now, updatedAt: now,
      }).returning();
    } else {
      if (plan.status !== 'custom_cancelled') throw new Error('INITIAL_PLAN_ALREADY_PENDING');
      const [latest] = await tx.select({ version: sql<number>`max(${clubSeasonPaymentPlanVersions.version})` })
        .from(clubSeasonPaymentPlanVersions).where(eq(clubSeasonPaymentPlanVersions.paymentPlanId, plan.id));
      nextVersion = Number(latest?.version || 0) + 1;
      await tx.update(clubSeasonPaymentPlans).set({
        status: 'custom_pending_authorization', currentVersion: nextVersion, updatedAt: now,
      }).where(eq(clubSeasonPaymentPlans.id, plan.id));
    }
    await tx.insert(clubSeasonPaymentPlanVersions).values({
      id: versionId, paymentPlanId: plan.id, version: nextVersion, paymentOption: 'custom_plan',
      status: 'pending_authorization', totalAmount: candidate.seasonTotal,
      dueNowAmount: input.dueNowAmount, currency: 'usd', billingDay: null,
      scheduleSnapshot: JSON.stringify(snapshot), termsFingerprint: fingerprint, createdAt: now, updatedAt: now,
    });
    await tx.insert(clubSeasonPaymentInstallments).values(terms.charges.map((charge) => ({
      id: crypto.randomUUID(), paymentPlanVersionId: versionId, sequence: charge.sequence,
      type: charge.type, dueDate: charge.dueDate, amount: charge.amount,
      status: 'pending_authorization', createdAt: now, updatedAt: now,
    })));
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId,
      action: 'initial_payment_plan_proposed', entityType: 'payment_plan', entityId: plan.id,
      reason: input.reason, beforeSnapshot: null,
      afterSnapshot: JSON.stringify({ versionId, version: nextVersion, snapshot }), createdAt: now,
    });
  });
  return { proposalId: versionId, versionId, termsFingerprint: fingerprint, terms, reason: input.reason };
}

async function getInitialPlanCandidatesForRegistration(db: Db, registrationId: string) {
  const [registration] = await db.select({ seasonId: clubSeasonRegistrations.seasonId, ownerUserId: clubSeasonRegistrations.ownerUserId })
    .from(clubSeasonRegistrations).where(eq(clubSeasonRegistrations.id, registrationId)).limit(1);
  if (!registration) return [];
  return (await getInitialPlanCandidates(db, registration.seasonId))
    .filter((candidate) => candidate.registrationId === registrationId)
    .map((candidate) => ({ ...candidate, ownerUserId: registration.ownerUserId }));
}

export async function cancelInitialCustomPlan(db: Db, input: {
  proposalId: string;
  reason: string;
  adminUserId: string;
}) {
  const [version] = await db.select().from(clubSeasonPaymentPlanVersions).where(and(
    eq(clubSeasonPaymentPlanVersions.id, input.proposalId),
    eq(clubSeasonPaymentPlanVersions.paymentOption, 'custom_plan'),
    eq(clubSeasonPaymentPlanVersions.status, 'pending_authorization')
  )).limit(1);
  if (!version) throw new Error('INITIAL_PLAN_NOT_PENDING');
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const [claimed] = await tx.update(clubSeasonPaymentPlanVersions).set({ status: 'cancelled', updatedAt: now })
      .where(and(eq(clubSeasonPaymentPlanVersions.id, version.id), eq(clubSeasonPaymentPlanVersions.status, 'pending_authorization')))
      .returning({ id: clubSeasonPaymentPlanVersions.id });
    if (!claimed) throw new Error('INITIAL_PLAN_NOT_PENDING');
    await tx.update(clubSeasonPaymentInstallments).set({ status: 'cancelled', updatedAt: now })
      .where(eq(clubSeasonPaymentInstallments.paymentPlanVersionId, version.id));
    await tx.update(clubSeasonPaymentPlans).set({ status: 'custom_cancelled', updatedAt: now })
      .where(and(
        eq(clubSeasonPaymentPlans.id, version.paymentPlanId),
        eq(clubSeasonPaymentPlans.currentVersion, version.version),
        eq(clubSeasonPaymentPlans.status, 'custom_pending_authorization')
      ));
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId,
      action: 'initial_payment_plan_cancelled', entityType: 'payment_plan_version', entityId: version.id,
      reason: input.reason, beforeSnapshot: JSON.stringify({ status: 'pending_authorization' }),
      afterSnapshot: JSON.stringify({ status: 'cancelled' }), createdAt: now,
    });
  });
  return { proposalId: version.id, status: 'cancelled' };
}
