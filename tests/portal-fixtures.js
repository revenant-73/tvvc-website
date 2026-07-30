const path = require('node:path');

const databasePath = path.join(__dirname, '..', 'test-results', 'portal-e2e.db');

module.exports = {
  databasePath,
  databaseUrl: `file:${databasePath.replaceAll('\\', '/')}`,
  parentA: {
    id: 'parent-a',
    email: 'parent-a@tvvc.test',
    sessionToken: 'portal-e2e-parent-a-session',
    secondSessionToken: 'portal-e2e-parent-a-second-session',
    registrationId: 'order-a-2026',
    athleteId: 101,
    athleteName: 'Avery Alpha',
    eventName: 'Parent A Future Clinic',
  },
  duplicateProfile: {
    id: 102,
    snapshotId: 104,
    name: 'Avery Duplicate',
  },
  scheduleHistory: {
    historicalRegistrationId: 'history-a-2020',
    historicalAthleteId: 105,
    historicalSnapshotEventName: 'Original Spring Clinic',
    historicalCurrentEventName: 'Current Premium Clinic',
    ongoingEventName: 'Ongoing Multi-Day Camp',
    inactiveEventName: 'Inactive Future Clinic',
    cancelledRegistrationId: 'cancel-a-2099',
    cancelledAthleteId: 106,
    cancelledEventName: 'Cancelled Registration Event',
  },
  guardian: {
    id: 'guardian-a',
    email: 'guardian-a@tvvc.test',
    sessionToken: 'portal-e2e-guardian-a-session',
  },
  parentB: {
    id: 'parent-b',
    email: 'parent-b@tvvc.test',
    sessionToken: 'portal-e2e-parent-b-session',
    registrationId: 'order-b-2026',
    athleteId: 202,
    athleteName: 'Bailey Beta',
    eventName: 'Parent B Future Camp',
  },
  legacyParent: {
    id: 'parent-legacy',
    email: 'legacy-parent@tvvc.test',
    sessionToken: 'portal-e2e-legacy-parent-session',
    registrationId: 'order-legacy-2026',
    athleteId: 303,
    athleteName: 'Legacy Player',
    eventName: 'Legacy Parent Clinic',
    stripeCustomerId: 'cus_legacy_parent',
  },
  emailCollision: {
    registrationId: 'order-email-collision',
    athleteId: 204,
    athleteName: 'Casey Collision',
    eventName: 'Email Collision Event',
  },
};
