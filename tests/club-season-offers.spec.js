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

function completedDraft(city = 'Hillsboro') {
  return {
    schemaVersion: 1,
    family: {
      addressLine1: '123 Volleyball Way',
      addressLine2: '',
      city,
      state: 'OR',
      postalCode: '97123',
      emergencyContactName: 'Parent Alpha',
      emergencyContactRelationship: 'Parent',
      emergencyContactPhone: '503-555-0101',
      communicationPreference: 'both',
      informationConfirmed: true,
    },
    player: {
      preferredName: 'Avery',
      jerseySize: 'AM',
      apparelSize: 'AM',
      jerseyNumberPreferences: [7, 12, 21],
      medicalInfo: 'None',
      medicalInformationConfirmed: true,
      cevaMembershipStatus: 'complete',
      cevaMembershipNumber: 'CEVA-12345',
      medicalReleaseStatus: 'complete',
      seasonConflicts: '',
    },
  };
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

  test('simultaneous start and decline leave one consistent offer state', async ({ browser }) => {
    const adminContext = await contextWithSession(browser, fixtures.admin.sessionToken);
    const parentB = await contextWithSession(browser, fixtures.parentB.sessionToken);
    const client = createClient({ url: fixtures.databaseUrl });
    try {
      const created = await adminContext.request.post('/api/admin/club-season-offers', {
        data: {
          seasonId: fixtures.clubSeason.id,
          teamId: fixtures.clubSeason.teamId,
          athleteIds: [fixtures.parentB.athleteId],
          acceptanceDeadline: '2099-11-30',
        },
      });
      const createdBody = await created.json();
      const offerId = createdBody.results[0].offerId;

      const [start, decline] = await Promise.all([
        parentB.request.post('/api/club-season/respond', { data: { offerId, action: 'start' } }),
        parentB.request.post('/api/club-season/respond', { data: { offerId, action: 'decline' } }),
      ]);
      expect([start.status(), decline.status()].sort()).toEqual([200, 409]);

      const state = await client.execute({
        sql: `SELECT cso.status, count(csr.id) AS draft_count
              FROM club_season_offers cso
              LEFT JOIN club_season_registrations csr ON csr.offer_id = cso.id
              WHERE cso.id = ? GROUP BY cso.id`,
        args: [offerId],
      });
      const row = state.rows[0];
      expect(['declined', 'registration_started']).toContain(row.status);
      expect(Number(row.draft_count)).toBe(row.status === 'registration_started' ? 1 : 0);

      await client.execute({ sql: 'DELETE FROM club_season_registrations WHERE offer_id = ?', args: [offerId] });
      await client.execute({ sql: 'DELETE FROM club_season_offers WHERE id = ?', args: [offerId] });
    } finally {
      client.close();
      await adminContext.close();
      await parentB.close();
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

  test('draft autosave uses optimistic locking and agreement evidence is immutable', async ({ browser }) => {
    const parentA = await contextWithSession(browser, fixtures.parentA.sessionToken);
    const parentB = await contextWithSession(browser, fixtures.parentB.sessionToken);
    try {
      const client = createClient({ url: fixtures.databaseUrl });
      const registrationResult = await client.execute({
        sql: `SELECT csr.id, csr.offer_id, csr.version, csr.draft_data
              FROM club_season_registrations csr
              JOIN club_season_offers cso ON cso.id = csr.offer_id
              WHERE cso.source_athlete_id = ?`,
        args: [fixtures.parentA.athleteId],
      });
      const registration = registrationResult.rows[0];
      expect(registration.version).toBe(1);
      expect(JSON.parse(registration.draft_data).schemaVersion).toBe(1);

      const wrongParent = await parentB.request.patch('/api/club-season/draft', {
        data: { offerId: registration.offer_id, version: 1, currentStep: 1, data: completedDraft() },
      });
      expect(wrongParent.status()).toBe(404);

      const crossOrigin = await parentA.request.patch('/api/club-season/draft', {
        headers: { Origin: 'https://attacker.example' },
        data: { offerId: registration.offer_id, version: 1, currentStep: 1, data: completedDraft() },
      });
      expect(crossOrigin.status()).toBe(403);

      const malicious = await parentA.request.patch('/api/club-season/draft', {
        data: {
          offerId: registration.offer_id,
          version: 1,
          currentStep: 1,
          data: { ...completedDraft(), teamId: 'attacker-controlled-team' },
        },
      });
      expect(malicious.status()).toBe(400);

      const saved = await parentA.request.patch('/api/club-season/draft', {
        data: { offerId: registration.offer_id, version: 1, currentStep: 2, data: completedDraft() },
      });
      expect(saved.ok()).toBeTruthy();
      await expect(saved.json()).resolves.toMatchObject({ draft: { version: 2, currentStep: 2 } });

      const concurrentPayloads = ['Beaverton', 'Hillsboro'].map((city) => parentA.request.patch(
        '/api/club-season/draft',
        { data: { offerId: registration.offer_id, version: 2, currentStep: 3, data: completedDraft(city) } }
      ));
      const concurrentResults = await Promise.all(concurrentPayloads);
      expect(concurrentResults.map((response) => response.status()).sort()).toEqual([200, 409]);

      const currentResult = await client.execute({
        sql: 'SELECT version, draft_data FROM club_season_registrations WHERE id = ?',
        args: [registration.id],
      });
      expect(currentResult.rows[0].version).toBe(3);
      expect(['Beaverton', 'Hillsboro']).toContain(JSON.parse(currentResult.rows[0].draft_data).family.city);

      const incompleteAgreements = await parentA.request.post('/api/club-season/agreements', {
        data: {
          offerId: registration.offer_id,
          version: 3,
          acceptedName: 'Parent Alpha',
          responses: [{ agreementVersionId: 'not-a-real-version', response: 'accepted' }],
        },
      });
      expect(incompleteAgreements.status()).toBe(422);

      const agreementPayload = {
        offerId: registration.offer_id,
        version: 3,
        acceptedName: 'Parent Alpha',
        responses: [
          { agreementVersionId: fixtures.clubSeason.agreementIds.commitment, response: 'accepted' },
          { agreementVersionId: fixtures.clubSeason.agreementIds.refund, response: 'accepted' },
          { agreementVersionId: fixtures.clubSeason.agreementIds.media, response: 'declined' },
        ],
      };
      const accepted = await parentA.request.post('/api/club-season/agreements', {
        data: agreementPayload,
      });
      expect(accepted.ok()).toBeTruthy();
      await expect(accepted.json()).resolves.toMatchObject({
        status: 'awaiting_payment',
        draft: { status: 'awaiting_payment', currentStep: 4, version: 4 },
      });

      const retried = await parentA.request.post('/api/club-season/agreements', {
        data: agreementPayload,
      });
      expect(retried.ok()).toBeTruthy();
      await expect(retried.json()).resolves.toMatchObject({ status: 'awaiting_payment', version: 4 });

      const evidence = await client.execute({
        sql: `SELECT accepted_name, accepted_email, agreement_body_snapshot,
                     agreement_content_hash, response, context_snapshot
              FROM club_season_agreement_acceptances
              WHERE registration_id = ? ORDER BY agreement_key_snapshot`,
        args: [registration.id],
      });
      expect(evidence.rows).toHaveLength(3);
      expect(evidence.rows.every((row) => row.accepted_name === 'Parent Alpha')).toBeTruthy();
      expect(evidence.rows.every((row) => row.accepted_email === fixtures.parentA.email)).toBeTruthy();
      expect(evidence.rows.every((row) => row.agreement_body_snapshot && row.agreement_content_hash)).toBeTruthy();
      expect(evidence.rows.map((row) => row.response)).toContain('declined');
      expect(JSON.parse(evidence.rows[0].context_snapshot).team.id).toBe(fixtures.clubSeason.teamId);

      const offerState = await client.execute({
        sql: 'SELECT status FROM club_season_offers WHERE id = ?',
        args: [registration.offer_id],
      });
      expect(offerState.rows[0].status).toBe('registration_started');

      await expect(client.execute({
        sql: 'UPDATE club_season_agreement_acceptances SET accepted_name = ? WHERE registration_id = ?',
        args: ['Rewritten Parent', registration.id],
      })).rejects.toThrow(/immutable/i);
      await expect(client.execute({
        sql: 'DELETE FROM club_season_agreement_acceptances WHERE registration_id = ?',
        args: [registration.id],
      })).rejects.toThrow(/immutable/i);
      client.close();
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
      await expect(parentAPage.getByText(/information and agreement responses are safely recorded/i)).toBeVisible();

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
