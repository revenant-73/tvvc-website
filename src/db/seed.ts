import 'dotenv/config';
import { getDb } from './index';
import { events } from './schema';

const db = getDb(process.env.TURSO_DATABASE_URL!, process.env.TURSO_AUTH_TOKEN);

const camps = [
  {
    id: 'camp-foundations-june-15',
    parentId: 'camp-foundations',
    type: 'camp',
    name: '6th-8th Grade Volleyball Foundations Camp',
    dateInfo: 'June 15–17',
    timeInfo: '8:00am–12:00pm',
    startDate: '2026-06-15',
    price: 18500,
    capacity: 12,
    active: false,
  },
  {
    id: 'camp-hitting-foundations-june-22',
    parentId: 'camp-hitting-foundations',
    type: 'camp',
    name: 'Hitting Foundations Camp',
    dateInfo: 'June 22–24',
    timeInfo: '8:00am–12:00pm',
    startDate: '2026-06-22',
    price: 18500,
    capacity: 12,
    active: false,
  },
  {
    id: 'camp-performance-july-06',
    parentId: 'camp-performance',
    type: 'camp',
    name: '6th-8th Grade Volleyball Performance Camp',
    dateInfo: 'July 6–8',
    timeInfo: '8:00am–12:00pm',
    startDate: '2026-07-06',
    price: 18500,
    capacity: 12,
    active: false,
  },
  {
    id: 'camp-ignition-july-13',
    parentId: 'camp-ignition',
    type: 'camp',
    name: 'Ignition Camp – 4th–6th Grade',
    dateInfo: 'July 13–15',
    timeInfo: '8:00am–12:00pm',
    startDate: '2026-07-13',
    price: 18500,
    capacity: 12,
    active: false,
  },
  {
    id: 'camp-hitting-performance-july-20',
    parentId: 'camp-hitting-performance',
    type: 'camp',
    name: 'Hitting Performance Camp',
    description: 'Throughout the camp, players will work on attacking with purpose by reading the set, block, and defense; creating different attacking solutions; and applying those skills in game-like situations.',
    dateInfo: 'July 20–22',
    timeInfo: '8:00am–12:00pm',
    startDate: '2026-07-20',
    price: 18500,
    capacity: 12,
    active: false,
  },
  {
    id: 'camp-foundations-july-27',
    parentId: 'camp-foundations',
    type: 'camp',
    name: '6th-8th Grade Volleyball Foundations Camp',
    dateInfo: 'July 27–29',
    timeInfo: '8:00am–12:00pm',
    startDate: '2026-07-27',
    price: 18500,
    capacity: 12,
    active: false,
  },
  {
    id: 'camp-hs-prep-1-aug-03',
    parentId: 'camp-hs-prep',
    type: 'camp',
    name: 'High School Tryout Prep Camp #1',
    dateInfo: 'August 3–5',
    timeInfo: '8:00am–12:00pm',
    startDate: '2026-08-03',
    price: 18500,
    capacity: 12,
    active: false,
  },
  {
    id: 'camp-hs-prep-2-aug-10',
    parentId: 'camp-hs-prep',
    type: 'camp',
    name: 'High School Tryout Prep Camp #2',
    dateInfo: 'August 10–12',
    timeInfo: '8:00am–12:00pm',
    startDate: '2026-08-10',
    price: 18500,
    capacity: 12,
    active: false,
  },
];

const clinicDates = [
  { dates: ['May 16', 'May 23', 'May 30'], timePrefix: 'May Saturdays' },
  { dates: ['June 18', 'June 25', 'July 9', 'July 16', 'July 23', 'July 30', 'August 6', 'August 13'], timePrefix: 'Summer Thursdays' }
];

const clinicTypes = [
  { name: 'Hitting', times: { 'May Saturdays': '9:00–10:30am', 'Summer Thursdays': '8:00–9:30am' } },
  { name: 'Serving', times: { 'May Saturdays': '10:30am–12:00pm', 'Summer Thursdays': '9:30–11:00am' } },
  { name: 'Serve Receive/Defense', times: { 'May Saturdays': '12:00–1:30pm', 'Summer Thursdays': '11:00am–12:30pm' } }
];

const girlsClubPrepClinics = [
  { id: 'clinic-girls-club-prep-sep-13', dateInfo: 'September 13, 2026', startDate: '2026-09-13' },
  { id: 'clinic-girls-club-prep-sep-20', dateInfo: 'September 20, 2026', startDate: '2026-09-20' },
  { id: 'clinic-girls-club-prep-sep-27', dateInfo: 'September 27, 2026', startDate: '2026-09-27' },
  { id: 'clinic-girls-club-prep-oct-04', dateInfo: 'October 4, 2026', startDate: '2026-10-04' },
  { id: 'clinic-girls-club-prep-oct-11', dateInfo: 'October 11, 2026', startDate: '2026-10-11' },
  { id: 'clinic-girls-club-prep-oct-18', dateInfo: 'October 18, 2026', startDate: '2026-10-18' },
];

async function seed() {
  console.log('Seeding camps...');
  for (const camp of camps) {
    await db.insert(events).values(camp).onConflictDoUpdate({
      target: events.id,
      set: camp
    });
  }

  console.log('Seeding clinics...');
  for (const girlsClinic of girlsClubPrepClinics) {
    const clinic = {
      id: girlsClinic.id,
      parentId: 'girls-club-prep-fall-2026',
      type: 'clinic',
      name: 'Girls Club Prep Clinic',
      description: '90-minute general volleyball clinic for girls in 6th-8th grade preparing for club volleyball.',
      dateInfo: girlsClinic.dateInfo,
      timeInfo: '3:00-5:00pm',
      startDate: girlsClinic.startDate,
      endDate: girlsClinic.startDate,
      price: 3000,
      capacity: 14,
      waitlistEnabled: true,
      active: true,
      emailDetails: `Girls Club Prep Clinic is ${girlsClinic.dateInfo}, 3:00-5:00pm, at TVVC. Clinics are 90 minutes and capped at 14 players.`,
      metadata: JSON.stringify({
        registrationStream: 'camps-clinics',
        program: 'girls-club-prep',
        session: 'fall-2026',
        audience: 'Girls in 6th-8th grade',
        trainingFormat: '90-minute general volleyball clinic with individual skill development in representative game-like situations when numbers allow.',
      }),
    };

    await db.insert(events).values(clinic).onConflictDoUpdate({
      target: events.id,
      set: clinic
    });
  }

  for (const group of clinicDates) {
    for (const date of group.dates) {
      for (const type of clinicTypes) {
        const id = `clinic-${type.name.toLowerCase().replace(/[\/\s]+/g, '-')}-${date.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Parse "May 16" to "2026-05-16"
        const [monthName, day] = date.split(' ');
        const monthMap: { [key: string]: string } = {
          'May': '05', 'June': '06', 'July': '07', 'August': '08'
        };
        const month = monthMap[monthName];
        const formattedDay = day.padStart(2, '0');
        const startDate = `2026-${month}-${formattedDay}`;

        const clinic = {
          id,
          parentId: `clinic-${type.name.toLowerCase().replace(/[\/\s]+/g, '-')}`,
          type: 'clinic',
          name: `${type.name} Clinic`,
          dateInfo: date,
          timeInfo: type.times[group.timePrefix as keyof typeof type.times],
          startDate,
          price: 3000,
          capacity: 12,
          active: false,
        };
        await db.insert(events).values(clinic).onConflictDoUpdate({
          target: events.id,
          set: clinic
        });
      }
    }
  }

  console.log('Seed completed successfully!');
}

seed().catch(console.error);
