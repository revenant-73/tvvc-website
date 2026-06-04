import 'dotenv/config';
import { getDb } from './index';
import { events } from './schema';

const db = getDb(process.env.TURSO_DATABASE_URL!, process.env.TURSO_AUTH_TOKEN);

const outdoorEvents = [
  {
    id: 'tournament-grass-series-1',
    type: 'tournament',
    name: 'Summer Grass Series #1',
    dateInfo: 'June 27, 2026',
    timeInfo: '9:00am–4:00pm',
    price: 1500, // $15 per player
    capacity: 48, // 24 teams
  },
  {
    id: 'tournament-grass-series-2',
    type: 'tournament',
    name: 'Summer Grass Series #2',
    dateInfo: 'July 18, 2026',
    timeInfo: '9:00am–4:00pm',
    price: 1500, // $15 per player
    capacity: 48, // 24 teams
  },
  {
    id: 'tournament-family-challenge',
    type: 'family-challenge',
    name: 'Family Grass Challenge',
    dateInfo: 'August 8, 2026',
    timeInfo: '9:00am–2:00pm',
    price: 1500, // $15 per player ($30 per team)
    capacity: 48, // 24 teams
  }
];

async function seed() {
  console.log('Seeding outdoor events...');
  for (const event of outdoorEvents) {
    await db.insert(events).values(event).onConflictDoUpdate({
      target: events.id,
      set: event
    });
  }
  console.log('Outdoor seed completed successfully!');
}

seed().catch(console.error);
