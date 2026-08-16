import assert from 'node:assert/strict';
import test from 'node:test';
import { createStripeClient } from '../src/lib/stripe-client.ts';

test('creates a Stripe client when Astro import.meta.env is unavailable', () => {
  const client = createStripeClient('sk_test_billing_worker_regression');

  assert.ok(client);
});
