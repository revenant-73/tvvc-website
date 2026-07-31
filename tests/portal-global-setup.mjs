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
  const orderMetadata = (
    eventName,
    athleteName,
    amount,
    eventDate = 'August 10, 2099',
    eventTime = '10:00 AM'
  ) => JSON.stringify({
    orderItems: [{
      eventId: eventName.toLowerCase().replaceAll(' ', '-'),
      eventName,
      eventDate,
      eventTime,
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
        VALUES (?, 'Guardian Alpha', ?, ?, 'user', NULL, NULL)`,
      args: [
        fixtures.guardian.id,
        fixtures.guardian.email,
        Date.now(),
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
      sql: 'INSERT INTO session (session_token, userId, expires) VALUES (?, ?, ?)',
      args: [fixtures.guardian.sessionToken, fixtures.guardian.id, expires],
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
         stripe_session_id, status, total_amount, expires_at, metadata)
        VALUES (?, NULL, 'Cleanup Parent', 'cleanup-expired@example.test', '503-555-0601', '503-555-0602',
                ?, 'pending', ?, ?, ?)`,
      args: [
        fixtures.expirationCleanup.registrationId,
        fixtures.expirationCleanup.sessionId,
        fixtures.expirationCleanup.totalAmount,
        Date.now() - 60 * 1000,
        orderMetadata(
          fixtures.expirationCleanup.eventName,
          'Cleanup Player',
          fixtures.expirationCleanup.totalAmount
        ),
      ],
    },
    {
      sql: `INSERT INTO registrations
        (id, user_id, parent_name, parent_email, parent_phone, emergency_phone,
         stripe_session_id, stripe_customer_id, status, total_amount, metadata)
        VALUES (?, ?, 'Parent Alpha', ?, '503-555-0101', '503-555-0101',
                'cs_test_parent_alpha_history', 'cus_parent_alpha', 'paid', 4500, ?)`,
      args: [
        fixtures.scheduleHistory.historicalRegistrationId,
        fixtures.parentA.id,
        fixtures.parentA.email,
        orderMetadata(
          fixtures.scheduleHistory.historicalSnapshotEventName,
          fixtures.parentA.athleteName,
          4500,
          'May 1, 2020',
          '9:00 AM'
        ),
      ],
    },
    {
      sql: `INSERT INTO registrations
        (id, user_id, parent_name, parent_email, parent_phone, emergency_phone,
         stripe_session_id, stripe_customer_id, status, total_amount, metadata)
        VALUES (?, ?, 'Parent Alpha', ?, '503-555-0101', '503-555-0101',
                'cs_test_parent_alpha_cancelled', 'cus_parent_alpha', 'cancelled', 3500, ?)`,
      args: [
        fixtures.scheduleHistory.cancelledRegistrationId,
        fixtures.parentA.id,
        fixtures.parentA.email,
        orderMetadata(
          fixtures.scheduleHistory.cancelledEventName,
          fixtures.parentA.athleteName,
          3500
        ),
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
      sql: `UPDATE registrations
            SET secondary_parent_email = ?
            WHERE id = ?`,
      args: [fixtures.guardian.email, fixtures.parentB.registrationId],
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
      sql: `INSERT INTO registrations
        (id, user_id, parent_name, parent_email, parent_phone, emergency_phone,
         stripe_session_id, status, total_amount, expires_at, metadata)
        VALUES (?, NULL, 'Webhook Parent', 'webhook-parent@example.test', '503-555-0401', '503-555-0402',
                ?, 'pending', ?, ?, ?)`,
      args: [
        fixtures.webhook.registrationId,
        fixtures.webhook.sessionId,
        fixtures.webhook.totalAmount,
        Date.now() + 30 * 60 * 1000,
        orderMetadata(
          fixtures.webhook.eventName,
          'Webhook Player',
          fixtures.webhook.totalAmount
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
        VALUES (?, ?, 'Avery', 'Duplicate', '9th', 'Duplicate profile snapshot')`,
      args: [fixtures.duplicateProfile.id, fixtures.parentA.id],
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
        (id, registration_id, parent_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, NULL, 'Cleanup', 'Player', '8th', 'None')`,
      args: [
        fixtures.expirationCleanup.athleteId,
        fixtures.expirationCleanup.registrationId,
      ],
    },
    {
      sql: `INSERT INTO athletes
        (id, registration_id, parent_id, profile_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, ?, ?, 'Avery', 'Alpha', '8th', 'Historical order snapshot')`,
      args: [
        fixtures.scheduleHistory.historicalAthleteId,
        fixtures.scheduleHistory.historicalRegistrationId,
        fixtures.parentA.id,
        fixtures.parentA.athleteId,
      ],
    },
    {
      sql: `INSERT INTO athletes
        (id, registration_id, parent_id, profile_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, ?, ?, 'Avery', 'Alpha', '8th', 'Cancelled order snapshot')`,
      args: [
        fixtures.scheduleHistory.cancelledAthleteId,
        fixtures.scheduleHistory.cancelledRegistrationId,
        fixtures.parentA.id,
        fixtures.parentA.athleteId,
      ],
    },
    {
      sql: `INSERT INTO athletes
        (id, registration_id, parent_id, profile_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, ?, ?, 'Avery', 'Duplicate', '9th', 'Historical duplicate snapshot')`,
      args: [
        fixtures.duplicateProfile.snapshotId,
        fixtures.parentA.registrationId,
        fixtures.parentA.id,
        fixtures.duplicateProfile.id,
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
      sql: `INSERT INTO athletes
        (id, registration_id, parent_id, first_name, last_name, grade, medical_info)
        VALUES (?, ?, NULL, 'Webhook', 'Player', '8th', 'None')`,
      args: [
        fixtures.webhook.athleteId,
        fixtures.webhook.registrationId,
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
        (id, type, name, date_info, time_info, start_date, end_date, price,
         capacity, spots_filled, pending_spots, active)
        VALUES (?, 'clinic', ?, 'August 20, 2099', '10:00 AM',
                '2099-08-20', '2099-08-20', ?, 10, 2, 1, true)`,
      args: [
        fixtures.webhook.eventId,
        fixtures.webhook.eventName,
        fixtures.webhook.totalAmount,
      ],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price,
         capacity, spots_filled, pending_spots, active)
        VALUES (?, 'clinic', ?, 'October 10, 2099', '4:00 PM',
                '2099-10-10', '2099-10-10', ?, 10, 0, 1, true)`,
      args: [
        fixtures.expirationCleanup.eventId,
        fixtures.expirationCleanup.eventName,
        fixtures.expirationCleanup.totalAmount,
      ],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price,
         capacity, spots_filled, pending_spots, active)
        VALUES (?, 'clinic', ?, 'September 10, 2099', '4:00 PM',
                '2099-09-10', '2099-09-10', ?, 1, 0, 0, true)`,
      args: [
        fixtures.capacity.eventId,
        fixtures.capacity.eventName,
        fixtures.capacity.price,
      ],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES ('event-parent-a-history', 'clinic', ?, 'May 1, 2020', '9:00 AM',
                '2020-05-01', '2020-05-01', 9900, 30, true)`,
      args: [fixtures.scheduleHistory.historicalCurrentEventName],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES ('event-parent-a-ongoing', 'camp', ?, '2020–2099', 'All day',
                '2020-01-01', '2099-12-31', 2500, 30, true)`,
      args: [fixtures.scheduleHistory.ongoingEventName],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES ('event-parent-a-inactive', 'clinic', ?, 'September 1, 2099', '2:00 PM',
                '2099-09-01', '2099-09-01', 2500, 30, false)`,
      args: [fixtures.scheduleHistory.inactiveEventName],
    },
    {
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES ('event-parent-a-cancelled', 'clinic', ?, 'September 2, 2099', '3:00 PM',
                '2099-09-02', '2099-09-02', 3500, 30, true)`,
      args: [fixtures.scheduleHistory.cancelledEventName],
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
            VALUES (?, ?, ?)`,
      args: [
        fixtures.webhook.registrationId,
        fixtures.webhook.athleteId,
        fixtures.webhook.eventId,
      ],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, ?)`,
      args: [
        fixtures.expirationCleanup.registrationId,
        fixtures.expirationCleanup.athleteId,
        fixtures.expirationCleanup.eventId,
      ],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, 'event-parent-a-history')`,
      args: [
        fixtures.scheduleHistory.historicalRegistrationId,
        fixtures.scheduleHistory.historicalAthleteId,
      ],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, 'event-parent-a-ongoing')`,
      args: [fixtures.parentA.registrationId, fixtures.parentA.athleteId],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, 'event-parent-a-inactive')`,
      args: [fixtures.parentA.registrationId, fixtures.parentA.athleteId],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, 'event-parent-a-cancelled')`,
      args: [
        fixtures.scheduleHistory.cancelledRegistrationId,
        fixtures.scheduleHistory.cancelledAthleteId,
      ],
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
