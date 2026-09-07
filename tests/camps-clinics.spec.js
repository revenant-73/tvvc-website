const { test, expect } = require('@playwright/test');

test.describe('Camps & Clinics page', () => {
  test('features Girls Club Prep clinics with registration details', async ({ page }) => {
    await page.goto('/summer-camps-clinics');

    await expect(page.getByRole('heading', { name: /Volleyball Camps & Clinics in Hillsboro/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register for Girls Club Prep' }).first()).toHaveAttribute('href', '/register?tab=girls-club-prep');

    const clubPrep = page.locator('#girls-club-prep');
    await expect(clubPrep.getByRole('heading', { name: /Girls Club Prep Clinics/i })).toBeVisible();
    await expect(clubPrep.getByText('Sundays, Sept 13 - Oct 18')).toBeVisible();
    await expect(clubPrep.getByText('3:00-5:00pm').first()).toBeVisible();
    await expect(clubPrep.getByText('$30 per player, per clinic')).toBeVisible();
    await expect(clubPrep.getByText('14 players per clinic')).toBeVisible();

    for (const date of ['September 13', 'September 20', 'September 27', 'October 4', 'October 11', 'October 18']) {
      await expect(clubPrep.getByText(date, { exact: true })).toBeVisible();
    }
  });
});
