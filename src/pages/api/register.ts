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

    for (const athlete of athleteData) {
      for (const eventId of athlete.selectedEvents) {
        const event = selectedEvents.find(e => e.id === eventId);
        if (!event) continue;
        
        // Verify capacity
        if (event.spotsFilled! >= event.capacity!) {
          return new Response(JSON.stringify({ error: `The event "${event.name}" is full.` }), { status: 400 });
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
      return new Response(JSON.stringify({ error: 'No events selected.' }), { status: 400 });
    }

    // 2. Create internal registration record (Pending)
    const registrationId = crypto.randomUUID();
    
    await db.insert(registrations).values({
      id: registrationId,
      parentName: parentInfo.name,
      parentEmail: parentInfo.email,
      parentPhone: parentInfo.phone,
      status: 'pending',
      totalAmount: totalCents,
    });

    for (const a of athleteData) {
      const [athleteResult] = await db.insert(athletes).values({
        registrationId: registrationId,
        firstName: a.firstName,
        lastName: a.lastName,
        grade: a.grade,
        division: a.division || null,
        medicalInfo: a.medicalInfo,
        photoReleaseAgreed: a.photoReleaseAgreed || false,
        waiverAgreed: a.waiverAgreed || false,
      }).returning({ id: athletes.id });

      if (!athleteResult) {
        throw new Error('Failed to create athlete record');
      }

      const athleteId = athleteResult.id;

      for (const eventId of a.selectedEvents) {
        await db.insert(registrationItems).values({
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
    await db.update(registrations)
      .set({ stripeSessionId: session.id })
      .where(eq(registrations.id, registrationId));

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });

  } catch (err) {
    console.error('Registration API Error:', err);
    const message = err instanceof Error ? err.message : 'An internal error occurred.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

