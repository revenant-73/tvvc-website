import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { rejectCrossOriginRequest } from '../../../lib/request-security';
import { createStripeClient } from '../../../lib/stripe-client';
import { ensureCanonicalPortalUser } from '../../../lib/portal-ownership';

export const POST: APIRoute = async ({ request }) => {
  try {
    const originError = rejectCrossOriginRequest(request);
    if (originError) return originError;

    let session = null;
    try {
      session = await getSession(request);
    } catch (authErr) {
      console.error('Auth Session Error (non-fatal):', authErr);
    }
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const portalUser = await ensureCanonicalPortalUser(session.user);
    if (!portalUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe secret key missing' }), { status: 500 });
    }

    const stripe = createStripeClient(stripeSecretKey);

    const stripeCustomerId = portalUser.stripeCustomerId;

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
