import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { events } from '../../../db/schema';

export const prerender = false;

const outdoorEvents = [
  {
    id: 'tournament-grass-series-1',
    type: 'tournament',
    name: 'Summer Grass Series #1',
    dateInfo: 'June 27, 2026',
    timeInfo: '9:00am–4:00pm',
    price: 1500,
    capacity: 48,
    active: true,
  },
  {
    id: 'tournament-grass-series-2',
    type: 'tournament',
    name: 'Summer Grass Series #2',
    dateInfo: 'July 18, 2026',
    timeInfo: '9:00am–4:00pm',
    price: 1500,
    capacity: 48,
    active: true,
  },
  {
    id: 'tournament-family-challenge',
    type: 'family-challenge',
    name: 'Family Grass Challenge',
    dateInfo: 'August 8, 2026',
    timeInfo: '9:00am–2:00pm',
    price: 1500,
    capacity: 48,
    active: true,
  }
];

export const GET: APIRoute = async () => {
  try {
    const db = getDb(
      import.meta.env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL || '',
      import.meta.env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || ''
    );

    console.log('Seeding outdoor events via live API...');
    for (const event of outdoorEvents) {
      await db.insert(events).values(event).onConflictDoUpdate({
        target: events.id,
        set: event
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Outdoor tournaments seeded successfully in the production database!' 
    }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }), { status: 500 });
  }
};
