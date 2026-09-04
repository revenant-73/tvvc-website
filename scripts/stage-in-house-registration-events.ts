import 'dotenv/config';
import { createClient } from '@libsql/client';

type InHouseEventConfig = {
  id: string;
  type: 'ignition' | 'playworks';
  name: string;
  description: string;
  dateInfo: string;
  timeInfo: string;
  startDate: string;
  endDate: string;
  price: number;
  capacity: number;
  emailDetails: string;
  metadata: Record<string, unknown>;
};

const REGISTRATION_OPENS_ON = '2026-10-01';
const WINTER_START_DATE = '2027-01-11';
const WINTER_END_DATE = '2027-03-12';
const PRICE_CENTS = 20000;

const databaseUrl = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!databaseUrl) {
  throw new Error('TURSO_DATABASE_URL is required.');
}

const targetsProduction = databaseUrl.includes('tvvc-registration') && !databaseUrl.includes('pilot');
if (targetsProduction && process.env.CONFIRM_STAGE_IN_HOUSE_PRODUCTION !== 'yes') {
  throw new Error(
    'Refusing to stage in-house events in production without CONFIRM_STAGE_IN_HOUSE_PRODUCTION=yes.'
  );
}

function requiredPositiveInt(name: string): number {
  const rawValue = process.env[name]?.trim();
  const value = rawValue ? Number(rawValue) : NaN;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

const ignitionCapacity = requiredPositiveInt('IGNITION_WINTER_2027_CAPACITY');
const playworksCapacity = requiredPositiveInt('PLAYWORKS_WINTER_2027_CAPACITY');

const ignitionTimeInfo = process.env.IGNITION_WINTER_2027_TIME_INFO?.trim() || '1 hour, 2x per week';
const playworksTimeInfo = process.env.PLAYWORKS_WINTER_2027_TIME_INFO?.trim() || '1 hour, 2x per week';

const eventConfigs: InHouseEventConfig[] = [
  {
    id: 'ignition-winter-2027',
    type: 'ignition',
    name: 'Ignition Volleyball - Winter Session',
    description: 'In-house training for 4th-6th grade athletes.',
    dateInfo: 'Jan 11 - March 12, 2027',
    timeInfo: ignitionTimeInfo,
    startDate: WINTER_START_DATE,
    endDate: WINTER_END_DATE,
    price: PRICE_CENTS,
    capacity: ignitionCapacity,
    emailDetails: 'Ignition Volleyball Winter Session runs Jan 11 - March 12, 2027 at TVVC.',
    metadata: {
      registrationOpensOn: REGISTRATION_OPENS_ON,
      registrationStream: 'in-house',
      program: 'ignition',
      session: 'winter-2027',
    },
  },
  {
    id: 'playworks-winter-2027',
    type: 'playworks',
    name: 'PlayWorks - Winter Session',
    description: 'In-house training for 7th-8th grade athletes, with 6th graders by director approval.',
    dateInfo: 'Jan 11 - March 12, 2027',
    timeInfo: playworksTimeInfo,
    startDate: WINTER_START_DATE,
    endDate: WINTER_END_DATE,
    price: PRICE_CENTS,
    capacity: playworksCapacity,
    emailDetails: 'PlayWorks Winter Session runs Jan 11 - March 12, 2027 at TVVC.',
    metadata: {
      registrationOpensOn: REGISTRATION_OPENS_ON,
      registrationStream: 'in-house',
      program: 'playworks',
      session: 'winter-2027',
    },
  },
];

const client = createClient({ url: databaseUrl, authToken: authToken || undefined });

async function stageInHouseEvents() {
  await client.batch(
    eventConfigs.map((eventConfig) => ({
      sql: `INSERT INTO events
              (id, type, name, description, date_info, time_info, start_date, end_date,
               price, capacity, waitlist_enabled, active, email_details, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              type = excluded.type,
              name = excluded.name,
              description = excluded.description,
              date_info = excluded.date_info,
              time_info = excluded.time_info,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              price = excluded.price,
              capacity = excluded.capacity,
              waitlist_enabled = excluded.waitlist_enabled,
              active = excluded.active,
              email_details = excluded.email_details,
              metadata = excluded.metadata`,
      args: [
        eventConfig.id,
        eventConfig.type,
        eventConfig.name,
        eventConfig.description,
        eventConfig.dateInfo,
        eventConfig.timeInfo,
        eventConfig.startDate,
        eventConfig.endDate,
        eventConfig.price,
        eventConfig.capacity,
        eventConfig.emailDetails,
        JSON.stringify(eventConfig.metadata),
      ],
    })),
    'write'
  );

  console.log(`Staged ${eventConfigs.length} in-house winter registration events.`);
  console.log(`Registration opens on ${REGISTRATION_OPENS_ON}; active rows stay hidden until that date.`);
}

stageInHouseEvents()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
