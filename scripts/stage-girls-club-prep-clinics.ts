import 'dotenv/config';
import { createClient } from '@libsql/client';

type GirlsClubPrepClinicConfig = {
  id: string;
  name: string;
  dateInfo: string;
  timeInfo: string;
  startDate: string;
};

const PRICE_CENTS = 3000;
const CAPACITY = 14;
const TIME_INFO = '3:00-5:00pm';
const PARENT_ID = 'girls-club-prep-fall-2026';

const databaseUrl = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!databaseUrl) {
  throw new Error('TURSO_DATABASE_URL is required.');
}

const targetsProduction = databaseUrl.includes('tvvc-registration') && !databaseUrl.includes('pilot');
if (targetsProduction && process.env.CONFIRM_STAGE_GIRLS_CLUB_PREP_PRODUCTION !== 'yes') {
  throw new Error(
    'Refusing to stage Girls Club Prep clinics in production without CONFIRM_STAGE_GIRLS_CLUB_PREP_PRODUCTION=yes.'
  );
}

const clinics: GirlsClubPrepClinicConfig[] = [
  {
    id: 'clinic-girls-club-prep-sep-13',
    name: 'Girls Club Prep Clinic',
    dateInfo: 'September 13, 2026',
    timeInfo: TIME_INFO,
    startDate: '2026-09-13',
  },
  {
    id: 'clinic-girls-club-prep-sep-20',
    name: 'Girls Club Prep Clinic',
    dateInfo: 'September 20, 2026',
    timeInfo: TIME_INFO,
    startDate: '2026-09-20',
  },
  {
    id: 'clinic-girls-club-prep-sep-27',
    name: 'Girls Club Prep Clinic',
    dateInfo: 'September 27, 2026',
    timeInfo: TIME_INFO,
    startDate: '2026-09-27',
  },
  {
    id: 'clinic-girls-club-prep-oct-04',
    name: 'Girls Club Prep Clinic',
    dateInfo: 'October 4, 2026',
    timeInfo: TIME_INFO,
    startDate: '2026-10-04',
  },
  {
    id: 'clinic-girls-club-prep-oct-11',
    name: 'Girls Club Prep Clinic',
    dateInfo: 'October 11, 2026',
    timeInfo: TIME_INFO,
    startDate: '2026-10-11',
  },
  {
    id: 'clinic-girls-club-prep-oct-18',
    name: 'Girls Club Prep Clinic',
    dateInfo: 'October 18, 2026',
    timeInfo: TIME_INFO,
    startDate: '2026-10-18',
  },
];

const client = createClient({ url: databaseUrl, authToken: authToken || undefined });

function registrationClosesAtLocal(startDate: string) {
  const [year, month, day] = startDate.split('-').map(Number);
  const previousDay = new Date(Date.UTC(year, month - 1, day - 1));
  const closeYear = previousDay.getUTCFullYear();
  const closeMonth = String(previousDay.getUTCMonth() + 1).padStart(2, '0');
  const closeDay = String(previousDay.getUTCDate()).padStart(2, '0');

  return `${closeYear}-${closeMonth}-${closeDay}T21:00`;
}

async function stageGirlsClubPrepClinics() {
  await client.batch(
    clinics.map((clinic) => ({
      sql: `INSERT INTO events
              (id, parent_id, type, name, description, date_info, time_info, start_date, end_date,
               price, capacity, waitlist_enabled, active, email_details, metadata)
            VALUES (?, ?, 'clinic', ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              parent_id = excluded.parent_id,
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
        clinic.id,
        PARENT_ID,
        clinic.name,
        '90-minute general volleyball clinic for girls in 6th-8th grade preparing for club volleyball.',
        clinic.dateInfo,
        clinic.timeInfo,
        clinic.startDate,
        clinic.startDate,
        PRICE_CENTS,
        CAPACITY,
        `${clinic.name} is ${clinic.dateInfo}, ${clinic.timeInfo}, at TVVC. Clinics are 90 minutes and capped at ${CAPACITY} players.`,
        JSON.stringify({
          registrationStream: 'camps-clinics',
          program: 'girls-club-prep',
          session: 'fall-2026',
          registrationClosesAtLocal: registrationClosesAtLocal(clinic.startDate),
          audience: 'Girls in 6th-8th grade',
          trainingFormat: '90-minute general volleyball clinic with individual skill development in representative game-like situations when numbers allow.',
        }),
      ],
    })),
    'write'
  );

  console.log(`Staged ${clinics.length} Girls Club Prep clinic events.`);
  console.log(`Price: $${PRICE_CENTS / 100}; capacity: ${CAPACITY}; time: ${TIME_INFO}.`);
}

stageGirlsClubPrepClinics()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
