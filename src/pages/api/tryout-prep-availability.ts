import { and, eq, like } from 'drizzle-orm';
import { db } from '../../db/db';
import { events } from '../../db/schema';

export const prerender = false;

export async function GET() {
  try {
    if (!db) {
      return json({ events: [] });
    }

    const prepClinics = await db.select({
      id: events.id,
      capacity: events.capacity,
      spotsFilled: events.spotsFilled,
      pendingSpots: events.pendingSpots,
    })
    .from(events)
    .where(and(
      eq(events.type, 'clinic'),
      like(events.id, 'clinic-tryout-prep%'),
      eq(events.active, true)
    ));

    return json({
      events: prepClinics.map((event) => {
        const filled = (event.spotsFilled || 0) + (event.pendingSpots || 0);
        const capacity = event.capacity || 0;

        return {
          id: event.id,
          filled,
          capacity,
          isFull: capacity > 0 && filled >= capacity,
          spotsLeft: Math.max(0, capacity - filled),
        };
      }),
    });
  } catch (error) {
    console.error('Failed to load tryout prep clinic availability:', error);
    return json({ events: [] });
  }
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30, stale-while-revalidate=300',
    },
  });
}
