import 'dotenv/config';
import { getDb } from './index';
import { events } from './schema';

const db = getDb(process.env.TURSO_DATABASE_URL!, process.env.TURSO_AUTH_TOKEN);

async function check() {
  const allEvents = await db.select().from(events);
  console.log('--- ALL EVENTS ---');
  allEvents.forEach(e => {
    console.log(`ID: ${e.id} | Type: ${e.type} | Name: ${e.name} | Active: ${e.active}`);
  });
  console.log('------------------');
}

check().catch(console.error);
