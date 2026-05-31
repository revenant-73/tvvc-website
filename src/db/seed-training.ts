import 'dotenv/config';
import { getDb } from './index';
import { events } from './schema';

const db = getDb(process.env.TURSO_DATABASE_URL!, process.env.TURSO_AUTH_TOKEN);

const dates = [
  'June 13', 'June 14', 'June 19', 'June 20', 'June 21', 'June 26', 'June 27', 'June 28',
  'July 10', 'July 11', 'July 12', 'July 17', 'July 18', 'July 19', 'July 24', 'July 25', 'July 26', 'July 31',
  'August 1', 'August 2', 'August 8', 'August 9'
];

const times = ['9:00am–10:30am', '10:30am–12:00pm'];

const trainingBlocks = [];

for (const date of dates) {
  for (const time of times) {
    const id = `training-block-${date.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${time.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    trainingBlocks.push({
      id,
      type: 'training-block',
      name: 'Small Group Training Block',
      dateInfo: date,
      timeInfo: time,
      price: 8000,
      capacity: 1,
      spotsFilled: 0,
      active: true,
      description: '90-minute training block for 1–4 players.'
    });
  }
}

async function seed() {
  console.log(`Seeding ${trainingBlocks.length} training blocks...`);
  for (const block of trainingBlocks) {
    await db.insert(events).values(block).onConflictDoUpdate({
      target: events.id,
      set: block
    });
  }
  console.log('Training blocks seeded successfully!');
}

seed().catch(console.error);
