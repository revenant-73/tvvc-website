import { test, expect } from '@playwright/test';

test.describe('Registration Flow', () => {
  test.setTimeout(60000); // Increase timeout for dev server startup

  test.beforeEach(async ({ page }) => {
    // Navigate to the registration page
    await page.goto('/register');
  });

  test('should display registration form correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Secure Your Spot' })).toBeVisible();
    await expect(page.getByText('Parent / Guardian Information')).toBeVisible();
    await expect(page.getByText('Athlete #1 Details')).toBeVisible();
  });

  test('should allow adding and removing athletes', async ({ page }) => {
    // Initially one athlete
    await expect(page.getByText('Athlete #1 Details')).toBeVisible();
    
    // Add an athlete
    await page.getByRole('button', { name: '+ Add Athlete' }).click();
    await expect(page.getByText('Athlete #2 Details')).toBeVisible();

    // Remove the second athlete (the one we just added)
    await page.getByRole('button', { name: 'Remove Athlete' }).last().click();
    await expect(page.getByText('Athlete #2 Details')).not.toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // The button is disabled when total is 0
    const submitBtn = page.getByRole('button', { name: 'Secure Spot' });
    await expect(submitBtn).toBeDisabled();
  });

  test('should complete a mock registration flow', async ({ page }) => {
    // Fill Parent Info
    await page.locator('input[type="text"]').first().fill('Test Parent');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="tel"]').fill('555-555-5555');

    // Fill Athlete 1 Details
    await page.locator('input[type="text"]').nth(1).fill('John');
    await page.locator('input[type="text"]').nth(2).fill('Doe');
    await page.locator('select').first().selectOption('6th');
    await page.locator('select').nth(1).selectOption('Adult M');
    await page.getByPlaceholder(/medical information/i).fill('None');

    // Select an event
    const firstEvent = page.locator('label').filter({ hasText: /Clinic|Camp/ }).first();
    await firstEvent.click();

    // Expand waiver section
    await page.getByRole('button', { name: /Sign Waivers|Waivers Completed/i }).click();

    // Check waiver - avoid dev toolbar toggle by being specific
    const waiverCheckbox = page.locator('form input[type="checkbox"][required]');
    await waiverCheckbox.check();

    // Total should be updated
    await expect(page.getByText(/Total/i, { exact: false }).locator('xpath=following-sibling::span')).not.toContainText('$0');

    // Submit
    const submitBtn = page.getByRole('button', { name: 'Secure Spot' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
  });
});
