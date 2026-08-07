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
      sql: `UPDATE club_seasons
            SET public_registration_enabled = 1, status = 'active'
            WHERE id = ?`,
      args: [fixtures.clubSeason.id],
    },
    {
      sql: `INSERT INTO club_teams
        (id, season_id, age_group_id, name, active, acceptance_deadline_override)
        VALUES (?, ?, 'age-2026-2027-14u', ?, 1, '2099-11-30')`,
      args: [fixtures.clubSeason.teamId, fixtures.clubSeason.id, fixtures.clubSeason.teamName],
    },
    {
      sql: `INSERT INTO club_season_agreement_versions
        (id, season_id, key, version, title, summary, body, content_hash,
         response_type, allowed_responses, status, required, sort_order, published_at)
        VALUES (?, ?, 'season-commitment', 1, 'Club season participation commitment',
                'Attendance, communication, and team participation', ?, ?,
                'acknowledgement', NULL, 'published', 1, 10, CURRENT_TIMESTAMP)`,
      args: [
        fixtures.clubSeason.agreementIds.commitment,
        fixtures.clubSeason.id,
        'I confirm that our family has reviewed the offered team and understands the season requires reliable attendance, timely communication, and participation in scheduled practices and tournaments.',
        '0fd0ff3088015996d43874f4332c379c436f544d7d758195f707535d147d5940',
      ],
    },
    {
      sql: `INSERT INTO club_season_agreement_versions
        (id, season_id, key, version, title, summary, body, content_hash,
         response_type, allowed_responses, status, required, sort_order, published_at)
        VALUES (?, ?, 'refund-cancellation-policy', 1, 'Refund and cancellation policy',
                'How cancellations, withdrawals, and approved refunds are handled', ?, ?,
                'acknowledgement', NULL, 'published', 1, 20, CURRENT_TIMESTAMP)`,
      args: [
        fixtures.clubSeason.agreementIds.refund,
        fixtures.clubSeason.id,
        'I have reviewed the TVVC refund and cancellation policy, including the three-business-day cancellation period, the nonrefundable deposit after that period and before the first practice, and case-by-case review of voluntary withdrawals after practices begin.',
        '648c375d96811b08605ac4169f56c43adaf7b64a071be7104a3ec8ee3a85972b',
      ],
    },
    {
      sql: `INSERT INTO club_season_agreement_versions
        (id, season_id, key, version, title, summary, body, content_hash,
         response_type, allowed_responses, status, required, sort_order, published_at)
        VALUES (?, ?, 'media-release', 1, 'Player media release',
                'Choose whether TVVC may use player photos or video', ?, ?,
                'choice', '["granted","declined"]', 'published', 1, 30, CURRENT_TIMESTAMP)`,
      args: [
        fixtures.clubSeason.agreementIds.media,
        fixtures.clubSeason.id,
        'Choose whether TVVC may use photos or video of this player in club communications, team materials, and promotional content. Declining does not affect roster eligibility.',
        'e1e395f1d65d0dd21fa07d99522cf672582bd0c30421c7489892664005fd1c86',
      ],
    },
    {
      sql: `INSERT INTO user
        (id, name, email, email_verified, role, stripe_customer_id, emergency_phone)
        VALUES (?, 'Admin Alpha', ?, ?, 'admin', NULL, NULL)`,
      args: [
        fixtures.admin.id,
        fixtures.admin.email,
        Date.now(),
      ],
    },
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
    ...Object.values(fixtures.clubSeasonPayments).map((paymentFixture) => ({
      sql: `INSERT INTO user
        (id, name, email, email_verified, role, stripe_customer_id, emergency_phone)
        VALUES (?, ?, ?, ?, 'user', ?, '503-555-0700')`,
      args: [
        paymentFixture.userId,
        `${paymentFixture.athleteName} Parent`,
        paymentFixture.email,
        Date.now(),
        `cus_${paymentFixture.userId.replaceAll('-', '_')}`,
      ],
    })),
    {
      sql: 'INSERT INTO session (session_token, userId, expires) VALUES (?, ?, ?)',
      args: [fixtures.admin.sessionToken, fixtures.admin.id, expires],
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
    ...Object.values(fixtures.clubSeasonPayments).map((paymentFixture) => ({
      sql: 'INSERT INTO session (session_token, userId, expires) VALUES (?, ?, ?)',
      args: [paymentFixture.sessionToken, paymentFixture.userId, expires],
    })),
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
    ...Object.values(fixtures.clubSeasonPayments).map((paymentFixture) => ({
      sql: `INSERT INTO registrations
        (id, user_id, parent_name, parent_email, parent_phone, emergency_phone,
         stripe_session_id, stripe_customer_id, status, total_amount, metadata)
        VALUES (?, ?, ?, ?, '503-555-0700', '503-555-0701', ?, ?, 'paid', 5000, ?)`,
      args: [
        paymentFixture.sourceRegistrationId,
        paymentFixture.userId,
        `${paymentFixture.athleteName} Parent`,
        paymentFixture.email,
        `cs_test_${paymentFixture.userId}`,
        `cus_${paymentFixture.userId.replaceAll('-', '_')}`,
        orderMetadata(fixtures.clubSeason.tryoutEventName, paymentFixture.athleteName, 5000),
      ],
    })),
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
    ...Object.values(fixtures.clubSeasonPayments).map((paymentFixture) => {
      const [firstName, lastName] = paymentFixture.athleteName.split(' ');
      return {
        sql: `INSERT INTO player_profiles
          (id, parent_id, first_name, last_name, grade, medical_info)
          VALUES (?, ?, ?, ?, '8th', 'None')`,
        args: [paymentFixture.athleteId, paymentFixture.userId, firstName, lastName],
      };
    }),
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
    ...Object.values(fixtures.clubSeasonPayments).map((paymentFixture) => {
      const [firstName, lastName] = paymentFixture.athleteName.split(' ');
      return {
        sql: `INSERT INTO athletes
          (id, registration_id, parent_id, profile_id, first_name, last_name, grade, medical_info)
          VALUES (?, ?, ?, ?, ?, ?, '8th', 'None')`,
        args: [
          paymentFixture.athleteId,
          paymentFixture.sourceRegistrationId,
          paymentFixture.userId,
          paymentFixture.athleteId,
          firstName,
          lastName,
        ],
      };
    }),
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
      sql: `INSERT INTO events
        (id, type, name, date_info, time_info, start_date, end_date, price, capacity, active)
        VALUES (?, 'tryout', ?, 'November 1, 2099', '9:00 AM',
                '2099-11-01', '2099-11-01', 5000, 300, true)`,
      args: [fixtures.clubSeason.tryoutEventId, fixtures.clubSeason.tryoutEventName],
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
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, ?)`,
      args: [
        fixtures.parentA.registrationId,
        fixtures.parentA.athleteId,
        fixtures.clubSeason.tryoutEventId,
      ],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, ?)`,
      args: [
        fixtures.parentB.registrationId,
        fixtures.parentB.athleteId,
        fixtures.clubSeason.tryoutEventId,
      ],
    },
    {
      sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, ?)`,
      args: [
        fixtures.emailCollision.registrationId,
        fixtures.emailCollision.athleteId,
        fixtures.clubSeason.tryoutEventId,
      ],
    },
    ...Object.values(fixtures.clubSeasonPayments).flatMap((paymentFixture) => ([
      {
        sql: `INSERT INTO registration_items (registration_id, athlete_id, event_id)
              VALUES (?, ?, ?)`,
        args: [
          paymentFixture.sourceRegistrationId,
          paymentFixture.athleteId,
          fixtures.clubSeason.tryoutEventId,
        ],
      },
      {
        sql: `INSERT INTO club_season_offers
          (id, season_id, team_id, source_registration_id, source_athlete_id,
           source_profile_id, recipient_email, recipient_user_id, status,
           acceptance_deadline, offered_at, viewed_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'registration_started', '2099-11-30',
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [
          paymentFixture.offerId,
          fixtures.clubSeason.id,
          fixtures.clubSeason.teamId,
          paymentFixture.sourceRegistrationId,
          paymentFixture.athleteId,
          paymentFixture.athleteId,
          paymentFixture.email,
          paymentFixture.userId,
        ],
      },
      {
        sql: `INSERT INTO club_season_registrations
          (id, offer_id, season_id, team_id, owner_user_id, player_profile_id,
           status, current_step, draft_data, draft_schema_version, version,
           submitted_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'awaiting_payment', 4, ?, 1, 4,
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [
          paymentFixture.registrationId,
          paymentFixture.offerId,
          fixtures.clubSeason.id,
          fixtures.clubSeason.teamId,
          paymentFixture.userId,
          paymentFixture.athleteId,
          JSON.stringify({ schemaVersion: 1 }),
        ],
      },
      {
        sql: `INSERT INTO club_season_agreement_acceptances
          (id, registration_id, agreement_version_id, owner_user_id,
           agreement_key_snapshot, agreement_title_snapshot,
           agreement_body_snapshot, agreement_content_hash, response,
           accepted_name, accepted_email, context_snapshot, accepted_at, created_at)
          VALUES (?, ?, ?, ?, 'season-commitment', 'Club season participation commitment',
                  'Test-only accepted agreement evidence', ?, 'accepted', ?, ?, ?,
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [
          `${paymentFixture.registrationId}-acceptance`,
          paymentFixture.registrationId,
          fixtures.clubSeason.agreementIds.commitment,
          paymentFixture.userId,
          '0fd0ff3088015996d43874f4332c379c436f544d7d758195f707535d147d5940',
          `${paymentFixture.athleteName} Parent`,
          paymentFixture.email,
          JSON.stringify({
            season: { id: fixtures.clubSeason.id, name: '2026-2027 Club Season' },
            team: { id: fixtures.clubSeason.teamId, name: fixtures.clubSeason.teamName, ageGroup: '14U' },
            pricing: {
              tierId: 'tier-2026-2027-13u-18u',
              tierName: '13U-18U',
              totalAmount: 150000,
              depositAmount: 40000,
              installmentAmount: 22000,
            },
            offerId: paymentFixture.offerId,
            sourceAthleteId: paymentFixture.athleteId,
          }),
        ],
      },
    ])),
  ], 'write');

  client.close();
}
