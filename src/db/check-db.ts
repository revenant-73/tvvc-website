import 'dotenv/config';
import { getDb } from './index';
import { events } from './schema';

const url = process.env.TURSO_DATABASE_URL!;
const db = getDb(url, process.env.TURSO_AUTH_TOKEN);

async function check() {
  console.log('--- DATABASE INFO ---');
  console.log(`URL: ${url}`);
  const allEvents = await db.select().from(events);
  console.log(`\n--- ALL EVENTS (${allEvents.length}) ---`);
  allEvents.forEach(e => {
    console.log(`ID: ${e.id} | Type: ${e.type} | Name: ${e.name} | Active: ${e.active}`);
  });
  console.log('------------------');
}

check().catch(console.error);
