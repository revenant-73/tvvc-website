import type { APIRoute } from 'astro';
import { getDb } from '../../db';
import { registrations, athletes, registrationItems, events } from '../../db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  try {
    const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;

    if (!databaseUrl) {
      return new Response(JSON.stringify({ error: 'Database configuration missing (TURSO_DATABASE_URL)' }), { status: 500 });
    }
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Payment configuration missing (STRIPE_SECRET_KEY). Please add it to your .env file.' }), { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });

    const body = await request.json();
    const { parentInfo, athletes: athleteData } = body;

    const db = getDb(
      databaseUrl,
      import.meta.env.TURSO_AUTH_TOKEN || ''
    );

    // 1. Calculate and Verify Total
    let totalCents = 0;
    const allEventIds = athleteData.flatMap((a: any) => a.selectedEvents);
    
    if (allEventIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No events selected.' }), { status: 400 });
    }

    const selectedEvents = await db.select().from(events).where(inArray(events.id, allEventIds));
    
    const lineItems = [];
    const registrationId = crypto.randomUUID();

    // Perform all DB operations inside a transaction
    const sessionUrl = await db.transaction(async (tx) => {
      for (const athlete of athleteData) {
        for (const eventId of athlete.selectedEvents) {
          const event = selectedEvents.find(e => e.id === eventId);
          if (!event) continue;
          
          // Verify capacity
          if (event.spotsFilled! >= event.capacity!) {
            throw new Error(`The event "${event.name}" is full.`);
          }

          totalCents += event.price;
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${event.name} - ${athlete.firstName} ${athlete.lastName}`,
                description: `${event.dateInfo} | ${event.timeInfo}`,
              },
              unit_amount: event.price,
            },
            quantity: 1,
          });
        }
      }

      if (totalCents === 0) {
        throw new Error('No events selected.');
      }

      // 2. Create internal registration record (Pending)
      await tx.insert(registrations).values({
        id: registrationId,
        parentName: parentInfo.name,
        parentEmail: parentInfo.email,
        parentPhone: parentInfo.phone,
        status: 'pending',
        totalAmount: totalCents,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      });

      for (const a of athleteData) {
        const [athleteResult] = await tx.insert(athletes).values({
          registrationId: registrationId,
          firstName: a.firstName,
          lastName: a.lastName,
          grade: a.grade,
          division: a.division || null,
          medicalInfo: a.medicalInfo,
          photoReleaseAgreed: a.photoReleaseAgreed || false,
          waiverAgreed: a.waiverAgreed || false,
          metadata: a.metadata ? JSON.stringify(a.metadata) : null,
        }).returning({ id: athletes.id });

        if (!athleteResult) {
          throw new Error('Failed to create athlete record');
        }

        const athleteId = athleteResult.id;

        for (const eventId of a.selectedEvents) {
          await tx.insert(registrationItems).values({
            registrationId,
            athleteId,
            eventId,
          });
        }
      }

      // 3. Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${new URL(request.url).origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${new URL(request.url).origin}/outdoor-events`,
        customer_email: parentInfo.email,
        metadata: {
          registrationId: registrationId,
        },
      });

      // Update registration with Stripe session ID
      await tx.update(registrations)
        .set({ stripeSessionId: session.id })
        .where(eq(registrations.id, registrationId));

      return session.url;
    });

    return new Response(JSON.stringify({ url: sessionUrl }), { status: 200 });

  } catch (err) {
    console.error('Registration API Error:', err);
    const message = err instanceof Error ? err.message : 'An internal error occurred.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

