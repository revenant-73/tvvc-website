import { test, expect } from '@playwright/test';
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import Stripe from 'stripe';
const fixtures = require('./portal-fixtures');

const webhookSecret = 'whsec_playwright_not_used';
const stripe = new Stripe('sk_test_playwright_not_used');

async function contextWithSession(browser, sessionToken) {
  const appPort = process.env.PLAYWRIGHT_PORT || '4321';
  return browser.newContext({
    baseURL: `http://127.0.0.1:${appPort}`,
    storageState: {
      cookies: [{
        name: 'authjs.session-token',
        value: sessionToken,
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      }],
      origins: [],
    },
  });
}

function clubSeasonWebhook({
  eventId,
  sessionId,
  registrationId,
  planId,
  versionId,
  paymentOption = 'standard_plan',
  amountTotal = 40000,
  paymentIntentId = 'pi_club_season_standard',
}) {
  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    api_version: '2025-01-27.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        amount_total: amountTotal,
        currency: 'usd',
        customer: 'cus_club_season_parent',
        payment_intent: paymentIntentId,
        payment_status: 'paid',
        metadata: {
          flow: 'club_season',
          registrationId,
          paymentPlanId: planId,
          paymentPlanVersionId: versionId,
          paymentOption,
        },
      },
    },
  });
  return {
    payload,
    signature: stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret }),
  };
}

test.describe.serial('Club season payment checkout', () => {
  test('standard plan requires authorization, snapshots terms, and activates once after webhook', async ({ browser, request }) => {
    const paymentFixture = fixtures.clubSeasonPayments.standard;
    const parent = await contextWithSession(browser, paymentFixture.sessionToken);
    const client = createClient({ url: fixtures.databaseUrl });
    try {
      const page = await parent.newPage();
      await page.goto('/season-registration');
      const card = page.locator(`[data-offer-id="${paymentFixture.offerId}"]`);
      await expect(card.getByRole('heading', { name: /choose how to pay/i })).toBeVisible();
      await card.locator('input[value="standard_plan"]').check();
      await expect(card.getByText(/No December charge/i).first()).toBeVisible();
      await expect(card.locator('[data-due-now-display]')).toHaveText('$400');
      await expect(card.getByText('Jan 5, 2027')).toBeVisible();
      await expect(card.getByText('May 5, 2027')).toBeVisible();

      const fingerprint = await card.locator('input[value="standard_plan"]')
        .getAttribute('data-terms-fingerprint');
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);

      const crossOrigin = await parent.request.post('/api/club-season/checkout', {
        headers: { Origin: 'https://attacker.example' },
        data: {
          offerId: paymentFixture.offerId,
          paymentOption: 'standard_plan',
          termsFingerprint: fingerprint,
          authorizedName: 'Standard Parent',
          autopayAuthorized: true,
        },
      });
      expect(crossOrigin.status()).toBe(403);

      const missingAuthorization = await parent.request.post('/api/club-season/checkout', {
        data: {
          offerId: paymentFixture.offerId,
          paymentOption: 'standard_plan',
          termsFingerprint: fingerprint,
        },
      });
      expect(missingAuthorization.status()).toBe(422);

      const wrongTerms = await parent.request.post('/api/club-season/checkout', {
        data: {
          offerId: paymentFixture.offerId,
          paymentOption: 'standard_plan',
          termsFingerprint: '0'.repeat(64),
          authorizedName: 'Standard Parent',
          autopayAuthorized: true,
        },
      });
      expect(wrongTerms.status()).toBe(409);

      const checkoutPayload = {
        offerId: paymentFixture.offerId,
        paymentOption: 'standard_plan',
        termsFingerprint: fingerprint,
        authorizedName: 'Standard Parent',
        autopayAuthorized: true,
      };
      const [checkoutA, checkoutB] = await Promise.all([
        parent.request.post('/api/club-season/checkout', { data: checkoutPayload }),
        parent.request.post('/api/club-season/checkout', { data: checkoutPayload }),
      ]);
      expect([checkoutA.status(), checkoutB.status()]).toEqual([200, 200]);
      const [checkoutBodyA, checkoutBodyB] = await Promise.all([checkoutA.json(), checkoutB.json()]);
      expect(checkoutBodyA.url).toBe(checkoutBodyB.url);

      const planResult = await client.execute({
        sql: `SELECT p.id AS plan_id, p.status AS plan_status, p.current_version,
                     v.id AS version_id, v.stripe_checkout_session_id,
                     v.authorization_text, v.authorization_content_hash,
                     v.authorized_name, v.authorized_email, v.schedule_snapshot
              FROM club_season_payment_plans p
              JOIN club_season_payment_plan_versions v
                ON v.payment_plan_id = p.id AND v.version = p.current_version
              WHERE p.registration_id = ?`,
        args: [paymentFixture.registrationId],
      });
      expect(planResult.rows).toHaveLength(1);
      const plan = planResult.rows[0];
      expect(plan.plan_status).toBe('checkout_open');
      expect(plan.authorized_name).toBe('Standard Parent');
      expect(plan.authorized_email).toBe(paymentFixture.email);
      expect(plan.authorization_text).toMatch(/authorize Tualatin Valley Volleyball Club/i);
      expect(plan.authorization_content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.parse(plan.schedule_snapshot)).toHaveLength(6);

      const installments = await client.execute({
        sql: `SELECT sequence, type, due_date, amount, status
              FROM club_season_payment_installments
              WHERE payment_plan_version_id = ? ORDER BY sequence`,
        args: [plan.version_id],
      });
      expect(installments.rows.map((row) => ({
        sequence: Number(row.sequence),
        type: row.type,
        due_date: row.due_date,
        amount: Number(row.amount),
      }))).toEqual([
        { sequence: 0, type: 'deposit', due_date: expect.any(String), amount: 40000 },
        { sequence: 1, type: 'installment', due_date: '2027-01-05', amount: 22000 },
        { sequence: 2, type: 'installment', due_date: '2027-02-05', amount: 22000 },
        { sequence: 3, type: 'installment', due_date: '2027-03-05', amount: 22000 },
        { sequence: 4, type: 'installment', due_date: '2027-04-05', amount: 22000 },
        { sequence: 5, type: 'installment', due_date: '2027-05-05', amount: 22000 },
      ]);

      const stripeSession = await request.get(
        `http://127.0.0.1:4322/test/checkout-sessions/${plan.stripe_checkout_session_id}`
      );
      const stripeRequest = await stripeSession.json();
      expect(stripeRequest.request_params['line_items[0][price_data][unit_amount]']).toBe('40000');
      expect(stripeRequest.request_params['payment_intent_data[setup_future_usage]']).toBe('off_session');
      expect(stripeRequest.idempotency_key).toBe(`club-season-checkout-${plan.version_id}`);

      const postWebhook = async (eventId) => {
        const webhook = clubSeasonWebhook({
          eventId,
          sessionId: plan.stripe_checkout_session_id,
          registrationId: paymentFixture.registrationId,
          planId: plan.plan_id,
          versionId: plan.version_id,
        });
        return request.post('/api/webhooks/stripe', {
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': webhook.signature,
          },
          data: webhook.payload,
        });
      };
      const deliveries = await Promise.all([
        postWebhook('evt_club_standard_a'),
        postWebhook('evt_club_standard_b'),
      ]);
      expect(deliveries.map((response) => response.status())).toEqual([200, 200]);

      const finalState = await client.execute({
        sql: `SELECT csr.status AS registration_status, cso.status AS offer_status,
                     p.status AS plan_status, p.stripe_customer_id,
                     p.stripe_payment_method_id,
                     (SELECT count(*) FROM club_season_payment_transactions t
                      WHERE t.registration_id = csr.id) AS transaction_count,
                     (SELECT count(*) FROM club_season_email_deliveries e
                      WHERE e.registration_id = csr.id AND e.type = 'payment_succeeded') AS email_count,
                     (SELECT status FROM club_season_email_deliveries e
                      WHERE e.registration_id = csr.id AND e.type = 'payment_succeeded') AS email_status,
                     (SELECT attempt_count FROM club_season_email_deliveries e
                      WHERE e.registration_id = csr.id AND e.type = 'payment_succeeded') AS email_attempt_count,
                     (SELECT idempotency_key FROM club_season_email_deliveries e
                      WHERE e.registration_id = csr.id AND e.type = 'payment_succeeded') AS email_key
              FROM club_season_registrations csr
              JOIN club_season_offers cso ON cso.id = csr.offer_id
              JOIN club_season_payment_plans p ON p.registration_id = csr.id
              WHERE csr.id = ?`,
        args: [paymentFixture.registrationId],
      });
      expect(finalState.rows[0]).toMatchObject({
        registration_status: 'active',
        offer_status: 'accepted',
        plan_status: 'active',
        stripe_customer_id: 'cus_club_season_parent',
        stripe_payment_method_id: 'pm_club_season_autopay',
        transaction_count: 1,
        email_count: 1,
        email_status: 'sent',
        email_attempt_count: 1,
        email_key: 'club-season-success:pi_club_season_standard',
      });
      const paidInstallments = await client.execute({
        sql: `SELECT sequence, status FROM club_season_payment_installments
              WHERE payment_plan_version_id = ? ORDER BY sequence`,
        args: [plan.version_id],
      });
      expect(paidInstallments.rows[0]).toMatchObject({ sequence: 0, status: 'paid' });
      expect(paidInstallments.rows.slice(1).every((row) => row.status === 'scheduled')).toBeTruthy();

      await page.goto('/portal/dashboard');
      const planCard = page.locator(
        `[data-club-season-registration="${paymentFixture.registrationId}"]`
      );
      await expect(planCard.getByRole('heading', { name: 'Club Season & Payment Plan' })).toBeVisible();
      await expect(planCard.getByText(paymentFixture.athleteName, { exact: false })).toBeVisible();
      await expect(planCard.getByText(fixtures.clubSeason.teamName, { exact: false })).toBeVisible();
      await expect(planCard.getByText('$400.00', { exact: true }).first()).toBeVisible();
      await expect(planCard.getByText('$1,100.00', { exact: true })).toBeVisible();
      await expect(planCard.getByText(/\$220\.00 on January 5, 2027/)).toBeVisible();
      await expect(planCard.getByText('Automatic payment', { exact: true })).toHaveCount(5);
      for (const month of ['January', 'February', 'March', 'April', 'May']) {
        await expect(planCard.locator('ol').getByText(`${month} 5, 2027`, { exact: true })).toBeVisible();
      }
      await expect(planCard.getByText('Standard plan', { exact: true })).toBeVisible();
      await expect(planCard.getByText('Authorized', { exact: true })).toBeVisible();
      await expect(planCard.locator('input')).toHaveCount(0);
      await expect(planCard.getByRole('button', { name: 'Manage payment method' })).toBeVisible();

      const unrelatedParent = await contextWithSession(
        browser,
        fixtures.clubSeasonPayments.full.sessionToken
      );
      try {
        const unrelatedPage = await unrelatedParent.newPage();
        await unrelatedPage.goto('/portal/dashboard');
        await expect(unrelatedPage.locator(
          `[data-club-season-registration="${paymentFixture.registrationId}"]`
        )).toHaveCount(0);
        await expect(unrelatedPage.getByText(paymentFixture.athleteName, { exact: true })).toHaveCount(0);
      } finally {
        await unrelatedParent.close();
      }

      await client.execute({
        sql: `INSERT INTO household_guardians
              (owner_user_id, guardian_email, guardian_user_id, status, accepted_at)
              VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
        args: [paymentFixture.userId, fixtures.guardian.email, fixtures.guardian.id],
      });
      const guardian = await contextWithSession(browser, fixtures.guardian.sessionToken);
      try {
        const guardianPage = await guardian.newPage();
        await guardianPage.goto('/portal/dashboard');
        const sharedPlanCard = guardianPage.locator(
          `[data-club-season-registration="${paymentFixture.registrationId}"]`
        );
        await expect(sharedPlanCard).toBeVisible();
        await expect(sharedPlanCard.getByText('Shared view', { exact: true })).toBeVisible();
        await expect(sharedPlanCard.getByText(/view-only household access/i)).toBeVisible();
        await expect(sharedPlanCard.getByRole('button')).toHaveCount(0);
      } finally {
        await guardian.close();
        await client.execute({
          sql: `DELETE FROM household_guardians
                WHERE owner_user_id = ? AND guardian_email = ?`,
          args: [paymentFixture.userId, fixtures.guardian.email],
        });
      }
    } finally {
      client.close();
      await parent.close();
    }
  });

  test('pay in full creates one charge without an off-session authorization', async ({ browser, request }) => {
    const paymentFixture = fixtures.clubSeasonPayments.full;
    const parent = await contextWithSession(browser, paymentFixture.sessionToken);
    const otherParent = await contextWithSession(browser, fixtures.clubSeasonPayments.standard.sessionToken);
    const client = createClient({ url: fixtures.databaseUrl });
    try {
      const page = await parent.newPage();
      await page.goto('/season-registration');
      const option = page.locator(`[data-offer-id="${paymentFixture.offerId}"] input[value="pay_in_full"]`);
      const fingerprint = await option.getAttribute('data-terms-fingerprint');

      const wrongOwner = await otherParent.request.post('/api/club-season/checkout', {
        data: {
          offerId: paymentFixture.offerId,
          paymentOption: 'pay_in_full',
          termsFingerprint: fingerprint,
        },
      });
      expect(wrongOwner.status()).toBe(404);

      const checkout = await parent.request.post('/api/club-season/checkout', {
        data: {
          offerId: paymentFixture.offerId,
          paymentOption: 'pay_in_full',
          termsFingerprint: fingerprint,
        },
      });
      expect(checkout.ok()).toBeTruthy();

      const planResult = await client.execute({
        sql: `SELECT p.id AS plan_id, v.id AS version_id,
                     v.stripe_checkout_session_id, v.authorization_text,
                     v.authorized_name, v.schedule_snapshot
              FROM club_season_payment_plans p
              JOIN club_season_payment_plan_versions v
                ON v.payment_plan_id = p.id AND v.version = p.current_version
              WHERE p.registration_id = ?`,
        args: [paymentFixture.registrationId],
      });
      const plan = planResult.rows[0];
      expect(plan.authorization_text).toBeNull();
      expect(plan.authorized_name).toBeNull();
      expect(JSON.parse(plan.schedule_snapshot)).toHaveLength(1);

      const stripeSession = await request.get(
        `http://127.0.0.1:4322/test/checkout-sessions/${plan.stripe_checkout_session_id}`
      );
      const stripeRequest = await stripeSession.json();
      expect(stripeRequest.request_params['line_items[0][price_data][unit_amount]']).toBe('150000');
      expect(stripeRequest.request_params['payment_intent_data[setup_future_usage]']).toBeUndefined();

      const webhook = clubSeasonWebhook({
        eventId: 'evt_club_full',
        sessionId: plan.stripe_checkout_session_id,
        registrationId: paymentFixture.registrationId,
        planId: plan.plan_id,
        versionId: plan.version_id,
        paymentOption: 'pay_in_full',
        amountTotal: 150000,
        paymentIntentId: 'pi_club_season_full',
      });
      const delivery = await request.post('/api/webhooks/stripe', {
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': webhook.signature,
        },
        data: webhook.payload,
      });
      expect(delivery.status()).toBe(200);

      await page.goto('/portal/dashboard');
      const planCard = page.locator(
        `[data-club-season-registration="${paymentFixture.registrationId}"]`
      );
      await expect(planCard).toBeVisible();
      await expect(planCard.getByText('Registration complete', { exact: true })).toBeVisible();
      await expect(planCard.getByText('Paid in full', { exact: true })).toHaveCount(3);
      await expect(planCard.getByText('$0.00', { exact: true })).toBeVisible();
      await expect(planCard.getByText('No future automatic payments are scheduled.')).toBeVisible();
      await expect(planCard.getByText('Next automatic payment')).toHaveCount(0);
      await expect(planCard.getByText('Not applicable', { exact: true })).toBeVisible();
    } finally {
      client.close();
      await parent.close();
      await otherParent.close();
    }
  });

  test('custom plan shows exact admin terms and records immutable authorization before checkout', async ({ browser, request }) => {
    const paymentFixture = fixtures.clubSeasonPayments.custom;
    const parent = await contextWithSession(browser, paymentFixture.sessionToken);
    const client = createClient({ url: fixtures.databaseUrl });
    const planId = 'plan-club-custom';
    const versionId = 'version-club-custom-1';
    const terms = {
      paymentOption: 'custom_plan', totalAmount: 150000, dueNowAmount: 30000,
      currency: 'usd', billingDay: null,
      charges: [
        { sequence: 0, type: 'deposit', dueDate: '2026-11-12', amount: 30000 },
        { sequence: 1, type: 'installment', dueDate: '2027-01-15', amount: 60000 },
        { sequence: 2, type: 'installment', dueDate: '2027-02-15', amount: 60000 },
      ],
    };
    const fingerprint = createHash('sha256').update(JSON.stringify(terms)).digest('hex');
    const snapshot = {
      kind: 'initial_custom_plan', currency: 'usd', seasonTotal: 150000,
      dueNowAmount: 30000, proposedOn: '2026-11-12',
      reason: 'Two larger installments requested by the family', adminNote: 'E2E fixture',
      charges: terms.charges.slice(1),
    };
    try {
      await client.batch([
        { sql: `INSERT INTO club_season_payment_plans (id,registration_id,owner_user_id,status,financial_status,current_version) VALUES (?,?,?,'custom_pending_authorization','not_started',1)`, args: [planId, paymentFixture.registrationId, paymentFixture.userId] },
        { sql: `INSERT INTO club_season_payment_plan_versions (id,payment_plan_id,version,payment_option,status,total_amount,due_now_amount,currency,billing_day,schedule_snapshot,terms_fingerprint) VALUES (?,?,1,'custom_plan','pending_authorization',150000,30000,'usd',NULL,?,?)`, args: [versionId, planId, JSON.stringify(snapshot), fingerprint] },
        ...terms.charges.map((charge) => ({ sql: `INSERT INTO club_season_payment_installments (id,payment_plan_version_id,sequence,type,due_date,amount,status) VALUES (?,?,?,?,?,?,'pending_authorization')`, args: [`custom-installment-${charge.sequence}`, versionId, charge.sequence, charge.type, charge.dueDate, charge.amount] })),
      ], 'write');

      const page = await parent.newPage();
      await page.goto('/season-registration');
      const card = page.locator(`[data-offer-id="${paymentFixture.offerId}"]`);
      const customOption = card.locator('input[value="custom_plan"]');
      await expect(customOption).toBeVisible();
      await expect(customOption).not.toBeChecked();
      await customOption.check();
      await expect(card.getByText('$300').first()).toBeVisible();
      await expect(card.getByText('Jan 15, 2027')).toBeVisible();
      await expect(card.getByText('Feb 15, 2027')).toBeVisible();
      await expect(card.getByText(/Two larger installments requested/i).first()).toBeVisible();

      const checkout = await parent.request.post('/api/club-season/checkout', { data: {
        offerId: paymentFixture.offerId, paymentOption: 'custom_plan', termsFingerprint: fingerprint,
        authorizedName: 'Custom Parent', autopayAuthorized: true,
      } });
      expect(checkout.ok()).toBeTruthy();

      const record = await client.execute({
        sql: `SELECT p.status AS plan_status, v.status AS version_status,
                     v.stripe_checkout_session_id,
                     (SELECT count(*) FROM club_season_payment_plan_authorizations a WHERE a.payment_plan_version_id=v.id) AS authorization_count,
                     (SELECT authorized_name FROM club_season_payment_plan_authorizations a WHERE a.payment_plan_version_id=v.id) AS authorized_name
              FROM club_season_payment_plans p JOIN club_season_payment_plan_versions v
                ON v.payment_plan_id=p.id AND v.version=p.current_version WHERE p.id=?`,
        args: [planId],
      });
      expect(record.rows[0]).toMatchObject({
        plan_status: 'checkout_open', version_status: 'pending_checkout',
        authorized_name: 'Custom Parent', authorization_count: 1,
      });
      const stripeSession = await request.get(`http://127.0.0.1:4322/test/checkout-sessions/${record.rows[0].stripe_checkout_session_id}`);
      const stripeRequest = await stripeSession.json();
      expect(stripeRequest.request_params['line_items[0][price_data][unit_amount]']).toBe('30000');
      expect(stripeRequest.request_params['payment_intent_data[setup_future_usage]']).toBe('off_session');
    } finally {
      client.close();
      await parent.close();
    }
  });
});
