import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { registrations, events, registrationItems, users, athletes } from '../../../db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
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
    const stripeCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id || null;

    console.log('Received checkout.session.completed for registration:', registrationId);

    if (registrationId) {
      console.log(`Processing successful registration: ${registrationId}`);
      
      try {
        const finalizedRegistration = await db.transaction(async (tx) => {
          const [registration] = await tx.select()
            .from(registrations)
            .where(eq(registrations.id, registrationId))
            .limit(1);

          if (!registration) {
            console.warn(`Registration ${registrationId} was not found for Stripe event ${event.id}.`);
            return null;
          }

          const paymentIsValid =
            session.id === registration.stripeSessionId &&
            session.payment_status === 'paid' &&
            session.amount_total === registration.totalAmount &&
            session.currency?.toLowerCase() === 'usd';

          if (!paymentIsValid) {
            await tx.update(registrations)
              .set({ needsReview: true })
              .where(eq(registrations.id, registrationId));
            console.error(`Stripe payment verification failed for registration ${registrationId} and event ${event.id}.`);
            return null;
          }

          // This conditional transition is the idempotency boundary. Only one
          // delivery can move an eligible registration into the paid state.
          const [updateReg] = await tx.update(registrations)
            .set({ 
              status: 'paid',
              stripeCustomerId: stripeCustomerId
            })
            .where(and(
              eq(registrations.id, registrationId),
              eq(registrations.stripeSessionId, session.id),
              inArray(registrations.status, ['pending', 'expired'])
            ))
            .returning();
          
          if (!updateReg) {
            console.log(`Stripe event ${event.id} did not transition registration ${registrationId}; it was already finalized or is no longer payable.`);
            return null;
          }

          // 2. Link Stripe Customer ID to User if not already set
          if (updateReg.userId && stripeCustomerId) {
            await tx.update(users)
              .set({ stripeCustomerId: stripeCustomerId })
              .where(and(
                eq(users.id, updateReg.userId),
                sql`${users.stripeCustomerId} IS NULL`
              ));
          }

          console.log(`Registration ${registrationId} status updated to "paid".`);

          // 2. Increment Spots Filled, Decrement Pending Spots
          const items = await tx.select().from(registrationItems).where(eq(registrationItems.registrationId, registrationId));
          
          console.log(`Found ${items.length} registration items to process.`);
          
          let overCapacity = false;

          for (const item of items) {
            if (item.eventId) {
              // Atomically update both counters
              const [updatedEvent] = await tx.update(events)
                .set({ 
                  spotsFilled: sql`${events.spotsFilled} + 1`,
                  pendingSpots: sql`MAX(0, ${events.pendingSpots} - 1)`
                })
                .where(eq(events.id, item.eventId))
                .returning();

              if (updatedEvent && updatedEvent.spotsFilled! > updatedEvent.capacity!) {
                console.warn(`Event ${item.eventId} is now OVER CAPACITY (${updatedEvent.spotsFilled}/${updatedEvent.capacity})`);
                overCapacity = true;
              }

              console.log(`Updated spots for event: ${item.eventId}`);
            }
          }

          if (overCapacity) {
            await tx.update(registrations)
              .set({ needsReview: true })
              .where(eq(registrations.id, registrationId));
            
            // Notify Admin
            try {
              await sendEmail({
                to: 'loren@tualatinvalleyvb.com',
                subject: '🚨 OVER-ENROLLMENT ALERT: Review Required',
                html: `
                  <div style="font-family: sans-serif; padding: 20px; border: 2px solid #E85D4E; border-radius: 8px;">
                    <h2 style="color: #E85D4E;">Action Required: Over-Enrollment</h2>
                    <p>Registration <strong>${registrationId}</strong> has resulted in an event exceeding its capacity.</p>
                    <p><strong>Parent:</strong> ${updateReg.parentName} (${updateReg.parentEmail})</p>
                    <p>Please check the <a href="${new URL(request.url).origin}/admin/registrations?auth=true">Admin Dashboard</a> to manage this registration.</p>
                  </div>
                `
              });
            } catch (notifyErr) {
              console.error('Failed to send admin alert email:', notifyErr);
            }
          }

          return updateReg;
        });

        if (!finalizedRegistration) {
          return new Response(JSON.stringify({ received: true, processed: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
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
