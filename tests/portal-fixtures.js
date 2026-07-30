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
  parentB: {
    id: 'parent-b',
    email: 'parent-b@tvvc.test',
    sessionToken: 'portal-e2e-parent-b-session',
    registrationId: 'order-b-2026',
    athleteId: 202,
    athleteName: 'Bailey Beta',
    eventName: 'Parent B Future Camp',
  },
};
