import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { registrationItems, events } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
    const ADMIN_PASSCODE = import.meta.env.ADMIN_PASSCODE || 'tvvc2024';

    if (!databaseUrl) {
      throw new Error('Database configuration missing');
    }

    const body = await request.json();
    const { passcode, itemId, newEventId } = body;

    if (passcode !== ADMIN_PASSCODE) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (!itemId || !newEventId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const db = getDb(databaseUrl, import.meta.env.TURSO_AUTH_TOKEN || '');

    // 1. Get the current registration item
    const [item] = await db.select().from(registrationItems).where(eq(registrationItems.id, itemId));
    
    if (!item) {
      return new Response(JSON.stringify({ error: 'Registration item not found' }), { status: 404 });
    }

    const oldEventId = item.eventId;
    if (oldEventId === newEventId) {
      return new Response(JSON.stringify({ error: 'Already registered for this event' }), { status: 400 });
    }

    // 2. Check if the new event has capacity
    const [newEvent] = await db.select().from(events).where(eq(events.id, newEventId));
    if (!newEvent) {
      return new Response(JSON.stringify({ error: 'New event not found' }), { status: 404 });
    }

    if (newEvent.spotsFilled >= newEvent.capacity) {
      return new Response(JSON.stringify({ error: 'New event is full' }), { status: 400 });
    }

    // 3. Update the registration item and adjust spots
    await db.transaction(async (tx) => {
      // Update the event ID on the item
      await tx.update(registrationItems)
        .set({ eventId: newEventId })
        .where(eq(registrationItems.id, itemId));

      // Decrement old event spots
      if (oldEventId) {
        await tx.update(events)
          .set({ spotsFilled: sql`${events.spotsFilled} - 1` })
          .where(eq(events.id, oldEventId));
      }

      // Increment new event spots
      await tx.update(events)
        .set({ spotsFilled: sql`${events.spotsFilled} + 1` })
        .where(eq(events.id, newEventId));
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error('Transfer Registration Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
