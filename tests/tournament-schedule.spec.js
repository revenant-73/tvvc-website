const { test, expect } = require('@playwright/test');

test.describe('Tournament Schedule Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/teams');
  });

  test.describe('Schedule Section Rendering', () => {
    test('should render the 2026-2027 Tournament Schedule heading', async ({ page }) => {
      const heading = page.locator('h2').filter({ hasText: '2026-2027 Tournament Schedule' });
      await expect(heading).toBeVisible();
    });

    test('should render tournament schedule subtitle', async ({ page }) => {
      const subtitle = page.locator('p.section-subtitle').filter({
        hasText: 'Competitive matches and regional qualifiers'
      });
      await expect(subtitle).toBeVisible();
    });
  });

  test.describe('Schedule Tabs Interface', () => {
    test('should render all four tab buttons', async ({ page }) => {
      const tabs = page.locator('.schedule-tab');
      await expect(tabs).toHaveCount(4);
    });

    test('should have 11 & 12U tab with active state on load', async ({ page }) => {
      const tab12u = page.locator('.schedule-tab').filter({ hasText: '11 & 12U' });
      await expect(tab12u).toHaveClass(/active/);
    });

    test('should render 11 & 12U schedule by default', async ({ page }) => {
      const content12u = page.locator('#schedule-12u');
      await expect(content12u).toHaveClass(/active/);
      await expect(content12u).toContainText('Coming October 2026');
    });

    test('should update active tab class when switching tabs', async ({ page }) => {
      const tab12u = page.locator('.schedule-tab').filter({ hasText: '11 & 12U' });
      const tab14u = page.locator('.schedule-tab').filter({ hasText: '13 & 14U' });
      const tab16u = page.locator('.schedule-tab').filter({ hasText: '15 & 16U' });
      
      // Initially 12U should be active
      await expect(tab12u).toHaveClass(/active/);
      await expect(tab14u).not.toHaveClass(/active/);
      await expect(tab16u).not.toHaveClass(/active/);
      
      // After clicking 14U
      await tab14u.click();
      await expect(tab12u).not.toHaveClass(/active/);
      await expect(tab14u).toHaveClass(/active/);
      
      // After clicking 16U
      await tab16u.click();
      await expect(tab14u).not.toHaveClass(/active/);
      await expect(tab16u).toHaveClass(/active/);
    });
  });

  test('should display Coming Soon message for all tabs', async ({ page }) => {
    const tabs = ['11 & 12U', '13 & 14U', '15 & 16U', '17 & 18U'];
    const tabIds = ['schedule-12u', 'schedule-14u', 'schedule-16u', 'schedule-18u'];
    
    for (let i = 0; i < tabs.length; i++) {
      const tab = page.locator('.schedule-tab').filter({ hasText: tabs[i] });
      await tab.click();
      
      const content = page.locator(`#${tabIds[i]}`);
      await expect(content).toBeVisible();
      await expect(content).toContainText('Coming October 2026');
    }
  });

  test.describe('Schedule Section Positioning', () => {
    test('should display tournament schedule after season logistics', async ({ page }) => {
      const logistics = page.locator('section').filter({ hasText: 'Season Logistics' });
      const schedule = page.locator('#tournament-schedule');
      
      const logisticsBox = await logistics.boundingBox();
      const scheduleBox = await schedule.boundingBox();
      
      expect(scheduleBox.y).toBeGreaterThan(logisticsBox.y);
    });
  });

  test.describe('Responsive Design', () => {
    test('should maintain section visibility on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const schedule = page.locator('#tournament-schedule');
      await expect(schedule).toBeVisible();
    });
  });
});
