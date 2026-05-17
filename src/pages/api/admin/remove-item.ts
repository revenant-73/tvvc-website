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
    const { passcode, itemId } = body;

    if (passcode !== ADMIN_PASSCODE) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const db = getDb(databaseUrl, import.meta.env.TURSO_AUTH_TOKEN || '');

    // 1. Get the item to find the eventId
    const [item] = await db.select().from(registrationItems).where(eq(registrationItems.id, itemId));
    
    if (!item) {
      return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });
    }

    // 2. Decrement spots filled for this specific event
    if (item.eventId) {
      await db.update(events)
        .set({ spotsFilled: sql`${events.spotsFilled} - 1` })
        .where(eq(events.id, item.eventId));
    }

    // 3. Delete the specific registration item
    await db.delete(registrationItems)
      .where(eq(registrationItems.id, itemId));

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error('Remove Item Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
