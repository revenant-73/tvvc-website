import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { registrations } from '../../../db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { expirePendingRegistration } from '../../../lib/registration-reservations';

export const POST: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const cronSecret = import.meta.env.CRON_SECRET || process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET is missing; refusing to run registration cleanup.');
      return new Response(JSON.stringify({ error: 'Cron authentication is not configured' }), { status: 503 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
    if (!databaseUrl) {
      return new Response(JSON.stringify({ error: 'Database configuration missing' }), { status: 500 });
    }

    const db = getDb(
      databaseUrl,
      import.meta.env.TURSO_AUTH_TOKEN || ''
    );

    const now = new Date();

    // 1. Find expired pending registrations
    const expiredRegistrations = await db.select({
      id: registrations.id
    })
    .from(registrations)
    .where(
      and(
        eq(registrations.status, 'pending'),
        lt(registrations.expiresAt, now)
      )
    );

    if (expiredRegistrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No expired registrations found.' }), { status: 200 });
    }

    // 2. Process cleanup in a transaction. Each candidate must still win the
    // pending -> expired transition before it may release capacity.
    const result = await db.transaction(async (tx) => {
      let registrationsProcessed = 0;
      let spotsReleased = 0;

      for (const registration of expiredRegistrations) {
        const expiration = await expirePendingRegistration(tx, registration.id);
        if (expiration.expired) registrationsProcessed += 1;
        spotsReleased += expiration.spotsReleased;
      }

      return {
        registrationsProcessed,
        spotsReleased,
      };
    });

    return new Response(JSON.stringify({ 
      success: true, 
      ...result
    }), { status: 200 });

  } catch (err) {
    console.error('Cleanup API Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
