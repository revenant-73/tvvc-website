const { test, expect } = require('@playwright/test');

test.describe('Parent Portal access boundaries', () => {
  test('redirects unauthenticated parents to the portal login', async ({ page }) => {
    await page.goto('/portal/dashboard');

    await expect(page).toHaveURL(/\/portal\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Login Link' })).toBeVisible();
  });

  test('protects player and order pages without a session', async ({ page }) => {
    await page.goto('/portal/players');
    await expect(page).toHaveURL(/\/portal\/login$/);

    await page.goto('/portal/athletes/1');
    await expect(page).toHaveURL(/\/portal\/login$/);

    await page.goto('/portal/orders/not-a-real-order');
    await expect(page).toHaveURL(/\/portal\/login$/);
  });

  test('rejects cross-origin portal writes before authentication', async ({ request }) => {
    const response = await request.post('/api/portal/update-profile', {
      headers: {
        Origin: 'https://attacker.example',
        'Sec-Fetch-Site': 'cross-site',
      },
      data: {
        name: 'Not TVVC',
        emergencyPhone: '503-555-0199',
      },
    });

    expect(response.status()).toBe(403);
    expect(await response.text()).toMatch(/origin|cross-site/i);
  });

  test('rejects unauthenticated player creation and updates', async ({ request }) => {
    const player = {
      firstName: 'Unauthorized',
      lastName: 'Player',
      grade: '8th',
      tshirtSize: 'Youth M',
      medicalInfo: 'None',
    };

    const createResponse = await request.post('/api/portal/add-athlete', {
      data: player,
    });
    expect(createResponse.status()).toBe(401);

    const updateResponse = await request.post('/api/portal/update-athlete', {
      data: { id: 1, ...player },
    });
    expect(updateResponse.status()).toBe(401);
  });

  test('does not expose Stripe receipts without a session', async ({ request }) => {
    const response = await request.get('/api/stripe/receipt?registrationId=missing');

    expect(response.status()).toBe(401);
  });
});
