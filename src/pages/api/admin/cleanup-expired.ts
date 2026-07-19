import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { registrations, events, registrationItems } from '../../../db/schema';
import { eq, and, lt, sql, inArray } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Basic security check (could be a secret token in headers)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = import.meta.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    const now = Date.now();

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

    const expiredIds = expiredRegistrations.map(r => r.id);

    // 2. Process cleanup in a transaction
    const result = await db.transaction(async (tx) => {
      // Find all items associated with these registrations to release spots
      const items = await tx.select().from(registrationItems).where(inArray(registrationItems.registrationId, expiredIds));
      
      const releasedEvents: Record<string, number> = {};
      for (const item of items) {
        if (item.eventId) {
          releasedEvents[item.eventId] = (releasedEvents[item.eventId] || 0) + 1;
        }
      }

      // Decrement pendingSpots for each event
      for (const [eventId, count] of Object.entries(releasedEvents)) {
        await tx.update(events)
          .set({ pendingSpots: sql`MAX(0, ${events.pendingSpots} - ${count})` })
          .where(eq(events.id, eventId));
      }

      // Mark registrations as expired
      await tx.update(registrations)
        .set({ status: 'expired' })
        .where(inArray(registrations.id, expiredIds));

      return {
        registrationsProcessed: expiredIds.length,
        spotsReleased: items.length
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
