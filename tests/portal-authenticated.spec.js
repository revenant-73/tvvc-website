const { test, expect } = require('@playwright/test');
const { createClient } = require('@libsql/client');
const fixtures = require('./portal-fixtures');

async function authenticate(context, parent) {
  await context.addCookies([{
    name: 'authjs.session-token',
    value: parent.sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
}

test.describe.serial('Authenticated Parent Portal isolation', () => {
  test('claims verified legacy purchases into canonical account relationships', async ({ context, page }) => {
    await authenticate(context, fixtures.legacyParent);
    await page.goto('/portal/dashboard');

    await expect(page.getByText(fixtures.legacyParent.athleteName, { exact: true })).toBeVisible();
    await expect(page.getByText(fixtures.legacyParent.eventName, { exact: true })).toBeVisible();

    const client = createClient({ url: fixtures.databaseUrl });
    const registration = await client.execute({
      sql: 'SELECT user_id FROM registrations WHERE id = ?',
      args: [fixtures.legacyParent.registrationId],
    });
    const athlete = await client.execute({
      sql: 'SELECT parent_id, profile_id FROM athletes WHERE id = ?',
      args: [fixtures.legacyParent.athleteId],
    });
    const profile = await client.execute({
      sql: 'SELECT parent_id FROM player_profiles WHERE id = ?',
      args: [athlete.rows[0].profile_id],
    });
    const user = await client.execute({
      sql: 'SELECT stripe_customer_id FROM user WHERE id = ?',
      args: [fixtures.legacyParent.id],
    });
    client.close();

    expect(registration.rows[0].user_id).toBe(fixtures.legacyParent.id);
    expect(athlete.rows[0].parent_id).toBe(fixtures.legacyParent.id);
    expect(profile.rows[0].parent_id).toBe(fixtures.legacyParent.id);
    expect(user.rows[0].stripe_customer_id).toBe(fixtures.legacyParent.stripeCustomerId);
  });

  test('shows only the signed-in parent’s purchases, players, and schedule', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);
    await page.goto('/portal/dashboard');

    await expect(page).toHaveURL(/\/portal\/dashboard$/);
    await expect(page.getByText(fixtures.parentA.athleteName, { exact: true })).toBeVisible();
    await expect(page.getByText(fixtures.parentA.eventName, { exact: true })).toBeVisible();
    await expect(page.getByText(fixtures.parentB.athleteName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(fixtures.parentB.eventName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(fixtures.emailCollision.athleteName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(fixtures.emailCollision.eventName, { exact: true })).toHaveCount(0);
  });

  test('blocks another parent’s resources even when the stored email matches', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);

    await page.goto(`/portal/orders/${fixtures.emailCollision.registrationId}`);
    await expect(page).toHaveURL(/\/portal\/dashboard$/);
    await expect(page.getByText(fixtures.emailCollision.athleteName, { exact: true })).toHaveCount(0);

    await page.goto(`/portal/athletes/${fixtures.emailCollision.athleteId}`);
    await expect(page).toHaveURL(/\/portal\/dashboard$/);

    const receiptResponse = await page.request.get(
      `/api/stripe/receipt?registrationId=${fixtures.emailCollision.registrationId}`,
      { maxRedirects: 0 }
    );
    expect(receiptResponse.status()).toBe(404);
  });

  test('merges duplicate profiles while preserving and relinking purchase snapshots', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);
    await page.goto('/portal/players');

    await expect(page.getByRole('heading', { name: fixtures.duplicateProfile.name })).toBeVisible();

    const duplicateCard = page.locator('article').filter({
      has: page.getByRole('heading', { name: fixtures.duplicateProfile.name }),
    });
    await duplicateCard.getByRole('combobox').selectOption(String(fixtures.parentA.athleteId));
    page.once('dialog', (dialog) => dialog.accept());
    await duplicateCard.getByRole('button', { name: 'Merge Duplicate' }).click();

    await expect(page.getByText(`Merged into ${fixtures.parentA.athleteName}`, { exact: true }))
      .toBeVisible();

    const client = createClient({ url: fixtures.databaseUrl });
    const duplicate = await client.execute({
      sql: 'SELECT archived_at, merged_into_profile_id FROM player_profiles WHERE id = ?',
      args: [fixtures.duplicateProfile.id],
    });
    const historicalSnapshot = await client.execute({
      sql: 'SELECT profile_id, first_name, last_name, medical_info FROM athletes WHERE id = ?',
      args: [fixtures.duplicateProfile.snapshotId],
    });
    client.close();

    expect(duplicate.rows[0].archived_at).toBeTruthy();
    expect(Number(duplicate.rows[0].merged_into_profile_id)).toBe(fixtures.parentA.athleteId);
    expect(historicalSnapshot.rows[0]).toEqual({
      profile_id: fixtures.parentA.athleteId,
      first_name: 'Avery',
      last_name: 'Duplicate',
      medical_info: 'Historical duplicate snapshot',
    });

    const restoreResponse = await page.request.post('/api/portal/manage-athlete', {
      data: { action: 'restore', profileId: fixtures.duplicateProfile.id },
    });
    expect(restoreResponse.status()).toBe(404);

    const crossParentResponse = await page.request.post('/api/portal/manage-athlete', {
      data: {
        action: 'merge',
        sourceProfileId: fixtures.parentA.athleteId,
        targetProfileId: fixtures.parentB.athleteId,
      },
    });
    expect(crossParentResponse.status()).toBe(404);
  });

  test('opens only the signed-in parent’s Stripe receipt and billing portal', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);
    await page.goto(`/portal/orders/${fixtures.parentA.registrationId}`);

    await Promise.all([
      page.waitForURL(/127\.0\.0\.1:4322\/mock-receipt\//),
      page.getByRole('button', { name: 'Receipt' }).click(),
    ]);

    await page.goto('/portal/dashboard');
    await Promise.all([
      page.waitForURL('http://127.0.0.1:4322/mock-billing'),
      page.getByRole('button', { name: 'Manage via Stripe' }).click(),
    ]);
  });

  test('allows the parent to update only their own player profile', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);
    await page.goto(`/portal/athletes/${fixtures.parentA.athleteId}`);

    await page.getByLabel('Grade (Fall 2026)').selectOption('9th');
    await page.getByRole('button', { name: 'Update Profile' }).click();

    await expect(page).toHaveURL(/\/portal\/dashboard$/);

    const client = createClient({ url: fixtures.databaseUrl });
    const ownProfile = await client.execute({
      sql: 'SELECT grade FROM player_profiles WHERE id = ?',
      args: [fixtures.parentA.athleteId],
    });
    const otherProfile = await client.execute({
      sql: 'SELECT grade FROM player_profiles WHERE id = ?',
      args: [fixtures.parentB.athleteId],
    });
    const historicalSnapshot = await client.execute({
      sql: 'SELECT grade FROM athletes WHERE id = ?',
      args: [fixtures.parentA.athleteId],
    });
    client.close();

    expect(ownProfile.rows[0].grade).toBe('9th');
    expect(otherProfile.rows[0].grade).toBe('7th');
    expect(historicalSnapshot.rows[0].grade).toBe('8th');
  });

  test('reuses a saved player instead of creating a duplicate during registration', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);
    await page.goto('/portal/dashboard');

    const result = await page.evaluate(async (payload) => {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    }, {
      parentInfo: {
        name: 'Parent Alpha',
        email: fixtures.parentA.email,
        phone: '503-555-0101',
        emergencyPhone: '503-555-0101',
      },
      athletes: [{
        profileId: fixtures.parentA.athleteId,
        firstName: 'Avery',
        lastName: 'Alpha',
        grade: '9th',
        medicalInfo: 'None',
        selectedEvents: ['event-parent-a'],
        waiverAgreed: true,
        photoReleaseAgreed: false,
      }],
    });

    expect(result.status).toBe(200);
    expect(result.body.url).toMatch(/127\.0\.0\.1:4322\/mock-checkout\//);

    const client = createClient({ url: fixtures.databaseUrl });
    const athleteCount = await client.execute({
      sql: `SELECT COUNT(*) AS count FROM player_profiles
            WHERE parent_id = ? AND archived_at IS NULL AND merged_into_profile_id IS NULL`,
      args: [fixtures.parentA.id],
    });
    const reusedItems = await client.execute({
      sql: `SELECT ri.athlete_id, a.profile_id, a.grade
            FROM registration_items ri
            INNER JOIN registrations r ON r.id = ri.registration_id
            INNER JOIN athletes a ON a.id = ri.athlete_id
            WHERE r.user_id = ? AND r.id != ?`,
      args: [fixtures.parentA.id, fixtures.parentA.registrationId],
    });
    client.close();

    expect(Number(athleteCount.rows[0].count)).toBe(1);
    expect(Number(reusedItems.rows[0].athlete_id)).not.toBe(fixtures.parentA.athleteId);
    expect(Number(reusedItems.rows[0].profile_id)).toBe(fixtures.parentA.athleteId);
    expect(reusedItems.rows[0].grade).toBe('9th');
  });

  test('creates portal-only player profiles without fabricating purchase snapshots', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);
    await page.goto('/portal/dashboard');

    const response = await page.evaluate(async () => {
      const result = await fetch('/api/portal/add-athlete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Portal',
          lastName: 'Only',
          grade: '5th',
          tshirtSize: 'Youth M',
          medicalInfo: 'None',
        }),
      });
      return result.status;
    });

    expect(response).toBe(200);

    const client = createClient({ url: fixtures.databaseUrl });
    const profiles = await client.execute({
      sql: `SELECT COUNT(*) AS count
            FROM player_profiles
            WHERE parent_id = ? AND first_name = 'Portal' AND last_name = 'Only'`,
      args: [fixtures.parentA.id],
    });
    const snapshots = await client.execute({
      sql: `SELECT COUNT(*) AS count
            FROM athletes
            WHERE parent_id = ? AND first_name = 'Portal' AND last_name = 'Only'`,
      args: [fixtures.parentA.id],
    });
    client.close();

    expect(Number(profiles.rows[0].count)).toBe(1);
    expect(Number(snapshots.rows[0].count)).toBe(0);
  });

  test('archives and restores a player without changing historical data', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);
    await page.goto('/portal/players');

    const client = createClient({ url: fixtures.databaseUrl });
    const portalOnly = await client.execute({
      sql: `SELECT id FROM player_profiles
            WHERE parent_id = ? AND first_name = 'Portal' AND last_name = 'Only'`,
      args: [fixtures.parentA.id],
    });
    const profileId = Number(portalOnly.rows[0].id);

    const archiveResponse = await page.request.post('/api/portal/manage-athlete', {
      data: { action: 'archive', profileId },
    });
    expect(archiveResponse.status()).toBe(200);

    await page.goto('/portal/dashboard');
    await expect(page.getByText('Portal Only', { exact: true })).toHaveCount(0);

    const archived = await client.execute({
      sql: 'SELECT archived_at, merged_into_profile_id FROM player_profiles WHERE id = ?',
      args: [profileId],
    });
    expect(archived.rows[0].archived_at).toBeTruthy();
    expect(archived.rows[0].merged_into_profile_id).toBeNull();

    const restoreResponse = await page.request.post('/api/portal/manage-athlete', {
      data: { action: 'restore', profileId },
    });
    expect(restoreResponse.status()).toBe(200);

    await page.goto('/portal/dashboard');
    await expect(page.getByText('Portal Only', { exact: true })).toBeVisible();

    const restored = await client.execute({
      sql: 'SELECT archived_at, merged_into_profile_id FROM player_profiles WHERE id = ?',
      args: [profileId],
    });
    client.close();

    expect(restored.rows[0].archived_at).toBeNull();
    expect(restored.rows[0].merged_into_profile_id).toBeNull();
  });

  test('sign out everywhere deletes every session for the parent', async ({ context, page }) => {
    await authenticate(context, fixtures.parentA);
    await page.goto('/portal/settings');
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page).toHaveURL(/\/portal\/login$/);

    const client = createClient({ url: fixtures.databaseUrl });
    const result = await client.execute({
      sql: 'SELECT COUNT(*) AS count FROM session WHERE userId = ?',
      args: [fixtures.parentA.id],
    });
    const otherParentResult = await client.execute({
      sql: 'SELECT COUNT(*) AS count FROM session WHERE userId = ?',
      args: [fixtures.parentB.id],
    });
    client.close();

    expect(Number(result.rows[0].count)).toBe(0);
    expect(Number(otherParentResult.rows[0].count)).toBe(1);
  });
});
