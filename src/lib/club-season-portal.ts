import { and, asc, eq, inArray } from 'drizzle-orm';
import type { getDb } from '../db/index.ts';
import {
  athletes,
  clubSeasonOffers,
  clubSeasonPaymentInstallments,
  clubSeasonPaymentPlanAuthorizations,
  clubSeasonPaymentPlans,
  clubSeasonPaymentPlanVersions,
  clubSeasonPaymentTransactions,
  clubSeasonRegistrations,
  clubSeasons,
  clubTeams,
} from '../db/schema.ts';
import { getClubSeasonLedgerStates } from './club-season-ledger.ts';

type Db = ReturnType<typeof getDb>;

export type PortalClubSeasonInstallment = {
  id: string;
  type: string;
  dueDate: string;
  amount: number;
  status: string;
  paidAt: string | null;
};

export type PortalClubSeasonPlan = {
  id: string;
  registrationId: string;
  ownerUserId: string;
  isOwned: boolean;
  playerName: string;
  teamName: string;
  seasonName: string;
  registrationStatus: string;
  financialStatus: string;
  paymentOption: string;
  billingDay: number | null;
  autopayAuthorized: boolean;
  initialTransactionId: string | null;
  seasonTotal: number;
  paidOrCreditedAmount: number;
  remainingBalance: number;
  progressPercent: number;
  installments: PortalClubSeasonInstallment[];
  priorPaidInstallments: PortalClubSeasonInstallment[];
  nextPayment: PortalClubSeasonInstallment | null;
};

/**
 * Returns read-only club-season financial summaries for a portal access
 * context. The initial query is owner-scoped so unrelated household records
 * are never materialized in application memory.
 */
export async function getPortalClubSeasonPlans(
  db: Db,
  readableOwnerIds: string[],
  currentUserId: string
): Promise<PortalClubSeasonPlan[]> {
  if (!readableOwnerIds.length) return [];

  const rows = await db.select({
    planId: clubSeasonPaymentPlans.id,
    registrationId: clubSeasonRegistrations.id,
    ownerUserId: clubSeasonRegistrations.ownerUserId,
    registrationStatus: clubSeasonRegistrations.status,
    financialStatus: clubSeasonPaymentPlans.financialStatus,
    versionId: clubSeasonPaymentPlanVersions.id,
    paymentOption: clubSeasonPaymentPlanVersions.paymentOption,
    seasonTotal: clubSeasonPaymentPlanVersions.totalAmount,
    billingDay: clubSeasonPaymentPlanVersions.billingDay,
    authorizedAt: clubSeasonPaymentPlanVersions.authorizedAt,
    authorizationId: clubSeasonPaymentPlanAuthorizations.id,
    playerFirstName: athletes.firstName,
    playerLastName: athletes.lastName,
    teamName: clubTeams.name,
    seasonName: clubSeasons.name,
  })
    .from(clubSeasonPaymentPlans)
    .innerJoin(
      clubSeasonRegistrations,
      eq(clubSeasonPaymentPlans.registrationId, clubSeasonRegistrations.id)
    )
    .innerJoin(clubSeasonOffers, eq(clubSeasonRegistrations.offerId, clubSeasonOffers.id))
    .innerJoin(athletes, eq(clubSeasonOffers.sourceAthleteId, athletes.id))
    .innerJoin(clubTeams, and(
      eq(clubSeasonRegistrations.teamId, clubTeams.id),
      eq(clubSeasonRegistrations.seasonId, clubTeams.seasonId)
    ))
    .innerJoin(clubSeasons, eq(clubSeasonRegistrations.seasonId, clubSeasons.id))
    .innerJoin(clubSeasonPaymentPlanVersions, and(
      eq(clubSeasonPaymentPlanVersions.paymentPlanId, clubSeasonPaymentPlans.id),
      eq(clubSeasonPaymentPlanVersions.version, clubSeasonPaymentPlans.currentVersion)
    ))
    .leftJoin(
      clubSeasonPaymentPlanAuthorizations,
      eq(clubSeasonPaymentPlanAuthorizations.paymentPlanVersionId, clubSeasonPaymentPlanVersions.id)
    )
    .where(and(
      inArray(clubSeasonRegistrations.ownerUserId, readableOwnerIds),
      inArray(clubSeasonRegistrations.status, ['active', 'paid', 'paid_in_full']),
      inArray(clubSeasonPaymentPlans.status, ['active', 'completed'])
    ));

  if (!rows.length) return [];

  const versionIds = rows.map((row) => row.versionId);
  const registrationIds = rows.map((row) => row.registrationId);
  const [currentInstallments, paidHistory, ledgerStates] = await Promise.all([
    db.select({
      id: clubSeasonPaymentInstallments.id,
      versionId: clubSeasonPaymentInstallments.paymentPlanVersionId,
      type: clubSeasonPaymentInstallments.type,
      dueDate: clubSeasonPaymentInstallments.dueDate,
      amount: clubSeasonPaymentInstallments.amount,
      status: clubSeasonPaymentInstallments.status,
      paidAt: clubSeasonPaymentInstallments.paidAt,
      sequence: clubSeasonPaymentInstallments.sequence,
    })
      .from(clubSeasonPaymentInstallments)
      .where(inArray(clubSeasonPaymentInstallments.paymentPlanVersionId, versionIds))
      .orderBy(asc(clubSeasonPaymentInstallments.sequence)),
    db.select({
      transactionId: clubSeasonPaymentTransactions.id,
      registrationId: clubSeasonPaymentTransactions.registrationId,
      installmentId: clubSeasonPaymentInstallments.id,
      versionId: clubSeasonPaymentInstallments.paymentPlanVersionId,
      type: clubSeasonPaymentInstallments.type,
      dueDate: clubSeasonPaymentInstallments.dueDate,
      amount: clubSeasonPaymentTransactions.amount,
      paidAt: clubSeasonPaymentInstallments.paidAt,
      processedAt: clubSeasonPaymentTransactions.processedAt,
    })
      .from(clubSeasonPaymentTransactions)
      .innerJoin(
        clubSeasonPaymentInstallments,
        eq(clubSeasonPaymentTransactions.installmentId, clubSeasonPaymentInstallments.id)
      )
      .innerJoin(
        clubSeasonPaymentPlanVersions,
        eq(clubSeasonPaymentInstallments.paymentPlanVersionId, clubSeasonPaymentPlanVersions.id)
      )
      .where(and(
        inArray(clubSeasonPaymentTransactions.registrationId, registrationIds),
        eq(clubSeasonPaymentTransactions.status, 'succeeded')
      ))
      .orderBy(
        asc(clubSeasonPaymentTransactions.processedAt),
        asc(clubSeasonPaymentTransactions.id)
      ),
    getClubSeasonLedgerStates(
      db,
      rows.map((row) => ({ registrationId: row.registrationId, seasonTotal: row.seasonTotal }))
    ),
  ]);

  return rows.map((row) => {
    const installments = currentInstallments
      .filter((installment) => installment.versionId === row.versionId)
      .map(({ id, type, dueDate, amount, status, paidAt }) => ({
        id, type, dueDate, amount, status, paidAt,
      }));
    const currentIds = new Set(installments.map((installment) => installment.id));
    const priorPaidInstallments = paidHistory
      .filter((payment) => (
        payment.registrationId === row.registrationId && !currentIds.has(payment.installmentId)
      ))
      .map((payment) => ({
        id: payment.installmentId,
        type: payment.type,
        dueDate: payment.dueDate,
        amount: payment.amount,
        status: 'paid',
        paidAt: payment.paidAt || payment.processedAt,
      }));
    const ledger = ledgerStates.get(row.registrationId);
    const isOwned = row.ownerUserId === currentUserId;
    const initialTransaction = paidHistory.find((payment) => (
      payment.registrationId === row.registrationId
      && ['deposit', 'full_payment'].includes(payment.type)
    ));
    const remainingBalance = ledger?.remainingBalance ?? row.seasonTotal;
    const paidOrCreditedAmount = Math.max(0, row.seasonTotal - remainingBalance);
    const nextPayment = installments.find((installment) => (
      ['scheduled', 'past_due', 'action_required'].includes(installment.status)
    )) || null;

    return {
      id: row.planId,
      registrationId: row.registrationId,
      ownerUserId: row.ownerUserId,
      isOwned,
      playerName: `${row.playerFirstName} ${row.playerLastName}`,
      teamName: row.teamName,
      seasonName: row.seasonName,
      registrationStatus: row.registrationStatus,
      financialStatus: row.financialStatus,
      paymentOption: row.paymentOption,
      billingDay: row.billingDay,
      autopayAuthorized: row.paymentOption !== 'pay_in_full'
        && Boolean(row.authorizedAt || row.authorizationId),
      initialTransactionId: isOwned ? initialTransaction?.transactionId || null : null,
      seasonTotal: row.seasonTotal,
      paidOrCreditedAmount,
      remainingBalance,
      progressPercent: row.seasonTotal > 0
        ? Math.min(100, Math.max(0, (paidOrCreditedAmount / row.seasonTotal) * 100))
        : 100,
      installments,
      priorPaidInstallments,
      nextPayment,
    };
  });
}
