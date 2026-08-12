import type { APIRoute } from 'astro';
import { requireAdminApiSession } from '../../../lib/admin-auth';
import { deliverClubSeasonEmail } from '../../../lib/club-season-billing';
import {
  cancelClubSeasonPlanRevision,
  getClubSeasonFinancialAccount,
  getClubSeasonFinancialAccounts,
  proposeClubSeasonPlanRevision,
} from '../../../lib/club-season-financials';
import { financialAccountUpdatedEmail, initialCustomPlanProposedEmail, paymentPlanRevisionProposedEmail } from '../../../lib/club-season-payment-emails';
import { cancelPlanRevisionSchema, createPlanRevisionSchema } from '../../../lib/club-season-plan-revision';
import { getClubDate } from '../../../lib/event-eligibility';
import {
  cancelInitialCustomPlan,
  cancelInitialPlanSchema,
  getInitialPlanCandidates,
  proposeInitialCustomPlan,
  proposeInitialPlanSchema,
} from '../../../lib/club-season-initial-plan';
import {
  recordAdjustmentSchema,
  recordClubSeasonAdjustment,
  refundClubSeasonPayment,
  refundPaymentSchema,
  reverseAdjustmentSchema,
  reverseClubSeasonAdjustment,
} from '../../../lib/club-season-adjustments';
import { createStripeClient } from '../../../lib/stripe-client';
import { isClubSeasonBillingSimulatorAvailable } from '../../../lib/club-season-feature';

export const prerender = false;
const SEASON_ID = '2026-2027-club';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sendFinancialUpdateEmail(db: Parameters<typeof getClubSeasonFinancialAccount>[0], request: Request, input: {
  registrationId: string; key: string; heading: string; explanation: string; amount: number; reason: string;
}) {
  const account = await getClubSeasonFinancialAccount(db, input.registrationId);
  if (!account) return false;
  const message = financialAccountUpdatedEmail({
    parentName: account.parentName, playerName: account.playerName, teamName: account.teamName,
    amount: input.amount, dueDate: getClubDate(), remainingBalance: account.remainingBalance,
    portalUrl: `${new URL(request.url).origin}/portal/dashboard`, heading: input.heading,
    explanation: input.explanation, reason: input.reason,
  });
  try {
    return await deliverClubSeasonEmail(db, {
      registrationId: input.registrationId, type: 'financial_account_updated', recipient: account.parentEmail,
      key: input.key, ...message,
    });
  } catch (error) {
    console.error('Financial account update email failed:', error);
    return false;
  }
}

function revisionError(error: unknown) {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  const messages: Record<string, [string, number]> = {
    PLAN_NOT_ACTIVE: ['Only active payment plans can be revised.', 409],
    CURRENT_VERSION_NOT_ACTIVE: ['The current payment schedule is not active.', 409],
    REVISION_ALREADY_PENDING: ['This family already has a revision awaiting authorization.', 409],
    PAYMENT_PROCESSING: ['A payment is currently processing. Try again after Stripe resolves it.', 409],
    NO_REMAINING_BALANCE: ['This account has no remaining balance.', 409],
    DUPLICATE_DUE_DATE: ['Each revised installment needs a different due date.', 422],
    DUE_DATE_NOT_FUTURE: ['Revised installment dates must be after today.', 422],
    DUE_DATES_NOT_ASCENDING: ['Enter revised installment dates in chronological order.', 422],
    REVISION_TOTAL_MISMATCH: ['The revised installments must equal the current remaining balance.', 422],
    REVISION_NOT_PENDING: ['That revision is no longer awaiting authorization.', 409],
    REGISTRATION_NOT_ELIGIBLE: ['That registration is not eligible for a custom initial plan.', 409],
    INITIAL_PLAN_ALREADY_PENDING: ['This family already has a custom initial plan awaiting checkout.', 409],
    INITIAL_PLAN_NOT_PENDING: ['That custom initial plan is no longer pending.', 409],
    INVALID_DUE_NOW_AMOUNT: ['The due-now amount must be less than the season total.', 422],
    INVALID_SEASON_TOTAL: ['The registration has an invalid season total.', 422],
    INITIAL_PLAN_TOTAL_MISMATCH: ['The due-now amount plus scheduled charges must equal the season total.', 422],
    PAYMENT_PLAN_NOT_FOUND: ['The payment account could not be found.', 404],
    EFFECTIVE_DATE_FUTURE: ['The effective date cannot be in the future.', 422],
    ADJUSTMENT_EXCEEDS_BALANCE: ['That amount is greater than the current balance due.', 422],
    ADJUSTMENT_REQUEST_REUSED: ['That request was already used. Reload the account before trying again.', 409],
    TRANSACTION_NOT_REFUNDABLE: ['That Stripe payment is not eligible for a refund.', 409],
    REFUND_EXCEEDS_AVAILABLE: ['The refund is greater than the amount still refundable on that payment.', 422],
    STRIPE_REFUND_FAILED: ['Stripe did not complete the refund. No ledger entry was recorded.', 502],
    ADJUSTMENT_NOT_REVERSIBLE: ['That entry cannot be reversed in this system.', 409],
    ADJUSTMENT_ALREADY_REVERSED: ['That entry has already been reversed.', 409],
    FINANCIAL_OPERATION_IN_PROGRESS: ['Another financial operation is already in progress for this account.', 409],
  };
  const [message, status] = messages[code] || ['Unable to update the payment plan.', 500];
  if (status === 500) console.error('Club season finance error:', error);
  return json({ error: message, code }, status);
}

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireAdminApiSession(request);
  if (!auth.authorized) return auth.response;
  try {
    const registrationId = new URL(request.url).searchParams.get('registrationId');
    if (registrationId) {
      const account = await getClubSeasonFinancialAccount(auth.db, registrationId);
      return account ? json({ account: {
        ...account,
        billingSimulatorAvailable: isClubSeasonBillingSimulatorAvailable(),
      } }) : json({ error: 'Financial account not found.' }, 404);
    }
    const [accounts, candidates] = await Promise.all([
      getClubSeasonFinancialAccounts(auth.db, SEASON_ID),
      getInitialPlanCandidates(auth.db, SEASON_ID),
    ]);
    return json({ accounts, candidates });
  } catch (error) {
    console.error('Load club season finances error:', error);
    return json({ error: 'Unable to load club-season finances.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireAdminApiSession(request);
  if (!auth.authorized) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const adjustment = recordAdjustmentSchema.safeParse(body);
  if (adjustment.success) {
    try {
      const recorded = await recordClubSeasonAdjustment(auth.db, {
        ...adjustment.data, today: getClubDate(), adminUserId: auth.user.id,
      });
      const copy = adjustment.data.type === 'offline_payment'
        ? ['Offline payment recorded', 'TVVC recorded a payment received outside Stripe.']
        : adjustment.data.type === 'credit'
          ? ['Account credit applied', 'TVVC applied a non-cash credit to your club-season account.']
          : ['Balance write-off recorded', 'TVVC approved an amount that will no longer be collected.'];
      const emailSent = await sendFinancialUpdateEmail(auth.db, request, {
        registrationId: adjustment.data.registrationId, key: `club-season-adjustment:${adjustment.data.requestId}`,
        heading: copy[0], explanation: copy[1], amount: adjustment.data.amount, reason: adjustment.data.reason,
      });
      return json({ adjustment: recorded, emailSent }, 201);
    } catch (error) { return revisionError(error); }
  }
  const refund = refundPaymentSchema.safeParse(body);
  if (refund.success) {
    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) return json({ error: 'Stripe refund processing is not configured.' }, 503);
    try {
      const recorded = await refundClubSeasonPayment(auth.db, createStripeClient(stripeSecretKey), {
        ...refund.data, today: getClubDate(), adminUserId: auth.user.id,
      });
      const account = await getClubSeasonFinancialAccount(auth.db, recorded.registrationId);
      const emailSent = account ? await sendFinancialUpdateEmail(auth.db, request, {
        registrationId: recorded.registrationId, key: `club-season-refund:${refund.data.requestId}`,
        heading: 'Stripe refund issued',
        explanation: 'TVVC returned funds through Stripe. Unless TVVC separately applies a credit or write-off, the refunded amount is restored to the account balance.',
        amount: refund.data.amount, reason: refund.data.reason,
      }) : false;
      return json({ adjustment: recorded, emailSent }, 201);
    } catch (error) { return revisionError(error); }
  }
  const reversal = reverseAdjustmentSchema.safeParse(body);
  if (reversal.success) {
    try {
      const recorded = await reverseClubSeasonAdjustment(auth.db, {
        ...reversal.data, today: getClubDate(), adminUserId: auth.user.id,
      });
      const emailSent = await sendFinancialUpdateEmail(auth.db, request, {
        registrationId: recorded.registrationId, key: `club-season-adjustment-reversal:${reversal.data.requestId}`,
        heading: 'Account adjustment reversed',
        explanation: 'TVVC recorded a counter-entry that reverses a previous manual account adjustment.',
        amount: recorded.amount, reason: reversal.data.reason,
      });
      return json({ adjustment: recorded, emailSent }, 201);
    } catch (error) { return revisionError(error); }
  }
  const initial = proposeInitialPlanSchema.safeParse(body);
  if (initial.success) {
    try {
      const proposal = await proposeInitialCustomPlan(auth.db, {
        ...initial.data, today: getClubDate(), adminUserId: auth.user.id,
      });
      const candidate = (await getInitialPlanCandidates(auth.db, SEASON_ID))
        .find((item) => item.registrationId === initial.data.registrationId);
      let emailSent = false;
      if (candidate) {
        const message = initialCustomPlanProposedEmail({
          parentName: candidate.parentName, playerName: candidate.playerName,
          teamName: candidate.teamName, amount: proposal.terms.dueNowAmount,
          dueDate: getClubDate(), remainingBalance: candidate.seasonTotal,
          portalUrl: `${new URL(request.url).origin}/season-registration`, reason: initial.data.reason,
        });
        try {
          emailSent = await deliverClubSeasonEmail(auth.db, {
            registrationId: candidate.registrationId, type: 'initial_custom_plan_proposed',
            recipient: candidate.parentEmail,
            key: `club-season-initial-plan-proposed:${proposal.proposalId}`, ...message,
          });
        } catch (error) { console.error('Initial custom-plan email failed:', error); }
      }
      return json({ proposal, emailSent }, 201);
    } catch (error) { return revisionError(error); }
  }
  const cancelInitial = cancelInitialPlanSchema.safeParse(body);
  if (cancelInitial.success) {
    try {
      return json({ proposal: await cancelInitialCustomPlan(auth.db, {
        ...cancelInitial.data, adminUserId: auth.user.id,
      }) });
    } catch (error) { return revisionError(error); }
  }
  const create = createPlanRevisionSchema.safeParse(body);
  if (create.success) {
    try {
      const revision = await proposeClubSeasonPlanRevision(auth.db, {
        ...create.data, today: getClubDate(), adminUserId: auth.user.id,
      });
      const account = await getClubSeasonFinancialAccount(auth.db, revision.registrationId);
      let emailSent = false;
      if (account) {
        const message = paymentPlanRevisionProposedEmail({
          parentName: account.parentName, playerName: account.playerName, teamName: account.teamName,
          amount: 0, dueDate: revision.charges[0].dueDate, remainingBalance: revision.remainingBalance,
          portalUrl: `${new URL(request.url).origin}/portal/dashboard`, reason: create.data.reason,
        });
        try {
          emailSent = await deliverClubSeasonEmail(auth.db, {
            registrationId: account.registrationId, type: 'plan_revision_proposed', recipient: account.parentEmail,
            key: `club-season-revision-proposed:${revision.revisionId}`, ...message,
          });
        } catch (error) { console.error('Revision proposal email failed:', error); }
      }
      return json({ revision, emailSent }, 201);
    } catch (error) { return revisionError(error); }
  }
  const cancel = cancelPlanRevisionSchema.safeParse(body);
  if (cancel.success) {
    try { return json({ revision: await cancelClubSeasonPlanRevision(auth.db, { ...cancel.data, adminUserId: auth.user.id }) }); }
    catch (error) { return revisionError(error); }
  }
  return json({ error: 'Invalid payment-plan revision request.' }, 400);
};
