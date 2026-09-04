import { test, expect } from '@playwright/test';
const portalFixtures = require('./portal-fixtures');

test.describe('Registration Flow', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'log') {
        console.log(`BROWSER ${msg.type().toUpperCase()}: ${msg.text()}`);
      }
    });
    await page.goto('/register');
    // Log page content if hydration fails
    try {
      await expect(page.locator('form[data-hydrated="true"]')).toBeVisible({ timeout: 10000 });
    } catch (e) {
      const content = await page.content();
      console.log("PAGE CONTENT ON FAILURE:", content);
      throw e;
    }
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
    await expect(page.getByText('Athlete #2 Details')).toBeVisible({ timeout: 10000 });

    // Remove the second athlete
    await page.getByRole('button', { name: 'Remove Athlete' }).last().click();
    await expect(page.getByText('Athlete #2 Details')).not.toBeVisible({ timeout: 10000 });
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

  const registrationPayload = (eventId) => ({
    parentInfo: {
      name: 'Eligibility Test Parent',
      email: 'eligibility-parent@tvvc.test',
      phone: '503-555-0140',
      emergencyPhone: '503-555-0141',
    },
    athletes: [{
      firstName: 'Eligibility',
      lastName: 'Player',
      grade: '6th',
      medicalInfo: 'None',
      photoReleaseAgreed: false,
      waiverAgreed: true,
      selectedEvents: [eventId],
    }],
  });

  test('does not offer inactive or expired events in the registration form', async ({ page }) => {
    await fillStep1(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Select Events' })).toBeVisible();
    await page.getByRole('button', { name: 'Summer Camps' }).click();
    await expect(page.getByText(portalFixtures.parentB.eventName, { exact: true })).toBeVisible();
    await expect(page.getByText(
      portalFixtures.scheduleHistory.historicalCurrentEventName,
      { exact: true }
    )).not.toBeVisible();
    await expect(page.getByText(
      portalFixtures.scheduleHistory.inactiveEventName,
      { exact: true }
    )).not.toBeVisible();
  });

  test('shows eligible in-house program sessions from the requested tab', async ({ page }) => {
    await page.goto('/register?tab=playworks');
    await expect(page.locator('form[data-hydrated="true"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('In-House Training').first()).toBeVisible();

    await fillStep1(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Select Events' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PlayWorks' })).toBeVisible();
    await expect(page.getByText(portalFixtures.inHouse.playworksEventName, { exact: true })).toBeVisible();
    await expect(page.getByText('$200').first()).toBeVisible();

    await page.getByRole('button', { name: 'Ignition' }).click();
    await expect(page.getByText(portalFixtures.inHouse.ignitionEventName, { exact: true })).toBeVisible();
  });

  test('rejects inactive, expired, and unknown event IDs at the API boundary', async ({ request }) => {
    const unavailableEventIds = [
      'event-parent-a-inactive',
      'event-parent-a-history',
      'event-that-does-not-exist',
    ];

    for (const eventId of unavailableEventIds) {
      const response = await request.post('/api/register', {
        data: registrationPayload(eventId),
      });
      const responseBody = await response.json();

      expect(response.status(), eventId).toBe(400);
      expect(responseBody.error).toContain('no longer available');
    }
  });

  test('should validate required fields', async ({ page }) => {
    await fillStep1(page);

    // Advance to Step 2
    await page.getByRole('button', { name: 'Continue' }).click();

    // Wait for Step 2
    await expect(page.getByRole('heading', { name: 'Select Events' })).toBeVisible({ timeout: 10000 });

    // In Step 2, clicking Continue without events should show an error toast
    // (The button is not disabled by default)
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Check for toast error message
    await expect(page.getByText('Please select at least one event')).toBeVisible();
  });

  test('should complete a mock registration flow', async ({ page }) => {
    // Handle alerts to prevent hanging
    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });

    // Step 1: Info
    await fillStep1(page);

    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Events
    await expect(page.getByRole('heading', { name: 'Select Events' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Summer Camps' }).click();

    // Select an event
    const firstEvent = page.locator('label').filter({ hasText: /Clinic|Camp/ }).first();
    await firstEvent.waitFor({ state: 'visible' });
    await firstEvent.click();

    // Verify total updated
    await expect(page.locator('span.text-brand-teal').filter({ hasText: '$' }).last()).not.toContainText('$0');

    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3: Waivers
    await expect(page.getByRole('heading', { name: 'Liability Waivers' })).toBeVisible({ timeout: 10000 });

    // Agree to Liability Waiver
    await page.getByLabel(/Liability Waiver/).first().check();
    
    // Agree to Media Release
    await page.getByLabel(/Media Release/).first().check();

    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4: Review
    await expect(page.getByRole('heading', { name: 'Review Registration' })).toBeVisible({ timeout: 10000 });

    // Final Submit button should be enabled
    const submitBtn = page.getByRole('button', { name: 'Complete Registration' });
    await expect(submitBtn).toBeEnabled();
  });
});
