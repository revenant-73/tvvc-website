import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { registrations, events, registrationItems, users, athletes } from '../../../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import Stripe from 'stripe';
import { sendEmail } from '../../../lib/email';
import { generateRegistrationEmail } from '../../../lib/email-templates';

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
    const stripeCustomerId = session.customer as string;

    console.log('Received checkout.session.completed for registration:', registrationId);

    if (registrationId) {
      console.log(`Processing successful registration: ${registrationId}`);
      
      try {
        await db.transaction(async (tx) => {
          // 1. Update Registration Status and store Customer ID
          const updateReg = await tx.update(registrations)
            .set({ 
              status: 'paid',
              stripeCustomerId: stripeCustomerId
            })
            .where(eq(registrations.id, registrationId))
            .returning();
          
          if (updateReg.length === 0) {
            console.warn(`Registration ${registrationId} not found in database during webhook processing.`);
            return;
          }

          // 2. Link Stripe Customer ID to User if not already set
          if (updateReg[0].userId) {
            await tx.update(users)
              .set({ stripeCustomerId: stripeCustomerId })
              .where(and(
                eq(users.id, updateReg[0].userId),
                sql`${users.stripeCustomerId} IS NULL`
              ));
          }

          console.log(`Registration ${registrationId} status updated to "paid".`);

          // 2. Increment Spots Filled for each event in this registration
          const items = await tx.select().from(registrationItems).where(eq(registrationItems.registrationId, registrationId));
          
          console.log(`Found ${items.length} registration items to process.`);
          
          for (const item of items) {
            if (item.eventId) {
              await tx.update(events)
                .set({ spotsFilled: sql`${events.spotsFilled} + 1` })
                .where(eq(events.id, item.eventId));
              console.log(`Incremented spotsFilled for event: ${item.eventId}`);
            }
          }
        });
        
        console.log(`Registration ${registrationId} fully finalized. Preparing confirmation email...`);

        // Send Confirmation Email
        try {
          const [registration] = await db.select().from(registrations).where(eq(registrations.id, registrationId));
          const itemsWithData = await db.select({
            athlete: athletes,
            event: events
          })
          .from(registrationItems)
          .innerJoin(athletes, eq(registrationItems.athleteId, athletes.id))
          .innerJoin(events, eq(registrationItems.eventId, events.id))
          .where(eq(registrationItems.registrationId, registrationId));

          if (registration && itemsWithData.length > 0) {
            const emailHtml = generateRegistrationEmail(registration, itemsWithData);
            const eventNames = [...new Set(itemsWithData.map(i => i.event.name))].join(', ');
            
            await sendEmail({
              to: registration.parentEmail,
              subject: `TVVC Registration Confirmed: ${eventNames}`,
              html: emailHtml
            });
            console.log(`Confirmation email sent to ${registration.parentEmail} for registration ${registrationId}`);
          }
        } catch (emailErr) {
          console.error('Error sending confirmation email:', emailErr);
          // Don't return 500 here, the registration itself was successful
        }

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
