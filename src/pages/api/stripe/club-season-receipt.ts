import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { getSession } from 'auth-astro/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/db';
import {
  clubSeasonPaymentInstallments,
  clubSeasonPaymentTransactions,
  clubSeasonRegistrations,
} from '../../../db/schema';
import { ensureCanonicalPortalUser } from '../../../lib/portal-ownership';
import { createStripeClient } from '../../../lib/stripe-client';

const json = (body: Record<string, string>, status: number) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  }
);

async function receiptFromCharge(stripe: Stripe, chargeId: string | null) {
  if (!chargeId) return null;
  try {
    return (await stripe.charges.retrieve(chargeId)).receipt_url || null;
  } catch {
    return null;
  }
}

async function receiptFromPaymentIntent(stripe: Stripe, paymentIntentId: string | null) {
  if (!paymentIntentId) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
    const charge = intent.latest_charge;
    if (!charge) return null;
    if (typeof charge === 'string') return receiptFromCharge(stripe, charge);
    return charge.receipt_url || null;
  } catch {
    return null;
  }
}

async function receiptFromCheckoutSession(stripe: Stripe, checkoutSessionId: string | null) {
  if (!checkoutSessionId) return null;
  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ['payment_intent.latest_charge'],
    });
    const intent = checkoutSession.payment_intent;
    if (!intent) return null;
    if (typeof intent === 'string') return receiptFromPaymentIntent(stripe, intent);
    const charge = intent.latest_charge;
    if (!charge) return null;
    if (typeof charge === 'string') return receiptFromCharge(stripe, charge);
    return charge.receipt_url || null;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ request }) => {
  const notFound = () => json({ error: 'Receipt not found' }, 404);

  try {
    const session = await getSession(request);
    if (!session) return json({ error: 'Unauthorized' }, 401);

    const canonicalUser = await ensureCanonicalPortalUser(session.user);
    if (!canonicalUser) return json({ error: 'Unauthorized' }, 401);

    const transactionId = new URL(request.url).searchParams.get('transactionId')?.trim();
    if (!transactionId) return notFound();

    const [transaction] = await db.select({
      stripeChargeId: clubSeasonPaymentTransactions.stripeChargeId,
      stripePaymentIntentId: clubSeasonPaymentTransactions.stripePaymentIntentId,
      stripeCheckoutSessionId: clubSeasonPaymentTransactions.stripeCheckoutSessionId,
    })
      .from(clubSeasonPaymentTransactions)
      .innerJoin(
        clubSeasonRegistrations,
        eq(clubSeasonPaymentTransactions.registrationId, clubSeasonRegistrations.id)
      )
      .innerJoin(
        clubSeasonPaymentInstallments,
        eq(clubSeasonPaymentTransactions.installmentId, clubSeasonPaymentInstallments.id)
      )
      .where(and(
        eq(clubSeasonPaymentTransactions.id, transactionId),
        eq(clubSeasonPaymentTransactions.status, 'succeeded'),
        eq(clubSeasonRegistrations.ownerUserId, canonicalUser.id),
        inArray(clubSeasonPaymentInstallments.type, ['deposit', 'full_payment'])
      ))
      .limit(1);

    if (!transaction) return notFound();

    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) return json({ error: 'Stripe configuration missing' }, 500);

    const stripe = createStripeClient(stripeSecretKey);
    const receiptUrl = await receiptFromCharge(stripe, transaction.stripeChargeId)
      || await receiptFromPaymentIntent(stripe, transaction.stripePaymentIntentId)
      || await receiptFromCheckoutSession(stripe, transaction.stripeCheckoutSessionId);

    if (!receiptUrl) return notFound();
    return json({ url: receiptUrl }, 200);
  } catch (error) {
    console.error('Club season receipt error:', error);
    return json({ error: 'Unable to load receipt' }, 500);
  }
};
