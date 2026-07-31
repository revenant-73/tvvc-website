import { test, expect } from '@playwright/test';
import { createClient } from '@libsql/client';
const fixtures = require('./portal-fixtures');

test('cleanup releases an expired reservation only once', async ({ request }) => {
  const client = createClient({ url: fixtures.databaseUrl });
  const headers = process.env.CRON_SECRET
    ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
    : {};

  try {
    const cleanup = await request.post('/api/admin/cleanup-expired', {
      headers,
      data: {},
    });
    expect(cleanup.status()).toBe(200);
    const cleanupBody = await cleanup.json();
    expect(cleanupBody.registrationsProcessed).toBe(1);
    expect(cleanupBody.spotsReleased).toBe(1);

    let registration = await client.execute({
      sql: 'SELECT status FROM registrations WHERE id = ?',
      args: [fixtures.expirationCleanup.registrationId],
    });
    let event = await client.execute({
      sql: 'SELECT spots_filled, pending_spots FROM events WHERE id = ?',
      args: [fixtures.expirationCleanup.eventId],
    });

    expect(registration.rows[0].status).toBe('expired');
    expect(Number(event.rows[0].spots_filled)).toBe(0);
    expect(Number(event.rows[0].pending_spots)).toBe(0);

    const replay = await request.post('/api/admin/cleanup-expired', {
      headers,
      data: {},
    });
    expect(replay.status()).toBe(200);

    registration = await client.execute({
      sql: 'SELECT status FROM registrations WHERE id = ?',
      args: [fixtures.expirationCleanup.registrationId],
    });
    event = await client.execute({
      sql: 'SELECT pending_spots FROM events WHERE id = ?',
      args: [fixtures.expirationCleanup.eventId],
    });
    expect(registration.rows[0].status).toBe('expired');
    expect(Number(event.rows[0].pending_spots)).toBe(0);
  } finally {
    client.close();
  }
});
