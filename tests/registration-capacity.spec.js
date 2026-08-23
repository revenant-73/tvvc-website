import { test, expect } from '@playwright/test';
import { createClient } from '@libsql/client';
const fixtures = require('./portal-fixtures');

test.describe.configure({ mode: 'serial' });

function registrationPayload(suffix) {
  return {
    parentInfo: {
      name: `Capacity Parent ${suffix}`,
      email: `capacity-${suffix}@tvvc.test`,
      phone: '503-555-0150',
      emergencyPhone: '503-555-0151',
    },
    athletes: [{
      firstName: 'Capacity',
      lastName: `Player ${suffix}`,
      grade: '8th',
      medicalInfo: 'None',
      photoReleaseAgreed: false,
      waiverAgreed: true,
      selectedEvents: [fixtures.capacity.eventId],
    }],
  };
}

test('allows only one concurrent checkout to reserve the final spot', async ({ request }) => {
  const client = createClient({ url: fixtures.databaseUrl });

  try {
    const responses = await Promise.all([
      request.post('/api/register', { data: registrationPayload('alpha') }),
      request.post('/api/register', { data: registrationPayload('beta') }),
    ]);
    const statuses = responses.map((response) => response.status()).sort();

    expect(statuses).toEqual([200, 409]);

    const event = await client.execute({
      sql: 'SELECT spots_filled, pending_spots FROM events WHERE id = ?',
      args: [fixtures.capacity.eventId],
    });
    const registrations = await client.execute({
      sql: `SELECT COUNT(*) AS count
            FROM registrations
            WHERE parent_email IN (?, ?) AND status = 'pending'`,
      args: ['capacity-alpha@tvvc.test', 'capacity-beta@tvvc.test'],
    });
    const [winningRegistration] = (await client.execute({
      sql: `SELECT stripe_session_id, expires_at
            FROM registrations
            WHERE parent_email IN (?, ?) AND status = 'pending'`,
      args: ['capacity-alpha@tvvc.test', 'capacity-beta@tvvc.test'],
    })).rows;
    const items = await client.execute({
      sql: 'SELECT COUNT(*) AS count FROM registration_items WHERE event_id = ?',
      args: [fixtures.capacity.eventId],
    });

    expect(Number(event.rows[0].spots_filled)).toBe(0);
    expect(Number(event.rows[0].pending_spots)).toBe(1);
    expect(Number(registrations.rows[0].count)).toBe(1);
    expect(Number(items.rows[0].count)).toBe(1);

    const mockSessionResponse = await request.get(
      `http://127.0.0.1:4322/test/checkout-sessions/${winningRegistration.stripe_session_id}`
    );
    const mockSession = await mockSessionResponse.json();

    expect(mockSessionResponse.status()).toBe(200);
    expect(Math.floor(Number(winningRegistration.expires_at) / 1000)).toBe(mockSession.expires_at);
  } finally {
    client.close();
  }
});

test('rejects a single checkout that requests more spots than remain', async ({ request }) => {
  const client = createClient({ url: fixtures.databaseUrl });

  try {
    await client.execute({
      sql: 'UPDATE events SET pending_spots = 0 WHERE id = ?',
      args: [fixtures.capacity.eventId],
    });

    const payload = registrationPayload('oversized');
    payload.athletes.push({
      ...payload.athletes[0],
      firstName: 'Second',
      lastName: 'Capacity Player',
    });

    const response = await request.post('/api/register', { data: payload });
    const responseBody = await response.json();

    expect(response.status()).toBe(409);
    expect(responseBody.error).toContain('enough available spots');

    const event = await client.execute({
      sql: 'SELECT pending_spots FROM events WHERE id = ?',
      args: [fixtures.capacity.eventId],
    });
    expect(Number(event.rows[0].pending_spots)).toBe(0);
  } finally {
    client.close();
  }
});

test('saves a waitlist entry when a full event has waitlist enabled', async ({ request }) => {
  const client = createClient({ url: fixtures.databaseUrl });

  try {
    await client.execute({
      sql: `UPDATE events
            SET spots_filled = capacity,
                pending_spots = 0,
                waitlist_enabled = 1
            WHERE id = ?`,
      args: [fixtures.capacity.eventId],
    });

    const payload = registrationPayload('waitlist-enabled');
    const response = await request.post('/api/event-waitlist', { data: payload });
    const responseBody = await response.json();

    expect(response.status()).toBe(200);
    expect(responseBody.success).toBe(true);
    expect(responseBody.entries).toEqual([
      expect.objectContaining({
        eventId: fixtures.capacity.eventId,
        status: 'waitlisted',
      }),
    ]);

    const waitlist = await client.execute({
      sql: `SELECT COUNT(*) AS count
            FROM event_waitlist_entries
            WHERE event_id = ?
              AND parent_email = ?
              AND status = 'waitlisted'`,
      args: [fixtures.capacity.eventId, 'capacity-waitlist-enabled@tvvc.test'],
    });

    expect(Number(waitlist.rows[0].count)).toBe(1);
  } finally {
    client.close();
  }
});

test('rejects a waitlist entry when waitlist is disabled', async ({ request }) => {
  const client = createClient({ url: fixtures.databaseUrl });

  try {
    await client.execute({
      sql: `UPDATE events
            SET spots_filled = capacity,
                pending_spots = 0,
                waitlist_enabled = 0
            WHERE id = ?`,
      args: [fixtures.capacity.eventId],
    });

    const response = await request.post('/api/event-waitlist', {
      data: registrationPayload('waitlist-disabled'),
    });
    const responseBody = await response.json();

    expect(response.status()).toBe(409);
    expect(responseBody.error).toContain('not currently accepting waitlist entries');
  } finally {
    client.close();
  }
});
