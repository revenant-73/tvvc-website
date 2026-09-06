const { test, expect } = require('@playwright/test');

test.describe('Boys Volleyball Interest Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/boys-volleyball');
  });

  test('renders core copy and calls to action', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Boys Volleyball at TVVC' })).toBeVisible();
    await expect(page.getByText('TVVC is gathering interest from families for a potential boys volleyball program this season.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Express Interest' })).toHaveAttribute('href', '#interest-form');
    await expect(page.getByRole('link', { name: 'Email TVVC' })).toHaveAttribute('href', /mailto:info@tualatinvalleyvb\.com/);
    await expect(page.getByText('This is not tryout registration, club-season registration, or a payment workflow.')).toBeVisible();
  });

  test('uses Netlify Forms markup and keeps required fields reasonable', async ({ page }) => {
    const form = page.locator('form[name="boys-volleyball-interest"]');

    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('method', 'POST');
    await expect(form).toHaveAttribute('action', '/boys-volleyball/thanks');
    await expect(form).toHaveAttribute('data-netlify', 'true');
    await expect(form).toHaveAttribute('netlify-honeypot', 'bot-field');
    await expect(form.locator('input[type="hidden"][name="form-name"]')).toHaveValue('boys-volleyball-interest');
    await expect(form.locator('input[type="hidden"][name="subject"]')).toHaveValue('New TVVC Boys Volleyball Interest Form');

    await expect(form.locator('input[name="parent_name"]')).toHaveAttribute('required', '');
    await expect(form.locator('input[name="email"][type="email"]')).toHaveAttribute('required', '');
    await expect(form.locator('input[name="player_name"]')).toHaveAttribute('required', '');
    await expect(form.locator('select[name="player_grade"]')).toHaveAttribute('required', '');
    await expect(form.locator('input[name="player_experience"]')).toHaveCount(4);
    await expect(form.locator('input[name="player_experience"]').first()).toHaveAttribute('required', '');
    await expect(form.locator('input[name="contact_consent"][type="checkbox"]')).toHaveAttribute('required', '');

    await expect(form.locator('input[name="phone"]')).toBeVisible();
    await expect(form.locator('input[name="player_school"]')).toBeVisible();
    await expect(form.locator('input[name="interest_type"]')).toHaveCount(4);
    await expect(form.locator('textarea[name="availability_conflicts"]')).toBeVisible();
    await expect(form.locator('textarea[name="notes"]')).toBeVisible();
  });

  test('does not collect registration, medical, waiver, birthdate, or payment fields', async ({ page }) => {
    const form = page.locator('form[name="boys-volleyball-interest"]');
    const forbiddenNames = [
      'medicalInfo',
      'medical_info',
      'emergencyPhone',
      'emergency_phone',
      'birthdate',
      'date_of_birth',
      'waiver',
      'payment',
      'stripe',
    ];

    for (const name of forbiddenNames) {
      await expect(form.locator(`[name="${name}"]`)).toHaveCount(0);
    }
  });

  test('thank-you page confirms receipt without implying registration', async ({ page }) => {
    await page.goto('/boys-volleyball/thanks');

    await expect(page.getByRole('heading', { name: 'Thanks for raising a hand.' })).toBeVisible();
    await expect(page.getByText('TVVC received your boys volleyball interest form.')).toBeVisible();
    await expect(page.getByText('This does not register your player for a program or tryout.')).toBeVisible();
    await expect(page.getByText('No team, roster spot, pricing, placement, or schedule is promised.')).toBeVisible();
    await expect(page.getByText('TVVC may email updates about open gyms, clinics, tryouts, or team formation.')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Back to Boys Volleyball' })).toHaveAttribute('href', '/boys-volleyball');
    await expect(page.getByRole('link', { name: 'Email TVVC' })).toHaveAttribute('href', 'mailto:info@tualatinvalleyvb.com?subject=Boys%20Volleyball%20Interest');
    await expect(page.getByRole('link', { name: 'View FAQ' })).toHaveAttribute('href', '/faq');
  });

  test('is linked from desktop and mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await expect(page.locator('header nav div.lg\\:flex a[href="/boys-volleyball"]')).toContainText('Boys Volleyball');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('#mobile-menu-toggle').click();
    await expect(page.locator('#mobile-menu a[href="/boys-volleyball"]')).toContainText('Boys Volleyball');
  });
});
