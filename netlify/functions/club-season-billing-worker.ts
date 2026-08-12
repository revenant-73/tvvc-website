import { getDb } from '../../src/db';
import { runClubSeasonBilling } from '../../src/lib/club-season-billing';
import { createStripeClient } from '../../src/lib/stripe-client';

export default async (request: Request) => {
  const expected = process.env.CLUB_SEASON_CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return new Response(null, { status: 401 });
  }
  if (!process.env.TURSO_DATABASE_URL || !process.env.STRIPE_SECRET_KEY) {
    console.error('Club-season billing worker is missing database or Stripe configuration.');
    return new Response(null, { status: 500 });
  }

  const result = await runClubSeasonBilling({
    db: getDb(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN || ''),
    stripe: createStripeClient(process.env.STRIPE_SECRET_KEY),
    siteUrl: process.env.URL || 'https://tualatinvalleyvb.com',
  });
  console.log('Club-season billing run complete:', result);
  console.log(JSON.stringify(result));
};

export const config = { background: true };
