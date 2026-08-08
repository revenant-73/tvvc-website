import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createClient } from '@libsql/client';
import { CLUB_SEASON_AGREEMENT_WORKING_DRAFTS } from '../lib/club-season-agreement-content';

const databaseUrl = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
const parentEmail = process.env.PILOT_PARENT_EMAIL?.trim().toLowerCase();

if (!databaseUrl || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
}

if (!parentEmail || !parentEmail.includes('@')) {
  throw new Error('PILOT_PARENT_EMAIL must be a valid email address.');
}

if (!databaseUrl.includes('tvvc-season-pilot')) {
  throw new Error('Refusing to seed a database that is not the isolated TVVC season pilot.');
}

const client = createClient({ url: databaseUrl, authToken });

const seasonId = '2026-2027-club';
const teamId = 'team-2026-2027-14u-pilot';
const tryoutEventId = 'event-2026-2027-club-tryout-pilot';
const sourceRegistrationId = 'tryout-registration-season-pilot';
const sourceAthleteId = 900001;
const offerId = 'offer-season-pilot';

const agreementDefinitions = [
  {
    id: 'agreement-2026-2027-season-commitment-pilot-v1',
    key: 'season-commitment',
    responseType: 'acknowledgement',
    allowedResponses: null,
    sortOrder: 10,
  },
  {
    id: 'agreement-2026-2027-refund-policy-pilot-v1',
    key: 'refund-cancellation-policy',
    responseType: 'acknowledgement',
    allowedResponses: null,
    sortOrder: 20,
  },
  {
    id: 'agreement-2026-2027-media-release-pilot-v1',
    key: 'media-release',
    responseType: 'choice',
    allowedResponses: JSON.stringify(['granted', 'declined']),
    sortOrder: 30,
  },
] as const;

function agreementHash(key: string, title: string, body: string) {
  return createHash('sha256').update([key, '1', title, body].join('\n')).digest('hex');
}

async function seedPilot() {
  await client.batch([
    {
      sql: `UPDATE club_seasons
            SET status = 'active', public_registration_enabled = 0,
                registration_opens_at = '2000-01-01T08:00:00.000Z',
                registration_closes_at = '2099-12-31T07:59:59.000Z',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [seasonId],
    },
    {
      sql: `INSERT OR IGNORE INTO club_teams
            (id, season_id, age_group_id, name, active, acceptance_deadline_override)
            VALUES (?, ?, 'age-2026-2027-14u', '14U Pilot', 1, '2099-11-30')`,
      args: [teamId, seasonId],
    },
    {
      sql: `INSERT OR IGNORE INTO events
            (id, type, name, date_info, start_date, price, capacity, spots_filled, active)
            VALUES (?, 'tryout', '2026-2027 Club Tryout Pilot', 'Pilot eligibility record',
                    '2026-11-01', 0, 1, 1, 1)`,
      args: [tryoutEventId],
    },
    {
      sql: `INSERT OR IGNORE INTO registrations
            (id, parent_name, parent_email, parent_phone, status, total_amount, metadata)
            VALUES (?, 'TVVC Pilot Parent', ?, '503-555-0100', 'paid', 0, ?)`,
      args: [
        sourceRegistrationId,
        parentEmail,
        JSON.stringify({ purpose: 'controlled-club-season-pilot' }),
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO athletes
            (id, registration_id, first_name, last_name, grade, division, waiver_agreed,
             photo_release_agreed, metadata)
            VALUES (?, ?, 'Pilot', 'Player', '8', '14U', 1, 0, ?)`,
      args: [
        sourceAthleteId,
        sourceRegistrationId,
        JSON.stringify({ purpose: 'controlled-club-season-pilot' }),
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO registration_items (registration_id, athlete_id, event_id)
            VALUES (?, ?, ?)`,
      args: [sourceRegistrationId, sourceAthleteId, tryoutEventId],
    },
    ...agreementDefinitions.map((agreement) => {
      const content = CLUB_SEASON_AGREEMENT_WORKING_DRAFTS[agreement.key];
      return {
        sql: `INSERT OR IGNORE INTO club_season_agreement_versions
              (id, season_id, key, version, title, summary, body, content_hash,
               response_type, allowed_responses, status, required, sort_order,
               effective_at, published_at)
              VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'published', 1, ?,
                      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [
          agreement.id,
          seasonId,
          agreement.key,
          content.title,
          content.summary,
          content.body,
          agreementHash(agreement.key, content.title, content.body),
          agreement.responseType,
          agreement.allowedResponses,
          agreement.sortOrder,
        ],
      };
    }),
    {
      sql: `INSERT INTO club_season_offers
            (id, season_id, team_id, source_registration_id, source_athlete_id,
             recipient_email, status, acceptance_deadline, offered_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'offered', '2099-11-30',
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET recipient_email = excluded.recipient_email,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        offerId,
        seasonId,
        teamId,
        sourceRegistrationId,
        sourceAthleteId,
        parentEmail,
      ],
    },
  ], 'write');

  console.log(`Pilot season data is ready for ${parentEmail}.`);
}

seedPilot()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
