import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { z } from 'zod';
import { getDb } from '../db/index.ts';
import {
  clubSeasonAdminAuditLog,
  clubSeasonFinancialAdjustments,
  clubSeasonPaymentAttempts,
  clubSeasonPaymentInstallments,
  clubSeasonPaymentPlans,
  clubSeasonPaymentPlanVersions,
  clubSeasonPaymentTransactions,
  users,
} from '../db/schema.ts';
import { getClubSeasonLedgerState } from './club-season-ledger.ts';

type Db = ReturnType<typeof getDb>;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const baseWrite = {
  requestId: z.string().uuid(),
  amount: z.number().int().positive().max(2_000_000),
  reason: z.string().trim().min(3).max(240),
  note: z.string().trim().max(1000).optional(),
};

export const recordAdjustmentSchema = z.object({
  action: z.literal('record_adjustment'),
  registrationId: z.string().trim().min(1).max(100),
  type: z.enum(['offline_payment', 'credit', 'write_off']),
  effectiveDate: z.string().regex(datePattern),
  ...baseWrite,
}).strict();

export const refundPaymentSchema = z.object({
  action: z.literal('refund_payment'),
  transactionId: z.string().trim().min(1).max(100),
  ...baseWrite,
}).strict();

export const reverseAdjustmentSchema = z.object({
  action: z.literal('reverse_adjustment'),
  requestId: z.string().uuid(),
  adjustmentId: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(3).max(240),
}).strict();

async function assertNoPaymentProcessing(db: Db, paymentPlanId: string) {
  const [processing] = await db.select({ id: clubSeasonPaymentAttempts.id })
    .from(clubSeasonPaymentAttempts)
    .innerJoin(clubSeasonPaymentPlanVersions, eq(clubSeasonPaymentAttempts.paymentPlanVersionId, clubSeasonPaymentPlanVersions.id))
    .where(and(
      eq(clubSeasonPaymentPlanVersions.paymentPlanId, paymentPlanId),
      eq(clubSeasonPaymentAttempts.status, 'processing')
    )).limit(1);
  if (processing) throw new Error('PAYMENT_PROCESSING');
}

async function reconcilePlanAfterAdjustment(db: Db, paymentPlanId: string, remainingBalance: number, raisesBalance: boolean) {
  const [plan] = await db.select().from(clubSeasonPaymentPlans)
    .where(eq(clubSeasonPaymentPlans.id, paymentPlanId)).limit(1);
  if (!plan) throw new Error('PAYMENT_PLAN_NOT_FOUND');
  const now = new Date().toISOString();
  if (remainingBalance === 0) {
    await db.transaction(async (tx) => {
      await tx.update(clubSeasonPaymentInstallments).set({ status: 'satisfied', nextAttemptDate: null, updatedAt: now })
        .where(and(
          inArray(clubSeasonPaymentInstallments.status, ['scheduled', 'past_due', 'action_required']),
          sql`${clubSeasonPaymentInstallments.paymentPlanVersionId} IN (
            SELECT id FROM club_season_payment_plan_versions WHERE payment_plan_id = ${paymentPlanId}
          )`
        ));
      await tx.update(clubSeasonPaymentPlanVersions).set({ status: 'completed', updatedAt: now })
        .where(and(
          eq(clubSeasonPaymentPlanVersions.paymentPlanId, paymentPlanId),
          eq(clubSeasonPaymentPlanVersions.version, plan.currentVersion)
        ));
      await tx.update(clubSeasonPaymentPlans).set({
        status: 'completed', financialStatus: 'paid_in_full', needsReview: false,
        completedAt: now, updatedAt: now,
      }).where(eq(clubSeasonPaymentPlans.id, paymentPlanId));
    });
  } else if (raisesBalance) {
    await db.transaction(async (tx) => {
      await tx.update(clubSeasonPaymentPlanVersions).set({ status: 'active', updatedAt: now })
        .where(and(
          eq(clubSeasonPaymentPlanVersions.paymentPlanId, paymentPlanId),
          eq(clubSeasonPaymentPlanVersions.version, plan.currentVersion),
          eq(clubSeasonPaymentPlanVersions.status, 'completed')
        ));
      await tx.update(clubSeasonPaymentPlans).set({
        status: 'active', financialStatus: 'action_required', needsReview: true,
        completedAt: null, updatedAt: now,
      }).where(eq(clubSeasonPaymentPlans.id, paymentPlanId));
    });
  }
}

async function loadPlanContext(db: Db, registrationId: string) {
  const [row] = await db.select({ plan: clubSeasonPaymentPlans, version: clubSeasonPaymentPlanVersions })
    .from(clubSeasonPaymentPlans)
    .innerJoin(clubSeasonPaymentPlanVersions, and(
      eq(clubSeasonPaymentPlanVersions.paymentPlanId, clubSeasonPaymentPlans.id),
      eq(clubSeasonPaymentPlanVersions.version, clubSeasonPaymentPlans.currentVersion)
    ))
    .where(eq(clubSeasonPaymentPlans.registrationId, registrationId)).limit(1);
  if (!row) throw new Error('PAYMENT_PLAN_NOT_FOUND');
  return row;
}

export async function recordClubSeasonAdjustment(db: Db, input: {
  requestId: string; registrationId: string; type: 'offline_payment' | 'credit' | 'write_off';
  amount: number; effectiveDate: string; reason: string; note?: string; today: string; adminUserId: string;
}) {
  if (input.effectiveDate > input.today) throw new Error('EFFECTIVE_DATE_FUTURE');
  const context = await loadPlanContext(db, input.registrationId);
  if (context.plan.status.startsWith('refund_processing:')) throw new Error('FINANCIAL_OPERATION_IN_PROGRESS');
  await assertNoPaymentProcessing(db, context.plan.id);
  const now = new Date().toISOString();
  const result = await db.transaction(async (tx) => {
    await assertNoPaymentProcessing(tx as Db, context.plan.id);
    const currentLedger = await getClubSeasonLedgerState(tx as Db, input.registrationId, context.version.totalAmount);
    if (input.amount > currentLedger.summary.remainingBalance) throw new Error('ADJUSTMENT_EXCEEDS_BALANCE');
    const inserted = await tx.insert(clubSeasonFinancialAdjustments).values({
      id: input.requestId, registrationId: input.registrationId, paymentPlanId: context.plan.id,
      type: input.type, amount: input.amount, balanceEffect: -input.amount,
      effectiveDate: input.effectiveDate, reason: input.reason, note: input.note || null,
      createdByUserId: input.adminUserId, createdAt: now,
    }).onConflictDoNothing().returning();
    if (!inserted[0]) throw new Error('ADJUSTMENT_REQUEST_REUSED');
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId, action: `financial_${input.type}_recorded`,
      entityType: 'financial_adjustment', entityId: input.requestId, reason: input.reason,
      beforeSnapshot: JSON.stringify(currentLedger.summary),
      afterSnapshot: JSON.stringify({ amount: input.amount, balanceEffect: -input.amount }), createdAt: now,
    });
    return { created: inserted[0], remainingBalance: currentLedger.summary.remainingBalance - input.amount };
  });
  await reconcilePlanAfterAdjustment(db, context.plan.id, result.remainingBalance, false);
  return { ...result.created, remainingBalance: result.remainingBalance };
}

export async function refundClubSeasonPayment(db: Db, stripe: Stripe, input: {
  requestId: string; transactionId: string; amount: number; reason: string; note?: string;
  today: string; adminUserId: string;
}) {
  const [existing] = await db.select().from(clubSeasonFinancialAdjustments)
    .where(eq(clubSeasonFinancialAdjustments.id, input.requestId)).limit(1);
  if (existing) {
    const existingContext = await loadPlanContext(db, existing.registrationId);
    const existingLedger = await getClubSeasonLedgerState(db, existing.registrationId, existingContext.version.totalAmount);
    await reconcilePlanAfterAdjustment(db, existing.paymentPlanId, existingLedger.summary.remainingBalance, true);
    return existing;
  }
  const [transaction] = await db.select().from(clubSeasonPaymentTransactions).where(and(
    eq(clubSeasonPaymentTransactions.id, input.transactionId),
    eq(clubSeasonPaymentTransactions.status, 'succeeded')
  )).limit(1);
  if (!transaction) throw new Error('TRANSACTION_NOT_REFUNDABLE');
  const context = await loadPlanContext(db, transaction.registrationId);
  const refundLock = `refund_processing:${input.requestId}`;
  if (context.plan.status.startsWith('refund_processing:') && context.plan.status !== refundLock) {
    throw new Error('FINANCIAL_OPERATION_IN_PROGRESS');
  }
  await assertNoPaymentProcessing(db, context.plan.id);
  const [prior] = await db.select({ amount: sql<number>`coalesce(sum(${clubSeasonFinancialAdjustments.amount}), 0)` })
    .from(clubSeasonFinancialAdjustments).where(and(
      eq(clubSeasonFinancialAdjustments.transactionId, transaction.id),
      eq(clubSeasonFinancialAdjustments.type, 'stripe_refund')
    ));
  const refundableAmount = transaction.amount - Number(prior?.amount || 0);
  if (input.amount > refundableAmount) throw new Error('REFUND_EXCEEDS_AVAILABLE');
  const [claimedPlan] = await db.update(clubSeasonPaymentPlans).set({
    status: refundLock, needsReview: true, updatedAt: new Date().toISOString(),
  }).where(and(
    eq(clubSeasonPaymentPlans.id, context.plan.id),
    eq(clubSeasonPaymentPlans.status, context.plan.status)
  )).returning({ id: clubSeasonPaymentPlans.id });
  if (!claimedPlan) throw new Error('PAYMENT_PROCESSING');
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create({
      payment_intent: transaction.stripePaymentIntentId,
      amount: input.amount,
      metadata: { flow: 'club_season_admin_refund', registrationId: transaction.registrationId,
        transactionId: transaction.id, adjustmentId: input.requestId, adminUserId: input.adminUserId },
    }, { idempotencyKey: `club-season-refund:${input.requestId}` });
  } catch (error) {
    await db.update(clubSeasonPaymentPlans).set({
      status: context.plan.status, needsReview: context.plan.needsReview, updatedAt: new Date().toISOString(),
    }).where(and(eq(clubSeasonPaymentPlans.id, context.plan.id), eq(clubSeasonPaymentPlans.status, refundLock)));
    throw error;
  }
  if (refund.status === 'failed' || refund.amount !== input.amount) {
    await db.update(clubSeasonPaymentPlans).set({
      status: context.plan.status, needsReview: context.plan.needsReview, updatedAt: new Date().toISOString(),
    }).where(and(eq(clubSeasonPaymentPlans.id, context.plan.id), eq(clubSeasonPaymentPlans.status, refundLock)));
    throw new Error('STRIPE_REFUND_FAILED');
  }
  const ledger = await getClubSeasonLedgerState(db, transaction.registrationId, context.version.totalAmount);
  const now = new Date().toISOString();
  const [created] = await db.transaction(async (tx) => {
    const inserted = await tx.insert(clubSeasonFinancialAdjustments).values({
      id: input.requestId, registrationId: transaction.registrationId, paymentPlanId: context.plan.id,
      transactionId: transaction.id, type: 'stripe_refund', amount: input.amount,
      balanceEffect: input.amount, effectiveDate: input.today, reason: input.reason,
      note: input.note || null, stripeRefundId: refund.id, createdByUserId: input.adminUserId, createdAt: now,
    }).onConflictDoNothing().returning();
    if (!inserted[0]) {
      const [same] = await tx.select().from(clubSeasonFinancialAdjustments)
        .where(eq(clubSeasonFinancialAdjustments.id, input.requestId)).limit(1);
      if (same?.stripeRefundId === refund.id) return [same];
      throw new Error('ADJUSTMENT_REQUEST_REUSED');
    }
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId, action: 'stripe_refund_issued',
      entityType: 'financial_adjustment', entityId: input.requestId, reason: input.reason,
      beforeSnapshot: JSON.stringify({ ...ledger.summary, refundableAmount }),
      afterSnapshot: JSON.stringify({ amount: input.amount, stripeRefundId: refund.id }), createdAt: now,
    });
    return inserted;
  });
  await reconcilePlanAfterAdjustment(db, context.plan.id, ledger.summary.remainingBalance + input.amount, true);
  return created;
}

export async function reverseClubSeasonAdjustment(db: Db, input: {
  requestId: string; adjustmentId: string; reason: string; today: string; adminUserId: string;
}) {
  const [original] = await db.select().from(clubSeasonFinancialAdjustments).where(and(
    eq(clubSeasonFinancialAdjustments.id, input.adjustmentId),
    inArray(clubSeasonFinancialAdjustments.type, ['offline_payment', 'credit', 'write_off'])
  )).limit(1);
  if (!original) throw new Error('ADJUSTMENT_NOT_REVERSIBLE');
  await assertNoPaymentProcessing(db, original.paymentPlanId);
  const [alreadyReversed] = await db.select({ id: clubSeasonFinancialAdjustments.id })
    .from(clubSeasonFinancialAdjustments)
    .where(eq(clubSeasonFinancialAdjustments.reversesAdjustmentId, original.id)).limit(1);
  if (alreadyReversed) throw new Error('ADJUSTMENT_ALREADY_REVERSED');
  const context = await loadPlanContext(db, original.registrationId);
  if (context.plan.status.startsWith('refund_processing:')) throw new Error('FINANCIAL_OPERATION_IN_PROGRESS');
  const now = new Date().toISOString();
  const result = await db.transaction(async (tx) => {
    await assertNoPaymentProcessing(tx as Db, original.paymentPlanId);
    const currentLedger = await getClubSeasonLedgerState(tx as Db, original.registrationId, context.version.totalAmount);
    const inserted = await tx.insert(clubSeasonFinancialAdjustments).values({
      id: input.requestId, registrationId: original.registrationId, paymentPlanId: original.paymentPlanId,
      type: 'reversal', amount: original.amount, balanceEffect: -original.balanceEffect,
      effectiveDate: input.today, reason: input.reason, reversesAdjustmentId: original.id,
      createdByUserId: input.adminUserId, createdAt: now,
    }).onConflictDoNothing().returning();
    if (!inserted[0]) throw new Error('ADJUSTMENT_REQUEST_REUSED');
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId, action: 'financial_adjustment_reversed',
      entityType: 'financial_adjustment', entityId: input.requestId, reason: input.reason,
      beforeSnapshot: JSON.stringify({ adjustmentId: original.id, ...currentLedger.summary }),
      afterSnapshot: JSON.stringify({ reversesAdjustmentId: original.id, balanceEffect: -original.balanceEffect }), createdAt: now,
    });
    return { created: inserted[0], remainingBalance: currentLedger.summary.remainingBalance - original.balanceEffect };
  });
  await reconcilePlanAfterAdjustment(db, original.paymentPlanId, result.remainingBalance, true);
  return result.created;
}

export async function getClubSeasonAdjustments(db: Db, registrationId: string) {
  const rows = await db.select({ adjustment: clubSeasonFinancialAdjustments, createdByName: users.name, createdByEmail: users.email })
    .from(clubSeasonFinancialAdjustments)
    .innerJoin(users, eq(clubSeasonFinancialAdjustments.createdByUserId, users.id))
    .where(eq(clubSeasonFinancialAdjustments.registrationId, registrationId))
    .orderBy(desc(clubSeasonFinancialAdjustments.createdAt));
  const reversedIds = new Set(rows.flatMap((row) => row.adjustment.reversesAdjustmentId ? [row.adjustment.reversesAdjustmentId] : []));
  return rows.map((row) => ({
    ...row.adjustment,
    createdByName: row.createdByName || row.createdByEmail,
    reversible: ['offline_payment', 'credit', 'write_off'].includes(row.adjustment.type) && !reversedIds.has(row.adjustment.id),
  }));
}
