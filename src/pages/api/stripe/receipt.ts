import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSession } from 'auth-astro/server';
import { createStripeClient } from '../../../lib/stripe-client';
import { db } from '../../../db/db';
import { registrations } from '../../../db/schema';
import { and, eq } from 'drizzle-orm';
import { ensureCanonicalPortalUser } from '../../../lib/portal-ownership';

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const portalUser = await ensureCanonicalPortalUser(session.user);
    if (!portalUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const registrationId = new URL(request.url).searchParams.get('registrationId');
    if (!registrationId) {
      return new Response(JSON.stringify({ error: 'Missing registration ID' }), { status: 400 });
    }

    const [registration] = await db.select()
      .from(registrations)
      .where(and(
        eq(registrations.id, registrationId),
        eq(registrations.userId, portalUser.id)
      ))
      .limit(1);

    if (!registration || !registration.stripeSessionId) {
      return new Response(JSON.stringify({ error: 'Receipt not found' }), { status: 404 });
    }

    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe configuration missing' }), { status: 500 });
    }

    const stripe = createStripeClient(stripeSecretKey);
    const checkoutSession = await stripe.checkout.sessions.retrieve(
      registration.stripeSessionId,
      { expand: ['payment_intent.latest_charge'] }
    );
    let paymentIntent = checkoutSession.payment_intent;
    if (typeof paymentIntent === 'string') {
      paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntent,
        { expand: ['latest_charge'] }
      );
    }

    let charge = paymentIntent?.latest_charge;
    if (typeof charge === 'string') {
      charge = await stripe.charges.retrieve(charge);
    }

    if (!charge?.receipt_url) {
      return new Response(JSON.stringify({ error: 'Stripe receipt is not available yet' }), { status: 404 });
    }

    return new Response(JSON.stringify({ url: charge.receipt_url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe Receipt Error:', error);
    return new Response(JSON.stringify({ error: 'Unable to load receipt' }), { status: 500 });
  }
};
