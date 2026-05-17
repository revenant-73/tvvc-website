import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { registrations, events, registrationItems } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, endpointSecret!);
  } catch (err) {
    console.error('Webhook Error:', err);
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown Error'}`, { status: 400 });
  }

  const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    return new Response('Database configuration missing', { status: 500 });
  }

  const db = getDb(
    databaseUrl,
    import.meta.env.TURSO_AUTH_TOKEN || ''
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const registrationId = session.metadata?.registrationId;

    if (registrationId) {
      console.log(`Processing successful registration: ${registrationId}`);
      
      // 1. Update Registration Status
      await db.update(registrations)
        .set({ status: 'paid' })
        .where(eq(registrations.id, registrationId));

      // 2. Increment Spots Filled for each event in this registration
      const items = await db.select().from(registrationItems).where(eq(registrationItems.registrationId, registrationId));
      
      for (const item of items) {
        if (item.eventId) {
          await db.update(events)
            .set({ spotsFilled: sql`${events.spotsFilled} + 1` })
            .where(eq(events.id, item.eventId));
        }
      }
      
      console.log(`Registration ${registrationId} finalized.`);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
