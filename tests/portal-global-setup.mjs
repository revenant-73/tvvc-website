import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const require = createRequire(import.meta.url);
const fixtures = require('./portal-fixtures.js');
const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  await fs.mkdir(path.dirname(fixtures.databasePath), { recursive: true });
  await fs.rm(fixtures.databasePath, { force: true });
  await fs.rm(`${fixtures.databasePath}-shm`, { force: true });
  await fs.rm(`${fixtures.databasePath}-wal`, { force: true });

  const client = createClient({ url: fixtures.databaseUrl });
  const migrationDir = path.join(currentDir, '..', 'drizzle');
  const migrationFiles = (await fs.readdir(migrationDir))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migration = (await fs.readFile(path.join(migrationDir, migrationFile), 'utf8'))
      .replaceAll('--> statement-breakpoint', '');
    await client.executeMultiple(migration);
  }

  const expires = Date.now() + 24 * 60 * 60 * 1000;
  const orderMetadata = (eventName, athleteName, amount) => JSON.stringify({
    orderItems: [{
      eventId: eventName.toLowerCase().replaceAll(' ', '-'),
      eventName,
      eventDate: 'August 10, 2099',
      eventTime: '10:00 AM',
      athleteName,
      unitAmount: amount,
    }],
  });

  await client.batch([
    {
      sql: `INSERT INTO user
        (id, name, email, email_verified, role, stripe_customer_id, emergency_phone)
        VALUES (?, ?, ?, ?, 'user', ?, ?)`,
      args: [
        fixtures.parentA.id,
        'Parent Alpha',
        fixtures.parentA.email,
        Date.now(),
        'cus_parent_alpha',
        '503-555-0101',
      ],
    },
    {
      sql: `INSERT INTO user
        (id, name, email, email_verified, role, stripe_customer_id, emergency_phone)
        VALUES (?, ?, ?, ?, 'user', ?, ?)`,
      args: [
        fixtures.parentB.id,
        'Parent Beta',
        fixtures.parentB.email,
        Date.now(),
        'cus_parent_beta',
        '503-555-0202',
      ],
    },
    {
      sql: `INSERT INTO user
        (id, name, email, email_verified, role, stripe_customer_id, emergency_phone)
        VALUES (?, ?, ?, ?, 'user', NULL, ?)`,
      args: [
        fixtures.legacyParent.id,
        'Legacy Parent',
        fixtures.legacyParent.email,
        Date.now(),
        '503-555-0303',
      ],
    },
    {
      sql: 'INSERT INTO session (session_token, userId, expires) VALUES (?, ?, ?)',
      args: [fixtures.parentA.sessionToken, fixtures.parentA.id, expires],
    },
    {
      sql: 'INSERT INTO session (session_token, userId, expires) VALUES (?, ?, ?)',
      args: [fixtures.parentA.secondSessionToken, fixtures.parentA.id, expires],
    },
    {
      sql: 'INSERT INTO session (session_token, userId, expires) VALUES (?, ?, ?)',
      args: [fixtures.parentB.sessionToken, fixtures.parentB.id, expires],
    },
    {
      sql: 'INSERT INTO session (session_token, userId, expires) VALUES (?, ?, ?)',
      args: [fixtures.legacyParent.sessionToken, fixtures.legacyParent.id, expires],
    },
    {
      sql: `INSERT INTO registrations
        (id, user_id, parent_name, parent_email, parent_phone, emergency_phone,
         stripe_session_id, stripe_customer_id, status, total_amount, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`,
      args: [
        fixtures.parentA.registrationId,
        fixtures.parentA.id,
        'Parent Alpha',
        fixtures.parentA.email,
        '503-555-0101',
        '503-555-0101',
        'cs_test_parent_alpha',
        'cus_parent_alpha',
        4500,
        orderMetadata(fixtures.parentA.eventName, fixtures.parentA.athleteName, 4500),
      ],
    },
    {
      sql: `INSERT INTO registrations
        (id, user_id, parent_name, parent_email, parent_phone, emergency_phone,
         stripe_session_id, stripe_customer_id, status, total_amount, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`,
      args: [
        fixtures.parentB.registrationId,
        fixtures.parentB.id,
        'Parent Beta',
        fixtures.parentB.email,
        '503-555-0202',
        '503-555-0202',
        'cs_test_parent_beta',
        'cus_parent_beta',
        6500,
        orderMetadata(fixtures.parentB.eventName, fixtures.parentB.athleteName, 6500),
      ],
    },
    {
      sql: `INSERT INTO registrations
        (id, user_id, parent_name, parent_email, parent_phone, emergency_phone,
         stripe_session_id, stripe_customer_id, status, total_amount, metadata)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`,
      args: [
        fixtures.legacyParent.registrationId,
        'Legacy Parent',
        ` ${fixtures.legacyParent.email.toUpperCase()} `,
        '503-555-0303',
        '503-555-0303',
        'cs_test_legacy_parent',
        fixtures.legacyParent.stripeCustomerId,
        5500,
        orderMetadata(fixtures.legacyParent.eventName, fixtures.legacyParent.athleteName, 5500),
      ],
    },
    {
      sql: `INSERT INTO registrations
        (id, user_id, parent_name, parent_email, parent_phone, emergency_phone,
         stripe_session_id, stripe_customer_id, status, total_amount, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`,
      args: [
        fixtures.emailCollision.registrationId,
        fixtures.parentB.id,
        'Parent Beta',
        fixtures.parentA.email,
        '503-555-0202',
        '503-555-0202',
        'cs_test_email_collision',
        'cus_parent_beta',
        7500,
        orderMetadata(
          fixtures.emailCollision.eventName,
          fixtures.emailCollision.athleteName,
          7500
        ),
      ],
    },
    {
      sql: `INSERT INTO player_profiles
        (id, parent_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, 'Avery', 'Alpha', '8th', 'None')`,
      args: [fixtures.parentA.athleteId, fixtures.parentA.id],
    },
    {
      sql: `INSERT INTO player_profiles
        (id, parent_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, 'Bailey', 'Beta', '7th', 'None')`,
      args: [fixtures.parentB.athleteId, fixtures.parentB.id],
    },
    {
      sql: `INSERT INTO player_profiles
        (id, parent_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, 'Casey', 'Collision', '10th', 'None')`,
      args: [fixtures.emailCollision.athleteId, fixtures.parentB.id],
    },
    {
      sql: `INSERT INTO athletes
        (id, registration_id, parent_id, profile_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, ?, ?, 'Avery', 'Alpha', '8th', 'None')`,
      args: [
        fixtures.parentA.athleteId,
        fixtures.parentA.registrationId,
        fixtures.parentA.id,
        fixtures.parentA.athleteId,
      ],
    },
    {
      sql: `INSERT INTO athletes
        (id, registration_id, parent_id, profile_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, ?, ?, 'Bailey', 'Beta', '7th', 'None')`,
      args: [
        fixtures.parentB.athleteId,
        fixtures.parentB.registrationId,
        fixtures.parentB.id,
        fixtures.parentB.athleteId,
      ],
    },
    {
      sql: `INSERT INTO athletes
        (id, registration_id, parent_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, NULL, 'Legacy', 'Player', '6th', 'None')`,
      args: [fixtures.legacyParent.athleteId, fixtures.legacyParent.registrationId],
    },
    {
      sql: `INSERT INTO athletes
        (id, registration_id, parent_id, profile_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, ?, ?, 'Casey', 'Collision', '10th', 'None')`,
      args: [
        fixtures.emailCollision.athleteId,
        fixtures.emailCollision.registrationId,
        fixtures.parentB.id,
        fixtures.emailCollision.athleteId,
      ],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES ('event-parent-a', 'clinic', ?, 'August 10, 2099', '10:00 AM',
                '2099-08-10', '2099-08-10', 4500, 30, true)`,
      args: [fixtures.parentA.eventName],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES ('event-parent-b', 'camp', ?, 'August 11, 2099', '11:00 AM',
                '2099-08-11', '2099-08-11', 6500, 30, true)`,
      args: [fixtures.parentB.eventName],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES ('event-legacy-parent', 'clinic', ?, 'August 12, 2099', '12:00 PM',
                '2099-08-12', '2099-08-12', 5500, 30, true)`,
      args: [fixtures.legacyParent.eventName],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES ('event-email-collision', 'clinic', ?, 'August 13, 2099', '1:00 PM',
                '2099-08-13', '2099-08-13', 7500, 30, true)`,
      args: [fixtures.emailCollision.eventName],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, 'event-parent-a')`,
      args: [fixtures.parentA.registrationId, fixtures.parentA.athleteId],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, 'event-parent-b')`,
      args: [fixtures.parentB.registrationId, fixtures.parentB.athleteId],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, 'event-legacy-parent')`,
      args: [fixtures.legacyParent.registrationId, fixtures.legacyParent.athleteId],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, 'event-email-collision')`,
      args: [fixtures.emailCollision.registrationId, fixtures.emailCollision.athleteId],
    },
  ], 'write');

  client.close();
}
