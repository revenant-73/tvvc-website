import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import {
  registrations,
  events,
  registrationItems,
  users,
  athletes,
  clubSeasonOffers,
  clubSeasonPaymentInstallments,
  clubSeasonPaymentPlans,
  clubSeasonPaymentPlanVersions,
  clubSeasonPaymentTransactions,
  clubSeasonRegistrations,
} from '../../../db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import Stripe from 'stripe';
import { sendEmail } from '../../../lib/email';
import { generateRegistrationEmail } from '../../../lib/email-templates';
import { expirePendingRegistration } from '../../../lib/registration-reservations';
import { createStripeClient } from '../../../lib/stripe-client';
import {
  deliverClubSeasonCheckoutSuccess,
  recordInstallmentFailure,
  recordInstallmentSuccess,
} from '../../../lib/club-season-billing';

const stripe = createStripeClient(import.meta.env.STRIPE_SECRET_KEY || '');

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const prerender = false;

async function processClubSeasonCheckout(
  db: ReturnType<typeof getDb>,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  siteUrl: string
) {
  const registrationId = session.metadata?.registrationId;
  const paymentPlanId = session.metadata?.paymentPlanId;
  const paymentPlanVersionId = session.metadata?.paymentPlanVersionId;
  if (!registrationId || !paymentPlanId || !paymentPlanVersionId) {
    console.error(`Club season Stripe event ${event.id} is missing required metadata.`);
    return false;
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null;
  if (!paymentIntentId) {
    console.error(`Club season Stripe event ${event.id} has no PaymentIntent.`);
    return false;
  }

  const [version] = await db.select().from(clubSeasonPaymentPlanVersions)
    .where(eq(clubSeasonPaymentPlanVersions.id, paymentPlanVersionId))
    .limit(1);
  if (!version) {
    console.error(`Club season payment plan version ${paymentPlanVersionId} was not found.`);
    return false;
  }

  const paymentIsValid =
    version.paymentPlanId === paymentPlanId &&
    version.stripeCheckoutSessionId === session.id &&
    session.payment_status === 'paid' &&
    session.amount_total === version.dueNowAmount &&
    session.currency?.toLowerCase() === version.currency;
  if (!paymentIsValid) {
    if (version.stripeCheckoutSessionId === session.id) {
      await db.update(clubSeasonPaymentPlans).set({
        needsReview: true,
        updatedAt: new Date().toISOString(),
      }).where(eq(clubSeasonPaymentPlans.id, version.paymentPlanId));
    }
    console.error(`Club season Stripe payment verification failed for event ${event.id}.`);
    return false;
  }

  const stripeCustomerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id || null;
  let stripePaymentMethodId: string | null = null;
  if (version.paymentOption !== 'pay_in_full') {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    stripePaymentMethodId = typeof paymentIntent.payment_method === 'string'
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id || null;
    if (!stripeCustomerId || !stripePaymentMethodId) {
      throw new Error('Installment plan checkout did not return a reusable Stripe payment method.');
    }
  }

  const [deposit] = await db.select().from(clubSeasonPaymentInstallments)
    .where(and(
      eq(clubSeasonPaymentInstallments.paymentPlanVersionId, paymentPlanVersionId),
      eq(clubSeasonPaymentInstallments.sequence, 0)
    ))
    .limit(1);
  if (!deposit) {
    throw new Error('Club season checkout references an incomplete payment record.');
  }

  const processedAt = new Date().toISOString();
  const processed = await db.transaction(async (tx) => {
    const [plan] = await tx.select().from(clubSeasonPaymentPlans)
      .where(eq(clubSeasonPaymentPlans.id, paymentPlanId))
      .limit(1);
    const [registration] = await tx.select().from(clubSeasonRegistrations)
      .where(eq(clubSeasonRegistrations.id, registrationId))
      .limit(1);
    if (!plan || !registration) {
      throw new Error('Club season checkout references an incomplete payment record.');
    }
    if (
      plan.registrationId !== registrationId ||
      plan.currentVersion !== version.version ||
      registration.ownerUserId !== plan.ownerUserId
    ) {
      throw new Error('Club season checkout references mismatched payment ownership.');
    }

    if (registration.status === 'active' || registration.status === 'paid_in_full') {
      return false;
    }
    if (registration.status !== 'awaiting_payment' || version.status !== 'pending_checkout') {
      throw new Error('Club season checkout is no longer eligible for activation.');
    }

    const registrationStatus = version.paymentOption === 'pay_in_full' ? 'paid_in_full' : 'active';
    const planStatus = version.paymentOption === 'pay_in_full' ? 'completed' : 'active';
    const [activated] = await tx.update(clubSeasonRegistrations).set({
      status: registrationStatus,
      acceptedAt: processedAt,
      updatedAt: processedAt,
    }).where(and(
      eq(clubSeasonRegistrations.id, registrationId),
      eq(clubSeasonRegistrations.status, 'awaiting_payment')
    )).returning({ id: clubSeasonRegistrations.id });
    if (!activated) return false;

    const [acceptedOffer] = await tx.update(clubSeasonOffers).set({
      status: 'accepted',
      respondedAt: processedAt,
      updatedAt: processedAt,
    }).where(and(
      eq(clubSeasonOffers.id, registration.offerId),
      eq(clubSeasonOffers.status, 'registration_started')
    )).returning({ id: clubSeasonOffers.id });
    if (!acceptedOffer) {
      throw new Error('Club season offer is no longer eligible for acceptance.');
    }
    await tx.update(clubSeasonPaymentPlans).set({
      status: planStatus,
      financialStatus: version.paymentOption === 'pay_in_full' ? 'paid_in_full' : 'current',
      stripeCustomerId,
      stripePaymentMethodId,
      activatedAt: processedAt,
      completedAt: version.paymentOption === 'pay_in_full' ? processedAt : null,
      updatedAt: processedAt,
    }).where(eq(clubSeasonPaymentPlans.id, plan.id));
    await tx.update(clubSeasonPaymentPlanVersions).set({
      status: planStatus,
      stripePaymentIntentId: paymentIntentId,
      updatedAt: processedAt,
    }).where(eq(clubSeasonPaymentPlanVersions.id, version.id));
    await tx.update(clubSeasonPaymentInstallments).set({
      status: 'paid',
      stripePaymentIntentId: paymentIntentId,
      paidAt: processedAt,
      updatedAt: processedAt,
    }).where(eq(clubSeasonPaymentInstallments.id, deposit.id));
    await tx.insert(clubSeasonPaymentTransactions).values({
      id: crypto.randomUUID(),
      registrationId,
      paymentPlanVersionId,
      installmentId: deposit.id,
      stripeEventId: event.id,
      source: 'checkout',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amount: version.dueNowAmount,
      currency: version.currency,
      status: 'succeeded',
      processedAt,
      createdAt: processedAt,
    });
    if (stripeCustomerId) {
      await tx.update(users).set({ stripeCustomerId }).where(and(
        eq(users.id, plan.ownerUserId),
        sql`${users.stripeCustomerId} IS NULL`
      ));
    }
    return true;
  });

  await deliverClubSeasonCheckoutSuccess(db, stripe, {
    paymentIntentId,
    installmentId: deposit.id,
    siteUrl,
  });
  return processed;
}

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

  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata?.flow === 'club_season_installment') {
      try {
        const siteUrl = new URL(request.url).origin;
        const processed = event.type === 'payment_intent.succeeded'
          ? await recordInstallmentSuccess(db, stripe, event.id, intent, siteUrl)
          : await recordInstallmentFailure(db, intent, siteUrl);
        return new Response(JSON.stringify({ received: true, processed }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Club season installment webhook processing error:', error);
        return new Response('Database error', { status: 500 });
      }
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.flow === 'club_season') {
      try {
        const processed = await processClubSeasonCheckout(
          db,
          event,
          session,
          new URL(request.url).origin
        );
        return new Response(JSON.stringify({ received: true, processed }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Club season webhook processing error:', error);
        return new Response('Database error', { status: 500 });
      }
    }
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
  } else if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.flow === 'club_season') {
      const versionId = session.metadata.paymentPlanVersionId;
      const planId = session.metadata.paymentPlanId;
      if (versionId && planId) {
        const expiredAt = new Date().toISOString();
        await db.transaction(async (tx) => {
          const [expiredVersion] = await tx.update(clubSeasonPaymentPlanVersions).set({
            status: 'checkout_expired',
            updatedAt: expiredAt,
          }).where(and(
            eq(clubSeasonPaymentPlanVersions.id, versionId),
            eq(clubSeasonPaymentPlanVersions.stripeCheckoutSessionId, session.id),
            eq(clubSeasonPaymentPlanVersions.status, 'pending_checkout')
          )).returning({ version: clubSeasonPaymentPlanVersions.version });
          if (!expiredVersion) return;

          await tx.update(clubSeasonPaymentPlans).set({
            status: 'checkout_expired',
            updatedAt: expiredAt,
          }).where(and(
            eq(clubSeasonPaymentPlans.id, planId),
            eq(clubSeasonPaymentPlans.currentVersion, expiredVersion.version),
            eq(clubSeasonPaymentPlans.status, 'checkout_open')
          ));
        });
      }
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const registrationId = session.metadata?.registrationId;

    console.log('Received checkout.session.expired for registration:', registrationId);

    if (registrationId) {
      try {
        const expiration = await db.transaction((tx) =>
          expirePendingRegistration(tx, registrationId, session.id)
        );

        console.log(
          expiration.expired
            ? `Expired registration ${registrationId} and released ${expiration.spotsReleased} reserved spot(s).`
            : `Stripe expiration ${event.id} did not transition registration ${registrationId}; it was already finalized or the session did not match.`
        );

        return new Response(JSON.stringify({
          received: true,
          processed: expiration.expired,
          spotsReleased: expiration.spotsReleased,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (dbErr) {
        console.error('Database Error during expiration processing:', dbErr);
        return new Response('Database error', { status: 500 });
      }
    }

    console.error('No registrationId found in expired session metadata');
  } else {
    console.log(`Received unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
