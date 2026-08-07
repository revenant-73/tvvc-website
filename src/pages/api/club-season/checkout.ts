import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '../../../db/db';
import {
  clubSeasonAgreementAcceptances,
  clubSeasonPaymentInstallments,
  clubSeasonPaymentPlanAuthorizations,
  clubSeasonPaymentPlans,
  clubSeasonPaymentPlanVersions,
} from '../../../db/schema';
import {
  getOwnedClubSeasonOffers,
  getVerifiedClubSeasonUser,
} from '../../../lib/club-season-access';
import { isClubSeasonRegistrationEnabled } from '../../../lib/club-season-feature';
import {
  buildClubSeasonPaymentTerms,
  CLUB_SEASON_AUTOPAY_AUTHORIZATION,
  clubSeasonCheckoutSchema,
  hashClubSeasonAuthorization,
  hashClubSeasonPaymentTerms,
} from '../../../lib/club-season-payment';
import { getClubDate } from '../../../lib/event-eligibility';
import { rejectCrossOriginRequest } from '../../../lib/request-security';
import { createStripeClient } from '../../../lib/stripe-client';
import { getPendingInitialPlan } from '../../../lib/club-season-initial-plan';

export const prerender = false;

const CHECKOUT_EXPIRATION_SECONDS = 24 * 60 * 60;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function requestIpHash(request: Request): Promise<string | null> {
  const forwarded = request.headers.get('x-nf-client-connection-ip')?.trim() || '';
  const secret = import.meta.env.AUTH_SECRET || process.env.AUTH_SECRET || '';
  if (!forwarded || !secret) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(forwarded));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request }) => {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;
  if (!isClubSeasonRegistrationEnabled()) return json({ error: 'Not found.' }, 404);
  if (!db) return json({ error: 'Database configuration missing.' }, 500);

  try {
    const parsed = clubSeasonCheckoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message || 'Invalid payment selection.' }, 400);
    }

    const user = await getVerifiedClubSeasonUser(request);
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const ownedOffers = await getOwnedClubSeasonOffers(request);
    const item = ownedOffers.find(({ offer }) => offer.id === parsed.data.offerId);
    if (!item || item.draft?.ownerUserId !== user.id) {
      return json({ error: 'Registration not found.' }, 404);
    }
    if (!item.season.publicRegistrationEnabled) {
      return json({ error: 'Season registration is not currently available.' }, 403);
    }
    if (item.offer.acceptanceDeadline && item.offer.acceptanceDeadline < getClubDate()) {
      return json({ error: 'This offer has expired. Please contact TVVC.' }, 410);
    }
    if (item.offer.status !== 'registration_started' || item.draft.status !== 'awaiting_payment') {
      return json({ error: 'This registration is not ready for payment.' }, 409);
    }

    const [agreementEvidence] = await db.select({
      contextSnapshot: clubSeasonAgreementAcceptances.contextSnapshot,
    }).from(clubSeasonAgreementAcceptances)
      .where(eq(clubSeasonAgreementAcceptances.registrationId, item.draft.id))
      .limit(1);
    if (!agreementEvidence) {
      return json({ error: 'Complete the registration agreements before payment.' }, 409);
    }
    try {
      const context = JSON.parse(agreementEvidence.contextSnapshot);
      const acceptedPricing = context?.pricing;
      const pricingStillMatches =
        acceptedPricing?.tierId === item.pricingTier.id &&
        acceptedPricing?.totalAmount === item.pricingTier.totalAmount &&
        acceptedPricing?.depositAmount === item.pricingTier.depositAmount &&
        acceptedPricing?.installmentAmount === item.pricingTier.installmentAmount;
      if (!pricingStillMatches) {
        return json({ error: 'Pricing changed after the agreements were accepted. Contact TVVC before paying.' }, 409);
      }
    } catch {
      return json({ error: 'The accepted pricing record needs TVVC review.' }, 503);
    }

    const customProposal = parsed.data.paymentOption === 'custom_plan'
      ? await getPendingInitialPlan(db, item.draft.id)
      : null;
    if (parsed.data.paymentOption === 'custom_plan' && !customProposal) {
      return json({ error: 'That custom payment arrangement is no longer available. Reload to review your options.' }, 409);
    }
    if (customProposal?.snapshot.charges.some((charge) => charge.dueDate <= getClubDate())) {
      return json({ error: 'A date in this custom payment arrangement has passed. Contact TVVC for an updated schedule.' }, 409);
    }
    const billingDay = item.team.billingDayOverride || item.season.defaultBillingDay;
    const terms = customProposal?.terms || buildClubSeasonPaymentTerms({
      paymentOption: parsed.data.paymentOption,
      registrationDate: getClubDate(),
      firstInstallmentDate: item.season.firstInstallmentDate,
      billingDay,
      pricing: {
        totalAmount: item.pricingTier.totalAmount,
        depositAmount: item.pricingTier.depositAmount,
        installmentAmount: item.pricingTier.installmentAmount,
        installmentCount: item.season.standardInstallmentCount,
      },
    });
    const termsFingerprint = await hashClubSeasonPaymentTerms(terms);
    if (parsed.data.termsFingerprint !== termsFingerprint) {
      return json({ error: 'The payment schedule changed. Reload and review the current terms.' }, 409);
    }

    const isAutopayPlan = parsed.data.paymentOption !== 'pay_in_full';
    const authorizedName = parsed.data.authorizedName?.trim() || '';
    if (isAutopayPlan && (!parsed.data.autopayAuthorized || authorizedName.length < 2)) {
      return json({ error: 'Enter your name and authorize the automatic payment schedule.' }, 422);
    }

    const now = new Date().toISOString();
    const authorizationText = customProposal?.authorizationText || CLUB_SEASON_AUTOPAY_AUTHORIZATION;
    const authorizationHash = isAutopayPlan
      ? await hashClubSeasonAuthorization(authorizationText)
      : null;
    const ipHash = isAutopayPlan ? await requestIpHash(request) : null;
    const userAgent = isAutopayPlan ? request.headers.get('user-agent')?.slice(0, 500) || null : null;

    const checkoutRecord = await db.transaction(async (tx) => {
      const proposedPlanId = crypto.randomUUID();
      const [insertedPlan] = await tx.insert(clubSeasonPaymentPlans).values({
        id: proposedPlanId,
        registrationId: item.draft!.id,
        ownerUserId: user.id,
        status: 'pending_checkout',
        currentVersion: 1,
        stripeCustomerId: user.stripeCustomerId,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing({
        target: clubSeasonPaymentPlans.registrationId,
      }).returning();

      const [plan] = insertedPlan ? [insertedPlan] : await tx.select().from(clubSeasonPaymentPlans)
        .where(eq(clubSeasonPaymentPlans.registrationId, item.draft!.id))
        .limit(1);
      if (!plan || plan.ownerUserId !== user.id) throw new Error('PAYMENT_PLAN_INCOMPLETE');

      if (!insertedPlan) {
        const [existingVersion] = await tx.select().from(clubSeasonPaymentPlanVersions)
          .where(and(
            eq(clubSeasonPaymentPlanVersions.paymentPlanId, plan.id),
            eq(clubSeasonPaymentPlanVersions.version, plan.currentVersion)
          ))
          .limit(1);
        if (!existingVersion) throw new Error('PAYMENT_PLAN_INCOMPLETE');
        if (parsed.data.paymentOption === 'custom_plan') {
          if (
            existingVersion.id !== customProposal?.version.id ||
            existingVersion.paymentOption !== 'custom_plan' ||
            existingVersion.termsFingerprint !== termsFingerprint
          ) throw new Error('PAYMENT_SELECTION_LOCKED');
          if (
            ['pending_checkout', 'checkout_open'].includes(plan.status) &&
            existingVersion.status === 'pending_checkout'
          ) return { plan, version: existingVersion };
          if (
            plan.status !== 'custom_pending_authorization' ||
            existingVersion.status !== 'pending_authorization'
          ) throw new Error('PAYMENT_SELECTION_LOCKED');
          const [claimed] = await tx.update(clubSeasonPaymentPlanVersions).set({
            status: 'pending_checkout', updatedAt: now,
          }).where(and(
            eq(clubSeasonPaymentPlanVersions.id, existingVersion.id),
            eq(clubSeasonPaymentPlanVersions.status, 'pending_authorization')
          )).returning();
          if (!claimed) throw new Error('PAYMENT_PLAN_RETRY_CONFLICT');
          await tx.insert(clubSeasonPaymentPlanAuthorizations).values({
            id: crypto.randomUUID(), paymentPlanVersionId: existingVersion.id,
            ownerUserId: user.id, authorizationText,
            authorizationContentHash: authorizationHash!, authorizedName,
            authorizedEmail: user.email.trim().toLowerCase(), requestIpHash: ipHash,
            userAgent, authorizedAt: now, createdAt: now,
          });
          await tx.update(clubSeasonPaymentInstallments).set({ status: 'scheduled', updatedAt: now })
            .where(and(
              eq(clubSeasonPaymentInstallments.paymentPlanVersionId, existingVersion.id),
              eq(clubSeasonPaymentInstallments.status, 'pending_authorization')
            ));
          const [updatedPlan] = await tx.update(clubSeasonPaymentPlans).set({
            status: 'pending_checkout', updatedAt: now,
          }).where(and(
            eq(clubSeasonPaymentPlans.id, plan.id),
            eq(clubSeasonPaymentPlans.status, 'custom_pending_authorization')
          )).returning();
          if (!updatedPlan) throw new Error('PAYMENT_PLAN_RETRY_CONFLICT');
          return { plan: updatedPlan, version: claimed };
        }
        if (
          plan.status === 'custom_pending_authorization' &&
          existingVersion.paymentOption === 'custom_plan' &&
          existingVersion.status === 'pending_authorization'
        ) {
          const nextVersion = plan.currentVersion + 1;
          const nextVersionId = crypto.randomUUID();
          const [cancelledCustom] = await tx.update(clubSeasonPaymentPlanVersions)
            .set({ status: 'cancelled', updatedAt: now })
            .where(and(
              eq(clubSeasonPaymentPlanVersions.id, existingVersion.id),
              eq(clubSeasonPaymentPlanVersions.status, 'pending_authorization')
            )).returning({ id: clubSeasonPaymentPlanVersions.id });
          if (!cancelledCustom) throw new Error('PAYMENT_PLAN_RETRY_CONFLICT');
          await tx.update(clubSeasonPaymentInstallments).set({ status: 'cancelled', updatedAt: now })
            .where(and(
              eq(clubSeasonPaymentInstallments.paymentPlanVersionId, existingVersion.id),
              eq(clubSeasonPaymentInstallments.status, 'pending_authorization')
            ));
          const [replacement] = await tx.insert(clubSeasonPaymentPlanVersions).values({
            id: nextVersionId, paymentPlanId: plan.id, version: nextVersion,
            paymentOption: parsed.data.paymentOption, status: 'pending_checkout',
            totalAmount: terms.totalAmount, dueNowAmount: terms.dueNowAmount,
            currency: terms.currency, billingDay: terms.billingDay,
            scheduleSnapshot: JSON.stringify(terms.charges), termsFingerprint,
            authorizationText: isAutopayPlan ? authorizationText : null,
            authorizationContentHash: authorizationHash,
            authorizedName: isAutopayPlan ? authorizedName : null,
            authorizedEmail: isAutopayPlan ? user.email.trim().toLowerCase() : null,
            requestIpHash: ipHash, userAgent, authorizedAt: isAutopayPlan ? now : null,
            createdAt: now, updatedAt: now,
          }).returning();
          await tx.insert(clubSeasonPaymentInstallments).values(terms.charges.map((charge) => ({
            id: crypto.randomUUID(), paymentPlanVersionId: nextVersionId, sequence: charge.sequence,
            type: charge.type, dueDate: charge.dueDate, amount: charge.amount,
            status: 'scheduled', createdAt: now, updatedAt: now,
          })));
          const [updatedPlan] = await tx.update(clubSeasonPaymentPlans).set({
            status: 'pending_checkout', currentVersion: nextVersion, updatedAt: now,
          }).where(and(
            eq(clubSeasonPaymentPlans.id, plan.id),
            eq(clubSeasonPaymentPlans.status, 'custom_pending_authorization'),
            eq(clubSeasonPaymentPlans.currentVersion, plan.currentVersion)
          )).returning();
          if (!replacement || !updatedPlan) throw new Error('PAYMENT_PLAN_RETRY_CONFLICT');
          return { plan: updatedPlan, version: replacement };
        }
        if (
          existingVersion.paymentOption !== parsed.data.paymentOption ||
          existingVersion.termsFingerprint !== termsFingerprint
        ) {
          throw new Error('PAYMENT_SELECTION_LOCKED');
        }
        if (existingVersion.status !== 'checkout_expired') {
          return { plan, version: existingVersion };
        }

        const nextVersion = plan.currentVersion + 1;
        const nextVersionId = crypto.randomUUID();
        const [renewedVersion] = await tx.insert(clubSeasonPaymentPlanVersions).values({
          id: nextVersionId,
          paymentPlanId: plan.id,
          version: nextVersion,
          paymentOption: parsed.data.paymentOption,
          status: 'pending_checkout',
          totalAmount: terms.totalAmount,
          dueNowAmount: terms.dueNowAmount,
          currency: terms.currency,
          billingDay: terms.billingDay,
          scheduleSnapshot: JSON.stringify(terms.charges),
          termsFingerprint,
          authorizationText: isAutopayPlan ? authorizationText : null,
          authorizationContentHash: authorizationHash,
          authorizedName: isAutopayPlan ? authorizedName : null,
          authorizedEmail: isAutopayPlan ? user.email.trim().toLowerCase() : null,
          requestIpHash: ipHash,
          userAgent,
          authorizedAt: isAutopayPlan ? now : null,
          createdAt: now,
          updatedAt: now,
        }).returning();
        await tx.insert(clubSeasonPaymentInstallments).values(terms.charges.map((charge) => ({
          id: crypto.randomUUID(),
          paymentPlanVersionId: nextVersionId,
          sequence: charge.sequence,
          type: charge.type,
          dueDate: charge.dueDate,
          amount: charge.amount,
          status: 'scheduled',
          createdAt: now,
          updatedAt: now,
        })));
        const [renewedPlan] = await tx.update(clubSeasonPaymentPlans).set({
          status: 'pending_checkout',
          currentVersion: nextVersion,
          updatedAt: now,
        }).where(and(
          eq(clubSeasonPaymentPlans.id, plan.id),
          eq(clubSeasonPaymentPlans.currentVersion, plan.currentVersion),
          eq(clubSeasonPaymentPlans.status, 'checkout_expired')
        )).returning();
        if (!renewedVersion || !renewedPlan) throw new Error('PAYMENT_PLAN_RETRY_CONFLICT');
        return { plan: renewedPlan, version: renewedVersion };
      }

      const versionId = crypto.randomUUID();
      const [version] = await tx.insert(clubSeasonPaymentPlanVersions).values({
        id: versionId,
        paymentPlanId: plan.id,
        version: 1,
        paymentOption: parsed.data.paymentOption,
        status: 'pending_checkout',
        totalAmount: terms.totalAmount,
        dueNowAmount: terms.dueNowAmount,
        currency: terms.currency,
        billingDay: terms.billingDay,
        scheduleSnapshot: JSON.stringify(terms.charges),
        termsFingerprint,
        authorizationText: isAutopayPlan ? authorizationText : null,
        authorizationContentHash: authorizationHash,
        authorizedName: isAutopayPlan ? authorizedName : null,
        authorizedEmail: isAutopayPlan ? user.email.trim().toLowerCase() : null,
        requestIpHash: ipHash,
        userAgent,
        authorizedAt: isAutopayPlan ? now : null,
        createdAt: now,
        updatedAt: now,
      }).returning();
      await tx.insert(clubSeasonPaymentInstallments).values(terms.charges.map((charge) => ({
        id: crypto.randomUUID(),
        paymentPlanVersionId: versionId,
        sequence: charge.sequence,
        type: charge.type,
        dueDate: charge.dueDate,
        amount: charge.amount,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
      })));
      if (!version) throw new Error('PAYMENT_PLAN_INCOMPLETE');
      return { plan, version };
    });

    const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) return json({ error: 'Payment processing is not configured.' }, 503);
    const stripe = createStripeClient(stripeSecretKey);

    if (checkoutRecord.version.stripeCheckoutSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        checkoutRecord.version.stripeCheckoutSessionId
      );
      if (existingSession.status === 'open' && existingSession.url) {
        return json({ url: existingSession.url });
      }
      return json({ error: 'This checkout is no longer open. Contact TVVC for help.' }, 409);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRATION_SECONDS;
    const metadata = {
      flow: 'club_season',
      registrationId: item.draft.id,
      paymentPlanId: checkoutRecord.plan.id,
      paymentPlanVersionId: checkoutRecord.version.id,
      paymentOption: parsed.data.paymentOption,
    };
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: terms.currency,
          unit_amount: terms.dueNowAmount,
          product_data: {
            name: parsed.data.paymentOption === 'pay_in_full'
              ? `${item.season.name} dues — ${item.team.name}`
              : `${item.season.name} deposit — ${item.team.name}`,
            description: `${item.athlete.firstName} ${item.athlete.lastName}`,
          },
        },
      }],
      success_url: `${new URL(request.url).origin}/season-registration?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(request.url).origin}/season-registration?payment=cancelled`,
      client_reference_id: item.draft.id,
      metadata,
      payment_intent_data: {
        metadata,
        ...(isAutopayPlan ? { setup_future_usage: 'off_session' as const } : {}),
      },
      expires_at: expiresAt,
    };
    if (user.stripeCustomerId) {
      sessionParams.customer = user.stripeCustomerId;
    } else {
      sessionParams.customer_creation = 'always';
      sessionParams.customer_email = user.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: `club-season-checkout-${checkoutRecord.version.id}` }
    );
    if (!checkoutSession.url) throw new Error('STRIPE_CHECKOUT_URL_MISSING');

    await db.transaction(async (tx) => {
      await tx.update(clubSeasonPaymentPlanVersions).set({
        stripeCheckoutSessionId: checkoutSession.id,
        stripeCheckoutExpiresAt: new Date(expiresAt * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(clubSeasonPaymentPlanVersions.id, checkoutRecord.version.id),
        eq(clubSeasonPaymentPlanVersions.status, 'pending_checkout')
      ));
      await tx.update(clubSeasonPaymentPlans).set({
        status: 'checkout_open',
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(clubSeasonPaymentPlans.id, checkoutRecord.plan.id),
        eq(clubSeasonPaymentPlans.status, 'pending_checkout')
      ));
    });

    return json({ url: checkoutSession.url });
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYMENT_SELECTION_LOCKED') {
      return json({ error: 'A different payment selection is already in checkout. Contact TVVC if you need it changed.' }, 409);
    }
    if (error instanceof Error && error.message === 'PAYMENT_PLAN_INCOMPLETE') {
      console.error('Club season payment plan is incomplete.');
      return json({ error: 'The payment record needs TVVC review.' }, 503);
    }
    if (error instanceof Error && error.message === 'PAYMENT_PLAN_RETRY_CONFLICT') {
      return json({ error: 'Another checkout attempt started. Please try again.' }, 409);
    }
    console.error('Club season checkout error:', error);
    return json({ error: 'Unable to start secure checkout.' }, 500);
  }
};
