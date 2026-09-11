import { test, expect } from '@playwright/test';

test('tryout registration submits to Stripe checkout', async ({ page }) => {
  await page.goto('/tryouts/register');
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible({ timeout: 10000 });

  await page.locator('input[type="text"]').nth(0).fill('Tryout Parent');
  await page.locator('input[type="email"]').nth(0).fill('tryout-parent@tvvc.test');
  await page.locator('input[type="tel"]').nth(0).fill('503-555-0190');
  await page.locator('input[type="tel"]').nth(1).fill('503-555-0191');
  await page.getByRole('button', { name: 'Next: Athlete Info' }).click();

  await page.locator('input[type="text"]').nth(0).fill('Tryout');
  await page.locator('input[type="text"]').nth(1).fill('Player');
  await page.locator('input[type="date"]').fill('2013-01-01');
  await page.locator('select').nth(0).selectOption('8th');
  await page.locator('input[type="text"]').nth(3).fill('Test School');
  await page.locator('select').nth(1).selectOption('2031');
  await page.getByRole('button', { name: 'Setter' }).click();
  await page.locator('textarea').nth(0).fill('Played school volleyball.');
  await page.locator('textarea').nth(1).fill('None');
  await page.getByRole('button', { name: 'Next: Sessions' }).click();

  await expect(page.getByRole('heading', { name: /Select Tryout for Tryout/i })).toBeVisible();
  await page.getByRole('button', { name: /2026 Club Tryouts/i }).click();
  await page.getByRole('button', { name: 'Next: Waivers' }).click();

  await page.getByLabel(/I Agree to the Liability Waiver/i).check();
  await page.getByRole('button', { name: 'Next: Review' }).click();

  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/register') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Confirm & Pay' }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(/127\.0\.0\.1:4322\/mock-checkout\//);
});
