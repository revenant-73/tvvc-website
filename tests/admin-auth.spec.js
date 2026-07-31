import { test, expect } from '@playwright/test';
const fixtures = require('./portal-fixtures');

const appUrl = 'http://127.0.0.1:4321';

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
