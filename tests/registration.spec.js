import { test, expect } from '@playwright/test';

test.describe('Registration Flow', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    // Ensure form is loaded
    await expect(page.getByRole('heading', { name: 'Secure Your Spot' })).toBeVisible();
  });

  test('should display registration form correctly', async ({ page }) => {
    await expect(page.getByText('Parent / Guardian Information')).toBeVisible();
    await expect(page.getByText('Athlete #1 Details')).toBeVisible();
  });

  test('should allow adding and removing athletes', async ({ page }) => {
    // Fill required parent info first
    await page.getByLabel('Full Name').fill('Test Parent');
    await expect(page.getByLabel('Full Name')).toHaveValue('Test Parent');
    
    await page.getByLabel('Email Address').fill('test@example.com');
    await expect(page.getByLabel('Email Address')).toHaveValue('test@example.com');

    await page.getByLabel('Your Phone').fill('555-555-5555');
    await expect(page.getByLabel('Your Phone')).toHaveValue('555-555-5555');

    await page.getByLabel('Emergency Phone').fill('555-555-5556');
    await expect(page.getByLabel('Emergency Phone')).toHaveValue('555-555-5556');

    // Add an athlete
    const addBtn = page.getByRole('button', { name: /Add Another Athlete/i });
    await addBtn.click();
    
    // Wait for the UI to reflect the new athlete
    await expect(page.getByText('Athlete #2 Details')).toBeVisible();

    // Remove the second athlete
    await page.getByRole('button', { name: 'Remove Athlete' }).last().click();
    await expect(page.getByText('Athlete #2 Details')).not.toBeVisible();
  });

  async function fillStep1(page) {
    // Parent Info
    await page.getByLabel('Full Name').fill('Test Parent');
    await expect(page.getByLabel('Full Name')).toHaveValue('Test Parent');

    await page.getByLabel('Email Address').fill('test@example.com');
    await expect(page.getByLabel('Email Address')).toHaveValue('test@example.com');

    await page.getByLabel('Your Phone').fill('555-555-5555');
    await expect(page.getByLabel('Your Phone')).toHaveValue('555-555-5555');

    await page.getByLabel('Emergency Phone').fill('555-555-5556');
    await expect(page.getByLabel('Emergency Phone')).toHaveValue('555-555-5556');

    // Athlete 1 Details
    await page.getByLabel('First Name').first().fill('John');
    await expect(page.getByLabel('First Name').first()).toHaveValue('John');

    await page.getByLabel('Last Name').first().fill('Doe');
    await expect(page.getByLabel('Last Name').first()).toHaveValue('Doe');

    await page.getByLabel(/Grade/).first().selectOption('6th');
    await expect(page.getByLabel(/Grade/).first()).toHaveValue('6th');

    await page.getByLabel(/Medical Info/).first().fill('None');
    await expect(page.getByLabel(/Medical Info/).first()).toHaveValue('None');
  }

  test('should validate required fields', async ({ page }) => {
    await fillStep1(page);

    // Advance to Step 2
    await page.getByRole('button', { name: 'Next Step' }).click();

    // Wait for Step 2
    await expect(page.getByRole('heading', { name: 'Select Events' })).toBeVisible();

    // In Step 2, the button is disabled when total is 0
    const nextBtn = page.getByRole('button', { name: 'Next Step' });
    await expect(nextBtn).toBeDisabled();
  });

  test('should complete a mock registration flow', async ({ page }) => {
    // Handle alerts to prevent hanging
    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });

    // Step 1: Info
    await fillStep1(page);

    await page.getByRole('button', { name: 'Next Step' }).click();

    // Step 2: Events
    await expect(page.getByRole('heading', { name: 'Select Events' })).toBeVisible();

    // Select an event
    const firstEvent = page.locator('label').filter({ hasText: /Clinic|Camp/ }).first();
    await firstEvent.waitFor({ state: 'visible' });
    await firstEvent.click();

    // Verify total updated
    await expect(page.locator('span.text-brand-teal').filter({ hasText: '$' }).last()).not.toContainText('$0');

    await page.getByRole('button', { name: 'Next Step' }).click();

    // Step 3: Waivers
    await expect(page.getByRole('heading', { name: 'Legal Waivers' })).toBeVisible();

    // Agree to Media Release
    await page.getByRole('button', { name: 'Agree' }).first().click();

    // Agree to Liability Waiver
    await page.locator('input[type="checkbox"][required]').first().check();

    await page.getByRole('button', { name: 'Next Step' }).click();

    // Step 4: Review
    await expect(page.getByRole('heading', { name: 'Verify Registration' })).toBeVisible();

    // Final Submit button should be enabled
    const submitBtn = page.getByRole('button', { name: 'Secure Spot' });
    await expect(submitBtn).toBeEnabled();
  });
});
