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
  
  if (!sig || !endpointSecret) {
    console.error('Webhook Error: Missing stripe-signature or endpoint secret');
    return new Response('Webhook Error: Missing signature or secret', { status: 400 });
  }

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook Error (constructEvent):', err);
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

    console.log('Received checkout.session.completed for registration:', registrationId);

    if (registrationId) {
      console.log(`Processing successful registration: ${registrationId}`);
      
      try {
        // 1. Update Registration Status
        const updateReg = await db.update(registrations)
          .set({ status: 'paid' })
          .where(eq(registrations.id, registrationId))
          .returning();
        
        if (updateReg.length === 0) {
          console.warn(`Registration ${registrationId} not found in database during webhook processing.`);
        } else {
          console.log(`Registration ${registrationId} status updated to "paid".`);
        }

        // 2. Increment Spots Filled for each event in this registration
        const items = await db.select().from(registrationItems).where(eq(registrationItems.registrationId, registrationId));
        
        console.log(`Found ${items.length} registration items to process.`);
        
        for (const item of items) {
          if (item.eventId) {
            await db.update(events)
              .set({ spotsFilled: sql`${events.spotsFilled} + 1` })
              .where(eq(events.id, item.eventId));
            console.log(`Incremented spotsFilled for event: ${item.eventId}`);
          }
        }
        
        console.log(`Registration ${registrationId} fully finalized.`);
      } catch (dbErr) {
        console.error('Database Error during webhook processing:', dbErr);
        return new Response('Database error', { status: 500 });
      }
    } else {
      console.error('No registrationId found in session metadata');
    }
  } else {
    console.log(`Received unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
