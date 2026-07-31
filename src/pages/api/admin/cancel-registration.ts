import type { APIRoute } from 'astro';
import { registrations, events, registrationItems } from '../../../db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { requireAdminApiSession } from '../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const authorization = await requireAdminApiSession(request);
    if (!authorization.authorized) return authorization.response;

    const body = await request.json();
    const { registrationId } = body;
    const { db } = authorization;

    // 1. Get the registration and check status
    const [reg] = await db.select().from(registrations).where(eq(registrations.id, registrationId));
    
    if (!reg) {
      return new Response(JSON.stringify({ error: 'Registration not found' }), { status: 404 });
    }

    if (reg.status !== 'paid') {
      return new Response(JSON.stringify({ error: 'Only paid registrations can be cancelled' }), { status: 400 });
    }

    // 2. Find all events in this registration to decrement spotsFilled
    const items = await db.select().from(registrationItems).where(eq(registrationItems.registrationId, registrationId));
    
    // 3. Perform updates in a transaction-like way (sequential for Turso/LibSQL)
    for (const item of items) {
      if (item.eventId) {
        await db.update(events)
          .set({ spotsFilled: sql`${events.spotsFilled} - 1` })
          .where(eq(events.id, item.eventId));
      }
    }

    // 4. Update registration status
    await db.update(registrations)
      .set({ status: 'cancelled' })
      .where(eq(registrations.id, registrationId));

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error('Cancel Registration Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
