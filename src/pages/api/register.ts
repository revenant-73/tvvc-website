import type { APIRoute } from 'astro';
import { getDb } from '../../db';
import { registrations, athletes, registrationItems, events } from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { parentInfo, athletes: athleteData } = body;

    const db = getDb(
      import.meta.env.TURSO_DATABASE_URL || '',
      import.meta.env.TURSO_AUTH_TOKEN || ''
    );

    // 1. Calculate and Verify Total
    let totalCents = 0;
    const allEventIds = athleteData.flatMap((a: any) => a.selectedEvents);
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
    const registrationId = uuidv4();
    
    await db.insert(registrations).values({
      id: registrationId,
      parentName: parentInfo.name,
      parentEmail: parentInfo.email,
      parentPhone: parentInfo.phone,
      status: 'pending',
      totalAmount: totalCents,
    });

    for (const a of athleteData) {
      const athleteResult = await db.insert(athletes).values({
        registrationId: registrationId,
        firstName: a.firstName,
        lastName: a.lastName,
        grade: a.grade,
        medicalInfo: a.medicalInfo,
        tshirtSize: a.tshirtSize,
        photoReleaseAgreed: a.photoReleaseAgreed,
        waiverAgreed: a.waiverAgreed,
      }).returning({ id: athletes.id });

      const athleteId = athleteResult[0].id;

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
      success_url: `${request.url.split('/api')[0]}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.url.split('/api')[0]}/register`,
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
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500 });
  }
};
