import 'dotenv/config';
import { getDb } from './index';
import { events, registrationItems } from './schema';
import { eq, like, and } from 'drizzle-orm';

const db = getDb(process.env.TURSO_DATABASE_URL!, process.env.TURSO_AUTH_TOKEN);

async function cleanup() {
  console.log('Fetching all training blocks...');
  const allBlocks = await db.select().from(events).where(eq(events.type, 'training-block'));
  
  console.log(`Found ${allBlocks.length} blocks total.`);

  // List of dummy IDs to remove
  const dummyIds = [
    'training-block-june-10-8am',
    'training-block-june-10-10am',
    'training-block-june-12-8am',
    'training-block-june-12-10am',
    'training-block-june-15-2pm'
  ];

  for (const id of dummyIds) {
    try {
      // Check if there are registrations first
      const items = await db.select().from(registrationItems).where(eq(registrationItems.eventId, id));
      
      if (items.length > 0) {
        console.log(`Block ${id} has registrations. Marking as inactive instead of deleting.`);
        await db.update(events).set({ active: false }).where(eq(events.id, id));
      } else {
        console.log(`Deleting dummy block: ${id}`);
        await db.delete(events).where(eq(events.id, id));
      }
    } catch (e) {
      console.error(`Failed to process ${id}:`, e);
    }
  }

  console.log('Cleanup complete!');
}

cleanup().catch(console.error);
