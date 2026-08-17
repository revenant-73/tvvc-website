import { test, expect } from '@playwright/test';
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

test('admin APIs reject anonymous, legacy-passcode, and non-admin requests', async ({ browser, request }) => {
  const anonymous = await request.post('/api/admin/transfer-registration', {
    data: { itemId: 1, newEventId: 'event-parent-a' },
  });
  expect(anonymous.status()).toBe(401);

  const legacyPasscode = await request.post('/api/admin/transfer-registration', {
    data: {
      passcode: 'tvvc2024',
      itemId: 1,
      newEventId: 'event-parent-a',
    },
  });
  expect(legacyPasscode.status()).toBe(401);

  const parentContext = await contextWithSession(browser, fixtures.parentA.sessionToken);
  try {
    const nonAdmin = await parentContext.request.post('/api/admin/transfer-registration', {
      data: { itemId: 1, newEventId: 'event-parent-a' },
    });
    expect(nonAdmin.status()).toBe(403);
  } finally {
    await parentContext.close();
  }
});

test('admin APIs accept a current admin session and enforce same-origin requests', async ({ browser }) => {
  const adminContext = await contextWithSession(browser, fixtures.admin.sessionToken);
  try {
    const authorized = await adminContext.request.post('/api/admin/transfer-registration', {
      data: {},
    });
    expect(authorized.status()).toBe(400);
    await expect(authorized.json()).resolves.toMatchObject({ error: 'Missing required fields' });

    const crossOrigin = await adminContext.request.post('/api/admin/transfer-registration', {
      headers: { Origin: 'https://attacker.example' },
      data: {},
    });
    expect(crossOrigin.status()).toBe(403);
  } finally {
    await adminContext.close();
  }
});

test('admin page no longer exposes account self-promotion or a passcode', async ({ browser }) => {
  const parentContext = await contextWithSession(browser, fixtures.parentA.sessionToken);
  const page = await parentContext.newPage();

  try {
    await page.goto('/admin');
    await expect(page.getByText('Admin Access Restricted')).toBeVisible();
    await expect(page.getByText('Elevate Account')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('tvvc2024');

    const removedPromotionRoute = await parentContext.request.post('/api/admin/promote', {
      data: { passcode: 'tvvc2024' },
    });
    expect(removedPromotionRoute.status()).toBe(404);
  } finally {
    await parentContext.close();
  }
});

test('season team management requires admin access and supports staging and activation', async ({ browser, request }) => {
  const anonymous = await request.post('/api/admin/club-season-teams', {
    data: {
      seasonId: '2026-2027-club',
      ageGroupId: 'age-2026-2027-12u',
      name: '12 Black',
    },
  });
  expect(anonymous.status()).toBe(401);

  const parentContext = await contextWithSession(browser, fixtures.parentA.sessionToken);
  try {
    const forbidden = await parentContext.request.post('/api/admin/club-season-teams', {
      data: {
        seasonId: '2026-2027-club',
        ageGroupId: 'age-2026-2027-12u',
        name: '12 Black',
      },
    });
    expect(forbidden.status()).toBe(403);
  } finally {
    await parentContext.close();
  }

  const adminContext = await contextWithSession(browser, fixtures.admin.sessionToken);
  try {
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/admin/club-season');
    await expect(adminPage.getByRole('radio', { name: /Inactive Stage now/i })).toBeChecked();
    await expect(adminPage.getByRole('radio', { name: /Active Offer-ready/i })).not.toBeChecked();
    await expect(adminPage.getByText(/Inactive teams are saved but cannot be selected for new offers/i)).toBeVisible();
    const accessControl = adminPage.locator('[data-registration-access-control]');
    await expect(accessControl.getByText('Master access switch')).toBeVisible();
    await expect(accessControl.getByText('Closed by guardrails')).toBeVisible();
    await expect(accessControl.getByRole('button', { name: 'Review and open registration' })).toBeDisabled();
    await expect(accessControl.getByText('Resolve before opening')).toBeVisible();
    await adminPage.setViewportSize({ width: 375, height: 812 });
    const accessBounds = await accessControl.boundingBox();
    expect(accessBounds).not.toBeNull();
    expect(accessBounds.x).toBeGreaterThanOrEqual(0);
    expect(accessBounds.x + accessBounds.width).toBeLessThanOrEqual(375);

    const blockedOpen = await adminContext.request.patch('/api/admin/club-season-settings', {
      data: {
        action: 'set_registration_access',
        seasonId: '2026-2027-club',
        enabled: true,
        expectedEnabled: false,
        confirmation: 'OPEN REGISTRATION',
        reason: 'Attempting to open before every production requirement passes.',
      },
    });
    expect(blockedOpen.status()).toBe(409);
    await expect(blockedOpen.json()).resolves.toMatchObject({
      error: 'Registration cannot be opened until every launch requirement passes.',
      blockers: expect.any(Array),
    });

    const crossOriginOpen = await adminContext.request.patch('/api/admin/club-season-settings', {
      headers: { Origin: 'https://attacker.example' },
      data: {
        action: 'set_registration_access',
        seasonId: '2026-2027-club',
        enabled: true,
        expectedEnabled: false,
        confirmation: 'OPEN REGISTRATION',
        reason: 'A cross-origin request must never change registration access.',
      },
    });
    expect(crossOriginOpen.status()).toBe(403);

    const uniqueName = `12 Black ${Date.now()}`;
    const created = await adminContext.request.post('/api/admin/club-season-teams', {
      data: {
        seasonId: '2026-2027-club',
        ageGroupId: 'age-2026-2027-12u',
        name: uniqueName,
        active: false,
      },
    });
    expect(created.status()).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.team).toMatchObject({
      seasonId: '2026-2027-club',
      ageGroupId: 'age-2026-2027-12u',
      name: uniqueName,
      active: false,
      billingDayOverride: null,
    });

    const stagedOfferChoices = await adminContext.request.get(
      '/api/admin/club-season-offers?seasonId=2026-2027-club'
    );
    expect(stagedOfferChoices.status()).toBe(200);
    expect((await stagedOfferChoices.json()).teams).not.toContainEqual(
      expect.objectContaining({ id: createdBody.team.id })
    );

    const inactiveOffer = await adminContext.request.post('/api/admin/club-season-offers', {
      data: {
        seasonId: '2026-2027-club',
        teamId: createdBody.team.id,
        athleteIds: [999999],
      },
    });
    expect(inactiveOffer.status()).toBe(400);
    await expect(inactiveOffer.json()).resolves.toMatchObject({
      error: 'Active team not found for this season.',
    });

    const updated = await adminContext.request.patch('/api/admin/club-season-teams', {
      data: {
        id: createdBody.team.id,
        billingDayOverride: 15,
        active: true,
      },
    });
    expect(updated.status()).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({
      team: {
        id: createdBody.team.id,
        billingDayOverride: 15,
        active: true,
      },
    });

    const activeOfferChoices = await adminContext.request.get(
      '/api/admin/club-season-offers?seasonId=2026-2027-club'
    );
    expect(activeOfferChoices.status()).toBe(200);
    expect((await activeOfferChoices.json()).teams).toContainEqual(
      expect.objectContaining({ id: createdBody.team.id, name: uniqueName })
    );
  } finally {
    await adminContext.close();
  }
});
