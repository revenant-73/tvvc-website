import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSession } from 'auth-astro/server';
import { db } from '../../../db/db';
import { registrations, users } from '../../../db/schema';
import { and, eq, or } from 'drizzle-orm';

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const registrationId = new URL(request.url).searchParams.get('registrationId');
    if (!registrationId) {
      return new Response(JSON.stringify({ error: 'Missing registration ID' }), { status: 400 });
    }

    const [dbUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);

    const ownershipCondition = dbUser?.id
      ? or(
          eq(registrations.userId, dbUser.id),
          eq(registrations.parentEmail, session.user.email)
        )
      : eq(registrations.parentEmail, session.user.email);

    const [registration] = await db.select()
      .from(registrations)
      .where(and(
        eq(registrations.id, registrationId),
        ownershipCondition
      ))
      .limit(1);

    if (!registration || !registration.stripeSessionId) {
      return new Response(JSON.stringify({ error: 'Receipt not found' }), { status: 404 });
    }

    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe configuration missing' }), { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });
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
