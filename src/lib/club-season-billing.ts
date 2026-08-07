import { and, eq, inArray, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { getDb } from '../db';
import {
  athletes,
  clubSeasonEmailDeliveries,
  clubSeasonOffers,
  clubSeasonPaymentAttempts,
  clubSeasonPaymentInstallments,
  clubSeasonPaymentPlans,
  clubSeasonPaymentPlanVersions,
  clubSeasonPaymentTransactions,
  clubSeasonRegistrations,
  clubTeams,
  registrations,
} from '../db/schema';
import { sendEmail } from './email';
import {
  adminPaymentAlertEmail,
  paymentFailedEmail,
  paymentSucceededEmail,
  upcomingPaymentEmail,
} from './club-season-payment-emails';
import { clubDate, reminderDate, retryDate } from './club-season-billing-dates';

export { addDays, clubDate, reminderDate, retryDate } from './club-season-billing-dates';

type Db = ReturnType<typeof getDb>;

export const ADMIN_BILLING_EMAIL = process.env.CLUB_SEASON_BILLING_EMAIL || 'loren@tualatinvalleyvb.com';

async function getContext(db: Db, installmentId: string, siteUrl: string) {
  const [row] = await db.select({
    installment: clubSeasonPaymentInstallments,
    version: clubSeasonPaymentPlanVersions,
    plan: clubSeasonPaymentPlans,
    registration: clubSeasonRegistrations,
    parentName: registrations.parentName,
    parentEmail: registrations.parentEmail,
    playerFirstName: athletes.firstName,
    playerLastName: athletes.lastName,
    teamName: clubTeams.name,
  }).from(clubSeasonPaymentInstallments)
    .innerJoin(clubSeasonPaymentPlanVersions, eq(clubSeasonPaymentInstallments.paymentPlanVersionId, clubSeasonPaymentPlanVersions.id))
    .innerJoin(clubSeasonPaymentPlans, eq(clubSeasonPaymentPlanVersions.paymentPlanId, clubSeasonPaymentPlans.id))
    .innerJoin(clubSeasonRegistrations, eq(clubSeasonPaymentPlans.registrationId, clubSeasonRegistrations.id))
    .innerJoin(clubSeasonOffers, eq(clubSeasonRegistrations.offerId, clubSeasonOffers.id))
    .innerJoin(registrations, eq(clubSeasonOffers.sourceRegistrationId, registrations.id))
    .innerJoin(athletes, eq(clubSeasonOffers.sourceAthleteId, athletes.id))
    .innerJoin(clubTeams, eq(clubSeasonRegistrations.teamId, clubTeams.id))
    .where(eq(clubSeasonPaymentInstallments.id, installmentId)).limit(1);
  if (!row) throw new Error(`Installment ${installmentId} was not found.`);
  const [paid] = await db.select({ amount: sql<number>`coalesce(sum(${clubSeasonPaymentTransactions.amount}), 0)` })
    .from(clubSeasonPaymentTransactions).where(and(
      eq(clubSeasonPaymentTransactions.registrationId, row.registration.id),
      eq(clubSeasonPaymentTransactions.status, 'succeeded')
    ));
  return {
    ...row,
    email: {
      parentName: row.parentName,
      playerName: `${row.playerFirstName} ${row.playerLastName}`.trim(),
      teamName: row.teamName,
      amount: row.installment.amount,
      dueDate: row.installment.dueDate,
      remainingBalance: Math.max(0, row.version.totalAmount - Number(paid?.amount || 0)),
      portalUrl: `${siteUrl.replace(/\/$/, '')}/portal/dashboard`,
    },
  };
}

export async function deliverClubSeasonEmail(db: Db, input: {
  registrationId: string; installmentId?: string | null; type: string; recipient: string;
  key: string; subject: string; html: string;
}) {
  const now = new Date().toISOString();
  const [claimed] = await db.insert(clubSeasonEmailDeliveries).values({
    id: crypto.randomUUID(), registrationId: input.registrationId, installmentId: input.installmentId || null,
    type: input.type, recipient: input.recipient, idempotencyKey: input.key,
    status: 'pending', attemptCount: 1, createdAt: now, updatedAt: now,
  }).onConflictDoNothing().returning({ id: clubSeasonEmailDeliveries.id });
  let delivery = claimed;
  if (!delivery) {
    [delivery] = await db.update(clubSeasonEmailDeliveries).set({
      status: 'pending', attemptCount: sql`${clubSeasonEmailDeliveries.attemptCount} + 1`, lastError: null, updatedAt: now,
    }).where(and(eq(clubSeasonEmailDeliveries.idempotencyKey, input.key), eq(clubSeasonEmailDeliveries.status, 'failed')))
      .returning({ id: clubSeasonEmailDeliveries.id });
  }
  if (!delivery) return false;
  try {
    const result: any = await sendEmail({ to: input.recipient, subject: input.subject, html: input.html, idempotencyKey: input.key });
    await db.update(clubSeasonEmailDeliveries).set({
      status: 'sent', providerMessageId: result?.data?.id || result?.id || null, sentAt: now, updatedAt: now,
    }).where(eq(clubSeasonEmailDeliveries.id, delivery.id));
    return true;
  } catch (error) {
    await db.update(clubSeasonEmailDeliveries).set({
      status: 'failed', lastError: error instanceof Error ? error.message : String(error), updatedAt: now,
    }).where(eq(clubSeasonEmailDeliveries.id, delivery.id));
    throw error;
  }
}

export async function recordInstallmentSuccess(db: Db, stripe: Stripe, eventId: string, intent: Stripe.PaymentIntent, siteUrl: string) {
  if (intent.metadata?.flow !== 'club_season_installment') return false;
  const installmentId = intent.metadata.installmentId;
  const context = await getContext(db, installmentId, siteUrl);
  const alreadyPaid = context.installment.status === 'paid';
  const isCurrentVersion = context.plan.currentVersion === context.version.version;
  if (intent.amount_received !== context.installment.amount || intent.currency !== context.version.currency) {
    await db.update(clubSeasonPaymentPlans).set({ needsReview: true, updatedAt: new Date().toISOString() })
      .where(eq(clubSeasonPaymentPlans.id, context.plan.id));
    throw new Error('Installment PaymentIntent amount or currency did not match the stored schedule.');
  }
  const now = new Date().toISOString();
  const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id || null;
  if (!alreadyPaid) await db.transaction(async (tx) => {
    await tx.update(clubSeasonPaymentInstallments).set({
      status: 'paid', stripePaymentIntentId: intent.id, nextAttemptDate: null, paidAt: now, updatedAt: now,
    }).where(and(eq(clubSeasonPaymentInstallments.id, installmentId), sql`${clubSeasonPaymentInstallments.status} <> 'paid'`));
    await tx.update(clubSeasonPaymentAttempts).set({ status: 'succeeded', resolvedAt: now, updatedAt: now })
      .where(eq(clubSeasonPaymentAttempts.stripePaymentIntentId, intent.id));
    await tx.insert(clubSeasonPaymentTransactions).values({
      id: crypto.randomUUID(), registrationId: context.registration.id, paymentPlanVersionId: context.version.id,
      installmentId, stripeEventId: eventId, source: 'installment', stripePaymentIntentId: intent.id,
      stripeChargeId: chargeId, amount: intent.amount_received, currency: intent.currency,
      status: 'succeeded', processedAt: now, createdAt: now,
    }).onConflictDoNothing();
    if (isCurrentVersion) {
      const [outstanding] = await tx.select({ count: sql<number>`count(*)` }).from(clubSeasonPaymentInstallments)
        .where(and(eq(clubSeasonPaymentInstallments.paymentPlanVersionId, context.version.id), sql`${clubSeasonPaymentInstallments.status} <> 'paid'`));
      const completed = Number(outstanding?.count || 0) === 0;
      await tx.update(clubSeasonPaymentPlans).set({
        status: completed ? 'completed' : 'active', financialStatus: completed ? 'paid_in_full' : 'current',
        completedAt: completed ? now : null, needsReview: false, updatedAt: now,
      }).where(eq(clubSeasonPaymentPlans.id, context.plan.id));
      if (completed) await tx.update(clubSeasonPaymentPlanVersions).set({ status: 'completed', updatedAt: now })
        .where(eq(clubSeasonPaymentPlanVersions.id, context.version.id));
    } else {
      await tx.update(clubSeasonPaymentPlans).set({ financialStatus: 'action_required', needsReview: true, updatedAt: now })
        .where(eq(clubSeasonPaymentPlans.id, context.plan.id));
    }
  });
  let receiptUrl: string | null = null;
  if (chargeId) {
    try { receiptUrl = (await stripe.charges.retrieve(chargeId)).receipt_url; } catch { /* confirmation still sends */ }
  }
  const message = paymentSucceededEmail({
    ...context.email,
    remainingBalance: alreadyPaid
      ? context.email.remainingBalance
      : Math.max(0, context.email.remainingBalance - context.installment.amount),
    receiptUrl,
  });
  await deliverClubSeasonEmail(db, { registrationId: context.registration.id, installmentId, type: 'payment_succeeded',
    recipient: context.parentEmail, key: `club-season-success:${intent.id}`, ...message });
  return !alreadyPaid;
}

async function recordFailure(db: Db, installmentId: string, attemptNumber: number, code: string, message: string, actionRequired: boolean, siteUrl: string) {
  const context = await getContext(db, installmentId, siteUrl);
  if (context.installment.status === 'paid') return;
  const now = new Date().toISOString();
  const next = actionRequired ? null : retryDate(context.installment.dueDate, attemptNumber + 1);
  const final = actionRequired || !next;
  await db.transaction(async (tx) => {
    await tx.update(clubSeasonPaymentAttempts).set({ status: final ? 'requires_action' : 'failed', failureCode: code, failureMessage: message, resolvedAt: now, updatedAt: now })
      .where(and(eq(clubSeasonPaymentAttempts.installmentId, installmentId), eq(clubSeasonPaymentAttempts.attemptNumber, attemptNumber)));
    await tx.update(clubSeasonPaymentInstallments).set({ status: final ? 'action_required' : 'past_due', nextAttemptDate: next,
      lastFailureCode: code, lastFailureMessage: message, updatedAt: now }).where(eq(clubSeasonPaymentInstallments.id, installmentId));
    await tx.update(clubSeasonPaymentPlans).set({ financialStatus: final ? 'action_required' : 'past_due', needsReview: final, updatedAt: now })
      .where(eq(clubSeasonPaymentPlans.id, context.plan.id));
  });
  const emailContext = { ...context.email, attemptNumber };
  await deliverClubSeasonEmail(db, { registrationId: context.registration.id, installmentId, type: 'payment_failed', recipient: context.parentEmail,
    key: `club-season-failure:${installmentId}:${attemptNumber}`, ...paymentFailedEmail(emailContext, final) });
  if (final) await deliverClubSeasonEmail(db, { registrationId: context.registration.id, installmentId, type: 'admin_payment_alert', recipient: ADMIN_BILLING_EMAIL,
    key: `club-season-admin-alert:${installmentId}`, ...adminPaymentAlertEmail(emailContext, message) });
}

export async function recordInstallmentFailure(db: Db, intent: Stripe.PaymentIntent, siteUrl: string) {
  if (intent.metadata?.flow !== 'club_season_installment') return false;
  const installmentId = intent.metadata.installmentId;
  const attemptNumber = Number(intent.metadata.attemptNumber || 1);
  const error = intent.last_payment_error;
  const actionRequired = intent.status === 'requires_action' || error?.code === 'authentication_required';
  await recordFailure(db, installmentId, attemptNumber, error?.code || intent.status, error?.message || 'The card payment did not complete.', actionRequired, siteUrl);
  return true;
}

async function chargeInstallment(db: Db, stripe: Stripe, installmentId: string, siteUrl: string) {
  const context = await getContext(db, installmentId, siteUrl);
  if (context.plan.status !== 'active' || context.version.status !== 'active' || context.installment.status === 'paid') return false;
  const attemptNumber = context.installment.attemptCount + 1;
  if (attemptNumber > 3 || !context.plan.stripeCustomerId || !context.plan.stripePaymentMethodId) {
    await recordFailure(db, installmentId, Math.min(attemptNumber, 3), 'payment_method_missing', 'A reusable payment method is not available.', true, siteUrl);
    return false;
  }
  const now = new Date().toISOString();
  const key = `club-season:${installmentId}:attempt:${attemptNumber}`;
  const [attempt] = await db.insert(clubSeasonPaymentAttempts).values({
    id: crypto.randomUUID(), registrationId: context.registration.id, paymentPlanVersionId: context.version.id,
    installmentId, attemptNumber, idempotencyKey: key, amount: context.installment.amount,
    currency: context.version.currency, status: 'processing', attemptedAt: now, createdAt: now, updatedAt: now,
  }).onConflictDoNothing().returning();
  if (!attempt) return false;
  const [claimedInstallment] = await db.update(clubSeasonPaymentInstallments).set({
    status: 'processing', attemptCount: attemptNumber, lastAttemptedAt: now, updatedAt: now,
  }).where(and(
    eq(clubSeasonPaymentInstallments.id, installmentId),
    inArray(clubSeasonPaymentInstallments.status, ['scheduled', 'past_due'])
  )).returning({ id: clubSeasonPaymentInstallments.id });
  if (!claimedInstallment) {
    await db.update(clubSeasonPaymentAttempts).set({ status: 'skipped', resolvedAt: now, updatedAt: now })
      .where(eq(clubSeasonPaymentAttempts.id, attempt.id));
    return false;
  }
  let paymentMethodId = context.plan.stripePaymentMethodId;
  try {
    const customer = await stripe.customers.retrieve(context.plan.stripeCustomerId);
    if (!('deleted' in customer)) {
      const defaultMethod = customer.invoice_settings.default_payment_method;
      const currentDefaultId = typeof defaultMethod === 'string' ? defaultMethod : defaultMethod?.id;
      if (currentDefaultId) paymentMethodId = currentDefaultId;
    }
  } catch (error) {
    console.warn(`Could not refresh the payment method for installment ${installmentId}; using the authorized stored method.`, error);
  }
  if (paymentMethodId !== context.plan.stripePaymentMethodId) {
    await db.update(clubSeasonPaymentPlans).set({ stripePaymentMethodId: paymentMethodId, updatedAt: now })
      .where(eq(clubSeasonPaymentPlans.id, context.plan.id));
  }
  const confirmParams = {
    customer: context.plan.stripeCustomerId,
    payment_method: paymentMethodId,
    off_session: true as const,
    metadata: { flow: 'club_season_installment', installmentId, registrationId: context.registration.id,
      paymentPlanVersionId: context.version.id, attemptNumber: String(attemptNumber) },
  };
  try {
    const intent = context.installment.stripePaymentIntentId
      ? await stripe.paymentIntents.confirm(context.installment.stripePaymentIntentId, confirmParams, { idempotencyKey: key })
      : await stripe.paymentIntents.create({ amount: context.installment.amount, currency: context.version.currency,
          confirm: true, ...confirmParams }, { idempotencyKey: key });
    await db.update(clubSeasonPaymentAttempts).set({ stripePaymentIntentId: intent.id, updatedAt: now })
      .where(eq(clubSeasonPaymentAttempts.id, attempt.id));
    await db.update(clubSeasonPaymentInstallments).set({ stripePaymentIntentId: intent.id, updatedAt: now })
      .where(eq(clubSeasonPaymentInstallments.id, installmentId));
    if (intent.status === 'succeeded') await recordInstallmentSuccess(db, stripe, `worker:${intent.id}`, intent, siteUrl);
    else if (intent.status === 'requires_action' || intent.status === 'requires_payment_method') await recordInstallmentFailure(db, intent, siteUrl);
    return true;
  } catch (error: any) {
    const intent = error?.payment_intent as Stripe.PaymentIntent | undefined;
    if (intent) {
      await db.update(clubSeasonPaymentAttempts).set({ stripePaymentIntentId: intent.id, updatedAt: now }).where(eq(clubSeasonPaymentAttempts.id, attempt.id));
      await db.update(clubSeasonPaymentInstallments).set({ stripePaymentIntentId: intent.id, updatedAt: now }).where(eq(clubSeasonPaymentInstallments.id, installmentId));
      await recordInstallmentFailure(db, intent, siteUrl);
    } else {
      await recordFailure(db, installmentId, attemptNumber, error?.code || 'processor_error', error?.message || 'Stripe request failed.', false, siteUrl);
    }
    return false;
  }
}

export async function runClubSeasonBilling(input: { db: Db; stripe: Stripe; siteUrl: string; today?: string }) {
  const today = input.today || clubDate();
  const candidates = await input.db.select({ id: clubSeasonPaymentInstallments.id, dueDate: clubSeasonPaymentInstallments.dueDate,
    status: clubSeasonPaymentInstallments.status, nextAttemptDate: clubSeasonPaymentInstallments.nextAttemptDate })
    .from(clubSeasonPaymentInstallments)
    .innerJoin(clubSeasonPaymentPlanVersions, eq(clubSeasonPaymentInstallments.paymentPlanVersionId, clubSeasonPaymentPlanVersions.id))
    .innerJoin(clubSeasonPaymentPlans, eq(clubSeasonPaymentPlanVersions.paymentPlanId, clubSeasonPaymentPlans.id))
    .where(and(eq(clubSeasonPaymentInstallments.type, 'installment'), eq(clubSeasonPaymentPlans.status, 'active'),
      eq(clubSeasonPaymentPlanVersions.status, 'active'), inArray(clubSeasonPaymentInstallments.status, ['scheduled', 'past_due'])));
  let reminders = 0; let charges = 0;
  for (const item of candidates) {
    if (item.status === 'scheduled' && reminderDate(item.dueDate) === today) {
      const context = await getContext(input.db, item.id, input.siteUrl);
      const message = upcomingPaymentEmail(context.email);
      if (await deliverClubSeasonEmail(input.db, { registrationId: context.registration.id, installmentId: item.id, type: 'payment_reminder',
        recipient: context.parentEmail, key: `club-season-reminder:${item.id}`, ...message })) reminders++;
    }
    const chargeDate = item.status === 'scheduled' ? item.dueDate : item.nextAttemptDate;
    if (chargeDate && chargeDate <= today && await chargeInstallment(input.db, input.stripe, item.id, input.siteUrl)) charges++;
  }
  return { today, candidates: candidates.length, reminders, charges };
}
