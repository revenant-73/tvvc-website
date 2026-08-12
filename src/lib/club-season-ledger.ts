import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import {
  clubSeasonFinancialAdjustments,
  clubSeasonPaymentTransactions,
} from '../db/schema.ts';

type Db = ReturnType<typeof getDb>;

type LedgerTransaction = {
  id: string;
  amount: number;
  status: string;
};

type LedgerAdjustment = {
  id: string;
  type: string;
  amount: number;
  balanceEffect: number;
  transactionId?: string | null;
  reversesAdjustmentId?: string | null;
};

export function summarizeClubSeasonLedger(
  seasonTotal: number,
  transactions: LedgerTransaction[],
  adjustments: LedgerAdjustment[]
) {
  const stripePaidAmount = transactions
    .filter((transaction) => transaction.status === 'succeeded')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const originalById = new Map(adjustments
    .filter((adjustment) => adjustment.type !== 'reversal')
    .map((adjustment) => [adjustment.id, adjustment]));
  const effects = { offline_payment: 0, credit: 0, write_off: 0, stripe_refund: 0 };
  for (const adjustment of adjustments) {
    const category = adjustment.type === 'reversal'
      ? originalById.get(adjustment.reversesAdjustmentId || '')?.type
      : adjustment.type;
    if (category && category in effects) {
      effects[category as keyof typeof effects] += adjustment.balanceEffect;
    }
  }
  const offlinePaidAmount = Math.max(0, -effects.offline_payment);
  const creditAmount = Math.max(0, -effects.credit);
  const writeOffAmount = Math.max(0, -effects.write_off);
  const refundedAmount = Math.max(0, effects.stripe_refund);
  const adjustmentEffect = adjustments.reduce((sum, adjustment) => sum + adjustment.balanceEffect, 0);
  const remainingBalance = Math.max(0, seasonTotal - stripePaidAmount + adjustmentEffect);
  return {
    stripePaidAmount,
    offlinePaidAmount,
    creditAmount,
    writeOffAmount,
    refundedAmount,
    netCollectedAmount: Math.max(0, stripePaidAmount + offlinePaidAmount - refundedAmount),
    remainingBalance,
  };
}

export async function getClubSeasonLedgerState(db: Db, registrationId: string, seasonTotal: number) {
  const [transactions, adjustments] = await Promise.all([
    db.select().from(clubSeasonPaymentTransactions).where(and(
      eq(clubSeasonPaymentTransactions.registrationId, registrationId),
      eq(clubSeasonPaymentTransactions.status, 'succeeded')
    )),
    db.select().from(clubSeasonFinancialAdjustments)
      .where(eq(clubSeasonFinancialAdjustments.registrationId, registrationId)),
  ]);
  return {
    transactions,
    adjustments,
    summary: summarizeClubSeasonLedger(seasonTotal, transactions, adjustments),
  };
}

export async function getClubSeasonLedgerStates(db: Db, inputs: Array<{ registrationId: string; seasonTotal: number }>) {
  if (!inputs.length) return new Map<string, ReturnType<typeof summarizeClubSeasonLedger>>();
  const registrationIds = inputs.map((input) => input.registrationId);
  const [transactions, adjustments] = await Promise.all([
    db.select().from(clubSeasonPaymentTransactions).where(and(
      inArray(clubSeasonPaymentTransactions.registrationId, registrationIds),
      eq(clubSeasonPaymentTransactions.status, 'succeeded')
    )),
    db.select().from(clubSeasonFinancialAdjustments)
      .where(inArray(clubSeasonFinancialAdjustments.registrationId, registrationIds)),
  ]);
  return new Map(inputs.map((input) => [input.registrationId, summarizeClubSeasonLedger(
    input.seasonTotal,
    transactions.filter((transaction) => transaction.registrationId === input.registrationId),
    adjustments.filter((adjustment) => adjustment.registrationId === input.registrationId)
  )]));
}
