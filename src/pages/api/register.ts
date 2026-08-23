import type { APIRoute } from 'astro';
import { getDb } from '../../db';
import { registrations, athletes, playerProfiles, registrationItems, events } from '../../db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { getSession } from 'auth-astro/server';
import { createStripeClient } from '../../lib/stripe-client';
import { ensureCanonicalPortalUser } from '../../lib/portal-ownership';
import { getClubDate, isRegistrationEventEligible } from '../../lib/event-eligibility';

import { registrationSchema } from '../../lib/schemas';
import { rejectCrossOriginRequest } from '../../lib/request-security';

const CHECKOUT_EXPIRATION_SECONDS = 31 * 60;

class RegistrationUnavailableError extends Error {}
class RegistrationCapacityError extends Error {}

function isDatabaseBusyError(error: unknown): boolean {
  let current = error;

  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === 'SQLITE_BUSY') return true;
    current = candidate.cause;
  }

  return false;
}

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
    
    const portalUser = session
      ? await ensureCanonicalPortalUser(session.user)
      : null;
    const userId = portalUser?.id || null;

    const stripe = createStripeClient(stripeSecretKey);

    // If we have a stripeCustomerId for the user, use it
    let stripeCustomerId = portalUser?.stripeCustomerId || null;

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

    const lineItems = [];
    const registrationId = crypto.randomUUID();

    // Perform all DB operations inside a transaction
    const sessionUrl = await db.transaction(async (tx) => {
      const requestedEventIds = Array.from(new Set(allEventIds));
      const selectedEvents = await tx.select()
        .from(events)
        .where(inArray(events.id, requestedEventIds));
      const selectedEventsById = new Map(selectedEvents.map((event) => [event.id, event]));
      const clubDate = getClubDate();
      const unavailableEventIds = requestedEventIds.filter((eventId) => {
        const event = selectedEventsById.get(eventId);
        return !event || !isRegistrationEventEligible(event, clubDate);
      });

      if (unavailableEventIds.length > 0) {
        throw new RegistrationUnavailableError(
          'One or more selected events are no longer available. Refresh the page and choose an active event.'
        );
      }

      const requestedSpotsByEvent = allEventIds.reduce((counts, eventId) => {
        counts.set(eventId, (counts.get(eventId) || 0) + 1);
        return counts;
      }, new Map<string, number>());

      // Claim each event's complete requested quantity in one conditional
      // update. The capacity check and pending-spots increment therefore share
      // the same database write boundary, even across concurrent checkouts.
      for (const [eventId, requestedSpots] of requestedSpotsByEvent) {
        const event = selectedEventsById.get(eventId)!;
        const [reservedEvent] = await tx.update(events)
          .set({
            pendingSpots: sql`COALESCE(${events.pendingSpots}, 0) + ${requestedSpots}`,
          })
          .where(and(
            eq(events.id, eventId),
            sql`COALESCE(${events.spotsFilled}, 0) + COALESCE(${events.pendingSpots}, 0) + ${requestedSpots} <= ${events.capacity}`
          ))
          .returning({ id: events.id });

        if (!reservedEvent) {
          throw new RegistrationCapacityError(
            `The event "${event.name}" no longer has enough available spots.`
          );
        }
      }

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
        let profileId: number | null = null;

        if (a.profileId) {
          if (!userId) {
            throw new Error('Sign in to use a saved player profile.');
          }

          const [ownedProfile] = await tx.select({ id: playerProfiles.id })
            .from(playerProfiles)
            .where(and(
              eq(playerProfiles.id, a.profileId),
              eq(playerProfiles.parentId, userId),
              isNull(playerProfiles.archivedAt),
              isNull(playerProfiles.mergedIntoProfileId)
            ))
            .limit(1);

          if (!ownedProfile) {
            throw new Error('Saved player profile not found.');
          }

          profileId = ownedProfile.id;
          await tx.update(playerProfiles)
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
              updatedAt: new Date().toISOString(),
            })
            .where(and(
              eq(playerProfiles.id, profileId),
              eq(playerProfiles.parentId, userId),
              isNull(playerProfiles.archivedAt),
              isNull(playerProfiles.mergedIntoProfileId)
            ));
        } else if (userId) {
          const [profile] = await tx.insert(playerProfiles).values({
            parentId: userId,
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
          }).returning({ id: playerProfiles.id });

          if (!profile) {
            throw new Error('Failed to create player profile.');
          }

          profileId = profile.id;
        }

        const [athleteSnapshot] = await tx.insert(athletes).values({
          registrationId,
          parentId: userId,
          profileId,
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
          photoReleaseAgreed: a.photoReleaseAgreed,
          waiverAgreed: a.waiverAgreed,
          metadata: a.metadata ? JSON.stringify(a.metadata) : null,
        }).returning({ id: athletes.id });

        if (!athleteSnapshot) {
          throw new Error('Failed to create registration athlete snapshot.');
        }

        for (const eventId of a.selectedEvents) {
          await tx.insert(registrationItems).values({
            registrationId,
            athleteId: athleteSnapshot.id,
            eventId,
          });
        }
      }

      // 3. Create Stripe Checkout Session
      // Stripe requires an expiration at least 30 minutes after session
      // creation. Calculate it at the Stripe boundary and persist that exact
      // epoch in the database after creation so both systems agree.
      const checkoutExpiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRATION_SECONDS;
      const reservationExpiresAt = new Date(checkoutExpiresAt * 1000);
      const stripeSessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${new URL(request.url).origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${new URL(request.url).origin}/`,
        metadata: {
          registrationId: registrationId,
        },
        expires_at: checkoutExpiresAt,
      };

      if (stripeCustomerId) {
        stripeSessionParams.customer = stripeCustomerId;
      } else {
        stripeSessionParams.customer_creation = 'always';
        stripeSessionParams.customer_email = parentInfo.email;
      }

      const checkoutSession = await stripe.checkout.sessions.create(stripeSessionParams);

      // Update registration with Stripe session ID
      await tx.update(registrations)
        .set({
          stripeSessionId: checkoutSession.id,
          expiresAt: reservationExpiresAt,
        })
        .where(eq(registrations.id, registrationId));

      return checkoutSession.url;
    });

    return new Response(JSON.stringify({ url: sessionUrl }), { status: 200 });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'An internal error occurred.';
    if (err instanceof RegistrationUnavailableError) {
      return new Response(JSON.stringify({ error: message }), { status: 400 });
    }
    if (err instanceof RegistrationCapacityError) {
      return new Response(JSON.stringify({ error: message }), { status: 409 });
    }
    if (isDatabaseBusyError(err)) {
      return new Response(JSON.stringify({
        error: 'Another checkout is reserving these spots. Refresh and try again.',
      }), { status: 409 });
    }

    console.error('Registration API Error:', err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
