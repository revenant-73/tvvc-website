import type { APIRoute } from 'astro';
import { getDb } from '../../db';
import { registrations, athletes, registrationItems, events } from '../../db/schema';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { getSession } from 'auth-astro/server';

import { registrationSchema } from '../../lib/schemas';
import { rejectCrossOriginRequest } from '../../lib/request-security';

export const POST: APIRoute = async ({ request }) => {
  try {
    const originError = rejectCrossOriginRequest(request);
    if (originError) return originError;

    const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;

    if (!databaseUrl) {
      return new Response(JSON.stringify({ error: 'Database configuration missing (TURSO_DATABASE_URL)' }), { status: 500 });
    }
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Payment configuration missing (STRIPE_SECRET_KEY). Please add it to your .env file.' }), { status: 500 });
    }

    let session = null;
    try {
      session = await getSession(request);
    } catch (authErr) {
      console.error('Auth Session Error (non-fatal):', authErr);
    }
    
    // Ensure userId is either a valid string or null (never empty string)
    const rawUserId = (session?.user as any)?.id;
    const userId = (typeof rawUserId === 'string' && rawUserId.trim() !== '') ? rawUserId : null;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });

    // If we have a stripeCustomerId for the user, use it
    let stripeCustomerId = (session?.user as any)?.stripeCustomerId;

    const body = await request.json();
    
    // Validate request body
    const validation = registrationSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        details: validation.error.flatten().fieldErrors 
      }), { status: 400 });
    }

    const { parentInfo, athletes: athleteData } = validation.data;

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
      // For training blocks, we charge once per unique block across all athletes in the request
      const uniqueTrainingBlockIds = new Set(
        athleteData.flatMap((a: any) => a.selectedEvents)
          .filter((id: string) => {
            const event = selectedEvents.find(e => e.id === id);
            return event?.type === 'training-block';
          })
      );
      const orderItems: Array<{
        eventId: string;
        eventName: string;
        eventDate: string;
        eventTime: string | null;
        athleteName: string;
        unitAmount: number;
      }> = [];

      // Handle other events normally (per-athlete charge)
      for (const athlete of athleteData) {
        for (const eventId of athlete.selectedEvents) {
          const event = selectedEvents.find(e => e.id === eventId);
          if (!event) continue;

          // Check combined capacity (Filled + Pending)
          if ((event.spotsFilled || 0) + (event.pendingSpots || 0) >= (event.capacity || 0)) {
            throw new Error(`The event "${event.name}" is full.`);
          }

          // Increment pending spots immediately to "reserve" it
          await tx.update(events)
            .set({ pendingSpots: sql`${events.pendingSpots} + 1` })
            .where(eq(events.id, eventId));

          // ONLY add to total and line items if NOT a training block 
          if (event.type !== 'training-block') {
            totalCents += event.price;
            orderItems.push({
              eventId: event.id,
              eventName: event.name,
              eventDate: event.dateInfo,
              eventTime: event.timeInfo,
              athleteName: `${athlete.firstName} ${athlete.lastName}`,
              unitAmount: event.price,
            });
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
      }

      // Now add the flat-fee training blocks to the total
      for (const blockId of Array.from(uniqueTrainingBlockIds)) {
        const event = selectedEvents.find(e => e.id === blockId);
        if (!event) continue;

        totalCents += event.price;
        const athleteNames = athleteData
          .filter((athlete) => athlete.selectedEvents.includes(blockId))
          .map((athlete) => `${athlete.firstName} ${athlete.lastName}`)
          .join(', ');
        orderItems.push({
          eventId: event.id,
          eventName: event.name,
          eventDate: event.dateInfo,
          eventTime: event.timeInfo,
          athleteName: athleteNames,
          unitAmount: event.price,
        });
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${event.name}`,
              description: `${event.dateInfo} | ${event.timeInfo} (Group Registration)`,
            },
            unit_amount: event.price,
          },
          quantity: 1,
        });
      }

      if (totalCents === 0) {
        throw new Error('No events selected.');
      }

      // 2. Create internal registration record (Pending)
      await tx.insert(registrations).values({
        id: registrationId,
        userId: userId || null,
        parentName: parentInfo.name,
        parentEmail: parentInfo.email,
        parentPhone: parentInfo.phone,
        secondaryParentName: parentInfo.secondaryParentName || null,
        secondaryParentEmail: parentInfo.secondaryParentEmail || null,
        secondaryParentPhone: parentInfo.secondaryParentPhone || null,
        emergencyPhone: parentInfo.emergencyPhone,
        status: 'pending',
        totalAmount: totalCents,
        stripeCustomerId: stripeCustomerId || null,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minute reservation
        metadata: JSON.stringify({
          ...(validation.data.metadata || {}),
          orderItems,
          agreements: athleteData.map((athlete) => ({
            profileId: athlete.profileId || null,
            athleteName: `${athlete.firstName} ${athlete.lastName}`,
            waiverAgreed: athlete.waiverAgreed,
            photoReleaseAgreed: athlete.photoReleaseAgreed,
            acceptedAt: new Date().toISOString(),
          })),
        }),
      });

      for (const a of athleteData) {
        let athleteId: number;

        if (a.profileId) {
          if (!userId || !session?.user?.email) {
            throw new Error('Sign in to use a saved player profile.');
          }

          const [ownedAthlete] = await tx.select({ id: athletes.id })
            .from(athletes)
            .leftJoin(registrations, eq(athletes.registrationId, registrations.id))
            .where(and(
              eq(athletes.id, a.profileId),
              or(
                eq(athletes.parentId, userId),
                eq(registrations.parentEmail, session.user.email)
              )
            ))
            .limit(1);

          if (!ownedAthlete) {
            throw new Error('Saved player profile not found.');
          }

          athleteId = ownedAthlete.id;
          await tx.update(athletes)
            .set({
              firstName: a.firstName,
              lastName: a.lastName,
              preferredName: a.preferredName || null,
              dateOfBirth: a.dateOfBirth || null,
              gender: a.gender || null,
              grade: a.grade,
              school: a.school || null,
              gradYear: a.gradYear || null,
              division: a.division || null,
              tshirtSize: a.tshirtSize || null,
              jerseySize: a.jerseySize || null,
              experience: a.experience || null,
              positions: a.positions || null,
              medicalInfo: a.medicalInfo,
              metadata: a.metadata ? JSON.stringify(a.metadata) : null,
            })
            .where(eq(athletes.id, athleteId));
        } else {
          const [athleteResult] = await tx.insert(athletes).values({
            registrationId: registrationId,
            parentId: userId || null,
            firstName: a.firstName,
            lastName: a.lastName,
            preferredName: a.preferredName || null,
            dateOfBirth: a.dateOfBirth || null,
            gender: a.gender || null,
            grade: a.grade,
            school: a.school || null,
            gradYear: a.gradYear || null,
            division: a.division || null,
            tshirtSize: a.tshirtSize || null,
            jerseySize: a.jerseySize || null,
            experience: a.experience || null,
            positions: a.positions || null,
            medicalInfo: a.medicalInfo,
            photoReleaseAgreed: a.photoReleaseAgreed || false,
            waiverAgreed: a.waiverAgreed || false,
            metadata: a.metadata ? JSON.stringify(a.metadata) : null,
          }).returning({ id: athletes.id });

          if (!athleteResult) {
            throw new Error('Failed to create athlete record');
          }

          athleteId = athleteResult.id;
        }

        for (const eventId of a.selectedEvents) {
          await tx.insert(registrationItems).values({
            registrationId,
            athleteId,
            eventId,
          });
        }
      }

      // 3. Create Stripe Checkout Session
      const stripeSessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${new URL(request.url).origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${new URL(request.url).origin}/outdoor-events`,
        metadata: {
          registrationId: registrationId,
        },
      };

      if (stripeCustomerId) {
        stripeSessionParams.customer = stripeCustomerId;
      } else {
        stripeSessionParams.customer_creation = 'always';
        stripeSessionParams.customer_email = parentInfo.email;
      }

      const session = await stripe.checkout.sessions.create(stripeSessionParams);

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
