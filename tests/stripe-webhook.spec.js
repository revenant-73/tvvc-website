import { test, expect } from '@playwright/test';
import { createClient } from '@libsql/client';
import Stripe from 'stripe';
const fixtures = require('./portal-fixtures');

const webhookSecret = 'whsec_playwright_not_used';
const stripe = new Stripe('sk_test_playwright_not_used');

function createWebhookRequest(eventId, amountTotal = fixtures.webhook.totalAmount) {
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
        id: fixtures.webhook.sessionId,
        object: 'checkout.session',
        amount_total: amountTotal,
        currency: 'usd',
        customer: 'cus_webhook_parent',
        payment_status: 'paid',
        metadata: {
          registrationId: fixtures.webhook.registrationId,
        },
      },
    },
  });

  return {
    payload,
    signature: stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    }),
  };
}

test('validates payment details and finalizes a checkout only once', async ({ request }) => {
  const client = createClient({ url: fixtures.databaseUrl });

  const postWebhook = async (eventId, amountTotal = fixtures.webhook.totalAmount) => {
    const webhook = createWebhookRequest(eventId, amountTotal);
    return request.post('/api/webhooks/stripe', {
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': webhook.signature,
      },
      data: webhook.payload,
    });
  };

  try {
    const invalidPayment = await postWebhook(
      'evt_webhook_wrong_amount',
      fixtures.webhook.totalAmount + 100
    );
    expect(invalidPayment.status()).toBe(200);

    let registration = await client.execute({
      sql: 'SELECT status, needs_review FROM registrations WHERE id = ?',
      args: [fixtures.webhook.registrationId],
    });
    let event = await client.execute({
      sql: 'SELECT spots_filled, pending_spots FROM events WHERE id = ?',
      args: [fixtures.webhook.eventId],
    });

    expect(registration.rows[0].status).toBe('pending');
    expect(Number(registration.rows[0].needs_review)).toBe(1);
    expect(Number(event.rows[0].spots_filled)).toBe(2);
    expect(Number(event.rows[0].pending_spots)).toBe(1);

    const deliveries = await Promise.all([
      postWebhook('evt_webhook_delivery_a'),
      postWebhook('evt_webhook_delivery_b'),
    ]);
    expect(deliveries.map((response) => response.status())).toEqual([200, 200]);

    registration = await client.execute({
      sql: 'SELECT status, stripe_customer_id FROM registrations WHERE id = ?',
      args: [fixtures.webhook.registrationId],
    });
    event = await client.execute({
      sql: 'SELECT spots_filled, pending_spots FROM events WHERE id = ?',
      args: [fixtures.webhook.eventId],
    });

    expect(registration.rows[0].status).toBe('paid');
    expect(registration.rows[0].stripe_customer_id).toBe('cus_webhook_parent');
    expect(Number(event.rows[0].spots_filled)).toBe(3);
    expect(Number(event.rows[0].pending_spots)).toBe(0);

    const replay = await postWebhook('evt_webhook_delivery_a');
    expect(replay.status()).toBe(200);

    event = await client.execute({
      sql: 'SELECT spots_filled, pending_spots FROM events WHERE id = ?',
      args: [fixtures.webhook.eventId],
    });
    expect(Number(event.rows[0].spots_filled)).toBe(3);
    expect(Number(event.rows[0].pending_spots)).toBe(0);
  } finally {
    client.close();
  }
});
