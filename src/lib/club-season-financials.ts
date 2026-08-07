import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import {
  athletes,
  clubSeasonAdminAuditLog,
  clubSeasonOffers,
  clubSeasonPaymentAttempts,
  clubSeasonPaymentInstallments,
  clubSeasonPaymentPlanAuthorizations,
  clubSeasonPaymentPlanRevisions,
  clubSeasonPaymentPlans,
  clubSeasonPaymentPlanVersions,
  clubSeasonPaymentTransactions,
  clubSeasonRegistrations,
  clubTeams,
  registrations,
} from '../db/schema.ts';
import {
  hashRevisionTerms,
  normalizeRevisionCharges,
  revisionAuthorizationText,
  revisionSnapshot,
  type RevisionCharge,
} from './club-season-plan-revision.ts';

type Db = ReturnType<typeof getDb>;

export async function getClubSeasonFinancialAccounts(db: Db, seasonId: string) {
  const accounts = await db.select({
    plan: clubSeasonPaymentPlans,
    registration: clubSeasonRegistrations,
    playerFirstName: athletes.firstName,
    playerLastName: athletes.lastName,
    parentName: registrations.parentName,
    parentEmail: registrations.parentEmail,
    teamName: clubTeams.name,
  }).from(clubSeasonPaymentPlans)
    .innerJoin(clubSeasonRegistrations, eq(clubSeasonPaymentPlans.registrationId, clubSeasonRegistrations.id))
    .innerJoin(clubSeasonOffers, eq(clubSeasonRegistrations.offerId, clubSeasonOffers.id))
    .innerJoin(athletes, eq(clubSeasonOffers.sourceAthleteId, athletes.id))
    .innerJoin(registrations, eq(clubSeasonOffers.sourceRegistrationId, registrations.id))
    .innerJoin(clubTeams, eq(clubSeasonRegistrations.teamId, clubTeams.id))
    .where(eq(clubSeasonRegistrations.seasonId, seasonId));
  if (!accounts.length) return [];
  const registrationIds = accounts.map((row) => row.registration.id);
  const planIds = accounts.map((row) => row.plan.id);
  const [versions, totals, revisions] = await Promise.all([
    db.select().from(clubSeasonPaymentPlanVersions).where(inArray(clubSeasonPaymentPlanVersions.paymentPlanId, planIds)),
    db.select({ registrationId: clubSeasonPaymentTransactions.registrationId, paid: sql<number>`coalesce(sum(${clubSeasonPaymentTransactions.amount}), 0)` })
      .from(clubSeasonPaymentTransactions).where(and(
        inArray(clubSeasonPaymentTransactions.registrationId, registrationIds),
        eq(clubSeasonPaymentTransactions.status, 'succeeded')
      )).groupBy(clubSeasonPaymentTransactions.registrationId),
    db.select().from(clubSeasonPaymentPlanRevisions).where(and(
      inArray(clubSeasonPaymentPlanRevisions.paymentPlanId, planIds),
      eq(clubSeasonPaymentPlanRevisions.status, 'pending_authorization')
    )),
  ]);
  const paidByRegistration = new Map(totals.map((row) => [row.registrationId, Number(row.paid)]));
  const versionByPlanAndNumber = new Map(versions.map((version) => [`${version.paymentPlanId}:${version.version}`, version]));
  const revisionByPlan = new Map(revisions.map((revision) => [revision.paymentPlanId, revision]));
  return accounts.map((row) => {
    const currentVersion = versionByPlanAndNumber.get(`${row.plan.id}:${row.plan.currentVersion}`);
    const seasonTotal = currentVersion?.totalAmount || 0;
    const paidAmount = paidByRegistration.get(row.registration.id) || 0;
    return {
      registrationId: row.registration.id,
      planId: row.plan.id,
      playerName: `${row.playerFirstName} ${row.playerLastName}`.trim(),
      parentName: row.parentName,
      parentEmail: row.parentEmail,
      teamName: row.teamName,
      registrationStatus: row.registration.status,
      planStatus: row.plan.status,
      financialStatus: row.plan.financialStatus,
      needsReview: row.plan.needsReview,
      currentVersion: row.plan.currentVersion,
      paymentOption: currentVersion?.paymentOption || null,
      seasonTotal,
      paidAmount,
      remainingBalance: Math.max(0, seasonTotal - paidAmount),
      pendingRevisionId: revisionByPlan.get(row.plan.id)?.id || null,
    };
  });
}

export async function getClubSeasonFinancialAccount(db: Db, registrationId: string) {
  const accounts = await getClubSeasonFinancialAccountsForRegistration(db, registrationId);
  const account = accounts[0];
  if (!account) return null;
  const versions = await db.select().from(clubSeasonPaymentPlanVersions)
    .where(eq(clubSeasonPaymentPlanVersions.paymentPlanId, account.planId)).orderBy(asc(clubSeasonPaymentPlanVersions.version));
  const versionIds = versions.map((version) => version.id);
  const [installments, transactions, attempts, revisions] = await Promise.all([
    db.select().from(clubSeasonPaymentInstallments).where(inArray(clubSeasonPaymentInstallments.paymentPlanVersionId, versionIds)).orderBy(asc(clubSeasonPaymentInstallments.dueDate)),
    db.select().from(clubSeasonPaymentTransactions).where(eq(clubSeasonPaymentTransactions.registrationId, registrationId)).orderBy(asc(clubSeasonPaymentTransactions.processedAt)),
    db.select().from(clubSeasonPaymentAttempts).where(eq(clubSeasonPaymentAttempts.registrationId, registrationId)).orderBy(asc(clubSeasonPaymentAttempts.attemptedAt)),
    db.select().from(clubSeasonPaymentPlanRevisions).where(eq(clubSeasonPaymentPlanRevisions.registrationId, registrationId)).orderBy(asc(clubSeasonPaymentPlanRevisions.proposedAt)),
  ]);
  return { ...account, versions, installments, transactions, attempts, revisions };
}

async function getClubSeasonFinancialAccountsForRegistration(db: Db, registrationId: string) {
  const [registration] = await db.select({ seasonId: clubSeasonRegistrations.seasonId })
    .from(clubSeasonRegistrations).where(eq(clubSeasonRegistrations.id, registrationId)).limit(1);
  if (!registration) return [];
  return (await getClubSeasonFinancialAccounts(db, registration.seasonId)).filter((account) => account.registrationId === registrationId);
}

export async function proposeClubSeasonPlanRevision(db: Db, input: {
  paymentPlanId: string; reason: string; adminNote?: string; charges: Array<{ dueDate: string; amount: number }>;
  today: string; adminUserId: string;
}) {
  const [plan] = await db.select().from(clubSeasonPaymentPlans).where(eq(clubSeasonPaymentPlans.id, input.paymentPlanId)).limit(1);
  if (!plan || plan.status !== 'active') throw new Error('PLAN_NOT_ACTIVE');
  const [currentVersion] = await db.select().from(clubSeasonPaymentPlanVersions).where(and(
    eq(clubSeasonPaymentPlanVersions.paymentPlanId, plan.id),
    eq(clubSeasonPaymentPlanVersions.version, plan.currentVersion),
    eq(clubSeasonPaymentPlanVersions.status, 'active')
  )).limit(1);
  if (!currentVersion) throw new Error('CURRENT_VERSION_NOT_ACTIVE');
  const [pendingRevision] = await db.select({ id: clubSeasonPaymentPlanRevisions.id }).from(clubSeasonPaymentPlanRevisions).where(and(
    eq(clubSeasonPaymentPlanRevisions.paymentPlanId, plan.id),
    eq(clubSeasonPaymentPlanRevisions.status, 'pending_authorization')
  )).limit(1);
  if (pendingRevision) throw new Error('REVISION_ALREADY_PENDING');
  const [processing] = await db.select({ id: clubSeasonPaymentInstallments.id }).from(clubSeasonPaymentInstallments).where(and(
    eq(clubSeasonPaymentInstallments.paymentPlanVersionId, currentVersion.id),
    eq(clubSeasonPaymentInstallments.status, 'processing')
  )).limit(1);
  if (processing) throw new Error('PAYMENT_PROCESSING');
  const [paid] = await db.select({ amount: sql<number>`coalesce(sum(${clubSeasonPaymentTransactions.amount}), 0)` })
    .from(clubSeasonPaymentTransactions).where(and(
      eq(clubSeasonPaymentTransactions.registrationId, plan.registrationId),
      eq(clubSeasonPaymentTransactions.status, 'succeeded')
    ));
  const paidAmount = Number(paid?.amount || 0);
  const remainingBalance = currentVersion.totalAmount - paidAmount;
  const charges = normalizeRevisionCharges(input.charges, input.today, remainingBalance);
  const [latest] = await db.select({ version: sql<number>`max(${clubSeasonPaymentPlanVersions.version})` })
    .from(clubSeasonPaymentPlanVersions).where(eq(clubSeasonPaymentPlanVersions.paymentPlanId, plan.id));
  const nextVersion = Number(latest?.version || 0) + 1;
  const snapshot = revisionSnapshot({ seasonTotal: currentVersion.totalAmount, paidAmount, remainingBalance,
    supersedesVersion: currentVersion.version, charges });
  const fingerprint = await hashRevisionTerms(snapshot);
  const now = new Date().toISOString();
  const versionId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(clubSeasonPaymentPlanVersions).values({
      id: versionId, paymentPlanId: plan.id, version: nextVersion, paymentOption: 'custom_plan',
      status: 'pending_authorization', totalAmount: currentVersion.totalAmount, dueNowAmount: 0, currency: 'usd',
      billingDay: null, scheduleSnapshot: JSON.stringify(snapshot), termsFingerprint: fingerprint,
      createdAt: now, updatedAt: now,
    });
    await tx.insert(clubSeasonPaymentInstallments).values(charges.map((charge) => ({
      id: crypto.randomUUID(), paymentPlanVersionId: versionId, ...charge,
      status: 'pending_authorization', createdAt: now, updatedAt: now,
    })));
    await tx.insert(clubSeasonPaymentPlanRevisions).values({
      id: revisionId, registrationId: plan.registrationId, paymentPlanId: plan.id,
      fromVersionId: currentVersion.id, proposedVersionId: versionId, status: 'pending_authorization',
      reason: input.reason, adminNote: input.adminNote || null, proposedByUserId: input.adminUserId,
      proposedAt: now, createdAt: now, updatedAt: now,
    });
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId, action: 'payment_plan_revision_proposed',
      entityType: 'payment_plan', entityId: plan.id, reason: input.reason,
      beforeSnapshot: JSON.stringify({ versionId: currentVersion.id, version: currentVersion.version, paidAmount, remainingBalance }),
      afterSnapshot: JSON.stringify({ revisionId, versionId, version: nextVersion, snapshot }), createdAt: now,
    });
  });
  return { revisionId, registrationId: plan.registrationId, versionId, version: nextVersion, fingerprint, remainingBalance, charges };
}

export async function cancelClubSeasonPlanRevision(db: Db, input: { revisionId: string; reason: string; adminUserId: string }) {
  const [revision] = await db.select().from(clubSeasonPaymentPlanRevisions).where(and(
    eq(clubSeasonPaymentPlanRevisions.id, input.revisionId),
    eq(clubSeasonPaymentPlanRevisions.status, 'pending_authorization')
  )).limit(1);
  if (!revision) throw new Error('REVISION_NOT_PENDING');
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(clubSeasonPaymentPlanRevisions).set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
      .where(eq(clubSeasonPaymentPlanRevisions.id, revision.id));
    await tx.update(clubSeasonPaymentPlanVersions).set({ status: 'cancelled', updatedAt: now })
      .where(eq(clubSeasonPaymentPlanVersions.id, revision.proposedVersionId));
    await tx.update(clubSeasonPaymentInstallments).set({ status: 'cancelled', updatedAt: now })
      .where(eq(clubSeasonPaymentInstallments.paymentPlanVersionId, revision.proposedVersionId));
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId, action: 'payment_plan_revision_cancelled',
      entityType: 'payment_plan_revision', entityId: revision.id, reason: input.reason,
      beforeSnapshot: JSON.stringify({ status: revision.status }), afterSnapshot: JSON.stringify({ status: 'cancelled' }), createdAt: now,
    });
  });
  return { revisionId: revision.id, status: 'cancelled' };
}

export async function reviewClubSeasonPlanRevision(db: Db, input: {
  revisionId: string; ownerUserId: string; ownerEmail: string; action: 'authorize' | 'decline';
  authorizedName?: string; termsFingerprint?: string; requestIpHash?: string | null; userAgent?: string | null;
}) {
  const [revision] = await db.select().from(clubSeasonPaymentPlanRevisions).where(and(
    eq(clubSeasonPaymentPlanRevisions.id, input.revisionId),
    eq(clubSeasonPaymentPlanRevisions.status, 'pending_authorization')
  )).limit(1);
  if (!revision) throw new Error('REVISION_NOT_PENDING');
  const [plan] = await db.select().from(clubSeasonPaymentPlans).where(and(
    eq(clubSeasonPaymentPlans.id, revision.paymentPlanId), eq(clubSeasonPaymentPlans.ownerUserId, input.ownerUserId)
  )).limit(1);
  if (!plan) throw new Error('REVISION_NOT_FOUND');
  const [baseVersion, proposedVersion] = await Promise.all([
    db.select().from(clubSeasonPaymentPlanVersions).where(eq(clubSeasonPaymentPlanVersions.id, revision.fromVersionId)).limit(1).then((rows) => rows[0]),
    db.select().from(clubSeasonPaymentPlanVersions).where(eq(clubSeasonPaymentPlanVersions.id, revision.proposedVersionId)).limit(1).then((rows) => rows[0]),
  ]);
  if (!baseVersion || !proposedVersion || proposedVersion.status !== 'pending_authorization') throw new Error('REVISION_STALE');
  const now = new Date().toISOString();
  if (input.action === 'decline') {
    await db.transaction(async (tx) => {
      await tx.update(clubSeasonPaymentPlanRevisions).set({ status: 'declined', reviewedAt: now, updatedAt: now }).where(eq(clubSeasonPaymentPlanRevisions.id, revision.id));
      await tx.update(clubSeasonPaymentPlanVersions).set({ status: 'declined', updatedAt: now }).where(eq(clubSeasonPaymentPlanVersions.id, proposedVersion.id));
      await tx.update(clubSeasonPaymentInstallments).set({ status: 'cancelled', updatedAt: now }).where(eq(clubSeasonPaymentInstallments.paymentPlanVersionId, proposedVersion.id));
    });
    return { status: 'declined' };
  }
  if (plan.currentVersion !== baseVersion.version || baseVersion.status !== 'active') throw new Error('REVISION_STALE');
  if (input.termsFingerprint !== proposedVersion.termsFingerprint) throw new Error('TERMS_CHANGED');
  const [processing] = await db.select({ id: clubSeasonPaymentInstallments.id }).from(clubSeasonPaymentInstallments).where(and(
    eq(clubSeasonPaymentInstallments.paymentPlanVersionId, baseVersion.id), eq(clubSeasonPaymentInstallments.status, 'processing')
  )).limit(1);
  if (processing) throw new Error('PAYMENT_PROCESSING');
  const [unresolvedIntent] = await db.select({ id: clubSeasonPaymentInstallments.id }).from(clubSeasonPaymentInstallments).where(and(
    eq(clubSeasonPaymentInstallments.paymentPlanVersionId, baseVersion.id),
    inArray(clubSeasonPaymentInstallments.status, ['past_due', 'action_required']),
    sql`${clubSeasonPaymentInstallments.stripePaymentIntentId} IS NOT NULL`
  )).limit(1);
  if (unresolvedIntent) throw new Error('PAYMENT_ATTEMPT_UNRESOLVED');
  const snapshot = JSON.parse(proposedVersion.scheduleSnapshot) as { remainingBalance: number; charges: RevisionCharge[] };
  const [paid] = await db.select({ amount: sql<number>`coalesce(sum(${clubSeasonPaymentTransactions.amount}), 0)` })
    .from(clubSeasonPaymentTransactions).where(and(eq(clubSeasonPaymentTransactions.registrationId, plan.registrationId), eq(clubSeasonPaymentTransactions.status, 'succeeded')));
  if (proposedVersion.totalAmount - Number(paid?.amount || 0) !== snapshot.remainingBalance) throw new Error('BALANCE_CHANGED');
  const authorizationText = revisionAuthorizationText(snapshot.charges, snapshot.remainingBalance);
  const authorizationHash = await hashRevisionTerms({ authorizationText, termsFingerprint: proposedVersion.termsFingerprint });
  await db.transaction(async (tx) => {
    const [processingAtActivation] = await tx.select({ id: clubSeasonPaymentInstallments.id }).from(clubSeasonPaymentInstallments).where(and(
      eq(clubSeasonPaymentInstallments.paymentPlanVersionId, baseVersion.id),
      inArray(clubSeasonPaymentInstallments.status, ['processing', 'past_due', 'action_required']),
      sql`${clubSeasonPaymentInstallments.stripePaymentIntentId} IS NOT NULL`
    )).limit(1);
    if (processingAtActivation) throw new Error('PAYMENT_ATTEMPT_UNRESOLVED');
    const [claimed] = await tx.update(clubSeasonPaymentPlanRevisions).set({ status: 'accepted', reviewedAt: now, updatedAt: now })
      .where(and(eq(clubSeasonPaymentPlanRevisions.id, revision.id), eq(clubSeasonPaymentPlanRevisions.status, 'pending_authorization'))).returning({ id: clubSeasonPaymentPlanRevisions.id });
    if (!claimed) throw new Error('REVISION_STALE');
    await tx.insert(clubSeasonPaymentPlanAuthorizations).values({
      id: crypto.randomUUID(), paymentPlanVersionId: proposedVersion.id, ownerUserId: input.ownerUserId,
      authorizationText, authorizationContentHash: authorizationHash, authorizedName: input.authorizedName!,
      authorizedEmail: input.ownerEmail.trim().toLowerCase(), requestIpHash: input.requestIpHash || null,
      userAgent: input.userAgent || null, authorizedAt: now, createdAt: now,
    });
    await tx.update(clubSeasonPaymentInstallments).set({ status: 'superseded', nextAttemptDate: null, updatedAt: now })
      .where(and(eq(clubSeasonPaymentInstallments.paymentPlanVersionId, baseVersion.id), inArray(clubSeasonPaymentInstallments.status, ['scheduled', 'past_due', 'action_required'])));
    await tx.update(clubSeasonPaymentInstallments).set({ status: 'scheduled', updatedAt: now })
      .where(and(eq(clubSeasonPaymentInstallments.paymentPlanVersionId, proposedVersion.id), eq(clubSeasonPaymentInstallments.status, 'pending_authorization')));
    await tx.update(clubSeasonPaymentPlanVersions).set({ status: 'superseded', updatedAt: now }).where(eq(clubSeasonPaymentPlanVersions.id, baseVersion.id));
    await tx.update(clubSeasonPaymentPlanVersions).set({ status: 'active', updatedAt: now }).where(eq(clubSeasonPaymentPlanVersions.id, proposedVersion.id));
    await tx.update(clubSeasonPaymentPlans).set({ currentVersion: proposedVersion.version, status: 'active', financialStatus: 'current', needsReview: false, updatedAt: now })
      .where(eq(clubSeasonPaymentPlans.id, plan.id));
  });
  return { status: 'accepted', version: proposedVersion.version };
}
