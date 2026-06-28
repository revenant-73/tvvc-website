import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSession } from 'auth-astro/server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe secret key missing' }), { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });

    const stripeCustomerId = (session.user as any).stripeCustomerId;

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ 
        error: 'No Stripe customer profile found. You must make a purchase first to create a billing profile.' 
      }), { status: 400 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${new URL(request.url).origin}/portal/dashboard`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), { status: 200 });
  } catch (err) {
    console.error('Stripe Portal Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
