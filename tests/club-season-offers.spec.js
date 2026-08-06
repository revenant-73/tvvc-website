import { test, expect } from '@playwright/test';
import { createClient } from '@libsql/client';
const fixtures = require('./portal-fixtures');

const appUrl = process.env.BASE_URL
  || `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || '4321'}`;

async function contextWithSession(browser, sessionToken) {
  const context = await browser.newContext();
  await context.addCookies([{
    name: 'authjs.session-token',
    value: sessionToken,
    url: appUrl,
  }]);
  return context;
}

test.describe.serial('Club season offer authorization', () => {
  test('admin candidate list is protected and flags ownership collisions', async ({ browser, request }) => {
    const anonymous = await request.get(
      `/api/admin/club-season-offers?seasonId=${fixtures.clubSeason.id}`
    );
    expect(anonymous.status()).toBe(401);

    const parentContext = await contextWithSession(browser, fixtures.parentA.sessionToken);
    const adminContext = await contextWithSession(browser, fixtures.admin.sessionToken);
    try {
      const forbidden = await parentContext.request.get(
        `/api/admin/club-season-offers?seasonId=${fixtures.clubSeason.id}`
      );
      expect(forbidden.status()).toBe(403);

      const response = await adminContext.request.get(
        `/api/admin/club-season-offers?seasonId=${fixtures.clubSeason.id}`
      );
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.teams).toContainEqual(expect.objectContaining({
        id: fixtures.clubSeason.teamId,
        name: fixtures.clubSeason.teamName,
      }));
      expect(body.candidates).toContainEqual(expect.objectContaining({
        athleteId: fixtures.parentA.athleteId,
        eligible: true,
      }));
      expect(body.candidates).toContainEqual(expect.objectContaining({
        athleteId: fixtures.emailCollision.athleteId,
        eligible: false,
        issue: expect.stringMatching(/ownership/i),
      }));
    } finally {
      await parentContext.close();
      await adminContext.close();
    }
  });

  test('bulk creation is idempotent and rejects a conflicting registration email', async ({ browser }) => {
    const adminContext = await contextWithSession(browser, fixtures.admin.sessionToken);
    try {
      const payload = {
        seasonId: fixtures.clubSeason.id,
        teamId: fixtures.clubSeason.teamId,
        athleteIds: [fixtures.parentA.athleteId, fixtures.emailCollision.athleteId],
        acceptanceDeadline: '2099-11-30',
      };
      const created = await adminContext.request.post('/api/admin/club-season-offers', {
        data: payload,
      });
      expect(created.status()).toBe(207);
      await expect(created.json()).resolves.toMatchObject({ results: [
        { athleteId: fixtures.parentA.athleteId, status: 'created' },
        { athleteId: fixtures.emailCollision.athleteId, status: 'invalid' },
      ] });

      const retried = await adminContext.request.post('/api/admin/club-season-offers', {
        data: payload,
      });
      await expect(retried.json()).resolves.toMatchObject({ results: [
        { athleteId: fixtures.parentA.athleteId, status: 'already_offered' },
        { athleteId: fixtures.emailCollision.athleteId, status: 'invalid' },
      ] });
    } finally {
      await adminContext.close();
    }
  });

  test('only the verified tryout owner can start a registration draft', async ({ browser }) => {
    const parentA = await contextWithSession(browser, fixtures.parentA.sessionToken);
    const parentB = await contextWithSession(browser, fixtures.parentB.sessionToken);
    try {
      const client = createClient({ url: fixtures.databaseUrl });
      const offerResult = await client.execute({
        sql: `SELECT id FROM club_season_offers
              WHERE season_id = ? AND source_athlete_id = ?`,
        args: [fixtures.clubSeason.id, fixtures.parentA.athleteId],
      });
      const offerId = offerResult.rows[0].id;
      client.close();

      const wrongParent = await parentB.request.post('/api/club-season/respond', {
        data: { offerId, action: 'start' },
      });
      expect(wrongParent.status()).toBe(404);

      const crossOrigin = await parentA.request.post('/api/club-season/respond', {
        headers: { Origin: 'https://attacker.example' },
        data: { offerId, action: 'start' },
      });
      expect(crossOrigin.status()).toBe(403);

      const started = await parentA.request.post('/api/club-season/respond', {
        data: { offerId, action: 'start' },
      });
      expect(started.ok()).toBeTruthy();
      await expect(started.json()).resolves.toMatchObject({
        status: 'registration_started',
        draft: { status: 'draft', currentStep: 1 },
      });

      const retried = await parentA.request.post('/api/club-season/respond', {
        data: { offerId, action: 'start' },
      });
      expect(retried.ok()).toBeTruthy();

      const verificationClient = createClient({ url: fixtures.databaseUrl });
      const drafts = await verificationClient.execute({
        sql: 'SELECT count(*) AS count FROM club_season_registrations WHERE offer_id = ?',
        args: [offerId],
      });
      verificationClient.close();
      expect(Number(drafts.rows[0].count)).toBe(1);
    } finally {
      await parentA.close();
      await parentB.close();
    }
  });

  test('shared parent page stays generic until sign-in and isolates family offers', async ({ browser, page }) => {
    await page.goto('/season-registration');
    await expect(page.getByRole('heading', { name: /open your invitation/i })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    await expect(page.locator('body')).not.toContainText(fixtures.parentA.athleteName);

    const parentA = await contextWithSession(browser, fixtures.parentA.sessionToken);
    const parentB = await contextWithSession(browser, fixtures.parentB.sessionToken);
    try {
      const parentAPage = await parentA.newPage();
      await parentAPage.goto('/season-registration');
      await expect(parentAPage.getByText(fixtures.clubSeason.teamName, { exact: true }).first()).toBeVisible();
      await expect(parentAPage.getByText(/registration is underway/i)).toBeVisible();

      const parentBPage = await parentB.newPage();
      await parentBPage.goto('/season-registration');
      await expect(parentBPage.getByRole('heading', { name: /no active offer found/i })).toBeVisible();
      await expect(parentBPage.locator('body')).not.toContainText(fixtures.parentA.athleteName);
    } finally {
      await parentA.close();
      await parentB.close();
    }
  });
});
