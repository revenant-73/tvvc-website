import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { rejectCrossOriginRequest } from '../../../lib/request-security';
import { createStripeClient } from '../../../lib/stripe-client';
import { db } from '../../../db/db';
import { registrations, users } from '../../../db/schema';
import { and, desc, eq, isNotNull } from 'drizzle-orm';

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

    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe secret key missing' }), { status: 500 });
    }

    const stripe = createStripeClient(stripeSecretKey);

    let stripeCustomerId = (session.user as any).stripeCustomerId as string | null;

    // Claim the most recent legacy purchase for accounts created after checkout.
    if (!stripeCustomerId && session.user?.email) {
      const [legacyRegistration] = await db.select({
        stripeCustomerId: registrations.stripeCustomerId,
      })
        .from(registrations)
        .where(and(
          eq(registrations.parentEmail, session.user.email),
          eq(registrations.status, 'paid'),
          isNotNull(registrations.stripeCustomerId)
        ))
        .orderBy(desc(registrations.createdAt))
        .limit(1);

      stripeCustomerId = legacyRegistration?.stripeCustomerId || null;

      if (stripeCustomerId) {
        await db.update(users)
          .set({ stripeCustomerId })
          .where(eq(users.email, session.user.email));
      }
    }

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
