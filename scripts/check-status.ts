import 'dotenv/config';
import { getDb } from '../src/db';
import { events, registrations, registrationItems, athletes } from '../src/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function checkReminders() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    console.error('Missing TURSO_DATABASE_URL');
    return;
  }

  const db = getDb(databaseUrl, authToken || '');

  const today = new Date('2026-07-22');
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const inTwoDays = new Date(today);
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const inTwoDaysStr = inTwoDays.toISOString().split('T')[0];

  console.log(`Checking for events on Tomorrow (${tomorrowStr}) and In 2 Days (${inTwoDaysStr})`);

  const eventsSoon = await db.select().from(events).where(
    sql`${events.startDate} IN (${tomorrowStr}, ${inTwoDaysStr})`
  );

  if (eventsSoon.length === 0) {
    console.log('No events found for tomorrow or in 2 days.');
    return;
  }

  for (const event of eventsSoon) {
    console.log(`\nEvent: ${event.name} (${event.id})`);
    console.log(`Start Date: ${event.startDate}`);
    
    const participants = await db.select({
      parentEmail: registrations.parentEmail,
      status: registrations.status,
      athlete: athletes.firstName
    })
    .from(registrationItems)
    .innerJoin(registrations, eq(registrationItems.registrationId, registrations.id))
    .innerJoin(athletes, eq(registrationItems.athleteId, athletes.id))
    .where(eq(registrationItems.eventId, event.id));

    console.log(`Registrations: ${participants.length}`);
    participants.forEach(p => {
      console.log(`- ${p.athlete} (${p.parentEmail}): ${p.status}`);
    });

    if (event.startDate === tomorrowStr) {
      console.log(`>> Reminder for this event should have been sent on 2026-07-21.`);
    } else if (event.startDate === inTwoDaysStr) {
      console.log(`>> Reminder for this event should be sent TODAY (2026-07-22).`);
    }
  }
}

checkReminders();
