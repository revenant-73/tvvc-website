const { test, expect } = require('@playwright/test');

// Base URL for testing
const BASE_URL = 'http://localhost:8000';

test.describe('Mobile Navigation Menu', () => {
  // Test on all pages to ensure consistency
  const pages = [
    { url: '/', name: 'Homepage' },
    { url: '/teams.html', name: 'Teams' },
    { url: '/programs.html', name: 'Programs' },
    { url: '/faq.html', name: 'FAQ' },
    { url: '/privacy-policy.html', name: 'Privacy Policy' }
  ];

  pages.forEach(pageData => {
    test.describe(`${pageData.name} page`, () => {
      test('desktop: navigation items display inline', async ({ page }) => {
        // Set desktop viewport
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        // Hamburger menu should be hidden
        const menuToggle = page.locator('#menuToggle');
        await expect(menuToggle).toHaveCSS('display', 'none');

        // Navigation menu should be visible with flex layout
        const headerNav = page.locator('#headerNav');
        await expect(headerNav).toBeVisible();
        await expect(headerNav).toHaveCSS('flex-direction', 'row');

        // All navigation items should be visible
        const navLinks = headerNav.locator('a');
        await expect(navLinks).toHaveCount(9);

        // Check each nav item is visible
        await expect(navLinks.nth(0)).toContainText('Home');
        await expect(navLinks.nth(1)).toContainText('Teams');
        await expect(navLinks.nth(2)).toContainText('Programs');
        await expect(navLinks.nth(3)).toContainText('Summer Camps & Clinics');
        await expect(navLinks.nth(4)).toContainText('Outdoor Events');
        await expect(navLinks.nth(5)).toContainText('Events');
        await expect(navLinks.nth(6)).toContainText('FAQ');
        await expect(navLinks.nth(7)).toContainText('Contact');
        await expect(navLinks.nth(8)).toContainText('Parent Dashboard');
      });

      test('mobile: hamburger icon displays at breakpoint', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        // Hamburger menu should be displayed
        const menuToggle = page.locator('#menuToggle');
        await expect(menuToggle).toHaveCSS('display', 'flex');

        // Should have three spans (hamburger lines)
        const spans = menuToggle.locator('span');
        await expect(spans).toHaveCount(3);

        // Each span should be visible and styled
        for (let i = 0; i < 3; i++) {
          const span = spans.nth(i);
          // Match charcoal color
          await expect(span).toHaveCSS('background-color', 'rgb(26, 26, 26)');
          await expect(span).toHaveCSS('width', '24px');
          await expect(span).toHaveCSS('height', '2px');
        }
      });

      test('mobile: menu opens and closes on hamburger click', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#menuToggle');
        const headerNav = page.locator('#headerNav');

        // Initially menu should be closed (display: none or hidden)
        // Note: styles.css uses display: none and flex for header-nav
        await expect(headerNav).not.toBeVisible();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

        // Click hamburger to open menu
        await menuToggle.click();

        // Menu should now be open
        await expect(headerNav).toBeVisible();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
        await expect(menuToggle).toHaveClass(/active/);

        // Click hamburger again to close menu
        await menuToggle.click();

        // Menu should be closed again
        await expect(headerNav).not.toBeVisible();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
      });

      test('mobile: hamburger animates to X shape when active', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#menuToggle');
        const spans = menuToggle.locator('span');

        // Click to activate menu
        await menuToggle.click();

        // Wait for transition to complete
        await page.waitForTimeout(500);

        // First span should rotate 45deg
        // We use a regex to match the rotation part of the matrix, as translation can vary
        const firstSpanTransform = await spans.nth(0).evaluate(el => 
          window.getComputedStyle(el).transform
        );
        expect(firstSpanTransform).toMatch(/matrix\(0\.707107, 0\.707107, -0\.707107, 0\.707107/);

        // Second span should be hidden
        await expect(spans.nth(1)).toHaveCSS('opacity', '0');

        // Third span should rotate -45deg
        const thirdSpanTransform = await spans.nth(2).evaluate(el => 
          window.getComputedStyle(el).transform
        );
        expect(thirdSpanTransform).toMatch(/matrix\(0\.707107, -0\.707107, 0\.707107, 0\.707107/);
      });

      test('mobile: all navigation items visible in dropdown', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#menuToggle');
        const headerNav = page.locator('#headerNav');

        // Open menu
        await menuToggle.click();

        // All navigation items should be visible
        const navLinks = headerNav.locator('a');
        await expect(navLinks).toHaveCount(9);

        const expectedItems = ['Home', 'Teams', 'Programs', 'Summer Camps & Clinics', 'Outdoor Events', 'Events', 'FAQ', 'Contact', 'Parent Dashboard'];
        for (let i = 0; i < expectedItems.length; i++) {
          await expect(navLinks.nth(i)).toBeVisible();
          await expect(navLinks.nth(i)).toContainText(expectedItems[i]);
        }
      });

      test('mobile: Parent Dashboard button has proper styling', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#menuToggle');
        await menuToggle.click();

        // Find Parent Dashboard button
        const registerBtn = page.locator('#headerNav .header-register-btn');
        await expect(registerBtn).toBeVisible();

        // Should have coral background color
        const bgColor = await registerBtn.evaluate(el => 
          window.getComputedStyle(el).backgroundColor
        );
        // Coral is #E85D4E which is rgb(232, 93, 78)
        expect(bgColor).toBe('rgb(232, 93, 78)');
      });

      test('mobile: menu closes when nav link is clicked', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#menuToggle');
        const headerNav = page.locator('#headerNav');

        // Open menu
        await menuToggle.click();
        await expect(headerNav).toBeVisible();

        // Click a nav link
        const firstLink = headerNav.locator('a').first();
        await firstLink.click();

        // Menu should be closed
        await expect(headerNav).not.toBeVisible();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
      });

      test('mobile: menu closes when clicking outside header', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#menuToggle');
        const headerNav = page.locator('#headerNav');
        const mainContent = page.locator('main');

        // Open menu
        await menuToggle.click();
        await expect(headerNav).toBeVisible();

        // Click outside the header (on main content)
        await mainContent.click({ position: { x: 100, y: 300 } });

        // Menu should be closed
        await expect(headerNav).not.toBeVisible();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
      });

      test('mobile: hamburger button has proper accessibility attributes', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#menuToggle');

        // Should have aria-label
        await expect(menuToggle).toHaveAttribute('aria-label', 'Toggle navigation menu');

        // Should have aria-expanded attribute
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

        // Clicking should update aria-expanded
        await menuToggle.click();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');

        // Clicking again should reset it
        await menuToggle.click();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
      });

      test('responsive breakpoint at 768px', async ({ page }) => {
        // Test at 768px (mobile breakpoint)
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#menuToggle');
        await expect(menuToggle).toHaveCSS('display', 'flex');

        // Test at 769px (desktop)
        await page.setViewportSize({ width: 769, height: 1024 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        await expect(menuToggle).toHaveCSS('display', 'none');
      });

      test('desktop: hover effect on nav links', async ({ page }) => {
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const navLink = page.locator('#headerNav a').first();

        // Initially should be charcoal
        await expect(navLink).toHaveCSS('color', 'rgb(26, 26, 26)');

        // Hover over link
        await navLink.hover();

        // Wait a bit for transition
        await page.waitForTimeout(200);

        // Color should change to primary teal on hover
        await expect(navLink).toHaveCSS('color', 'rgb(0, 150, 149)');
      });
    });
  });

  test('navigation links are functional and navigate correctly', async ({ page, context }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/`);

    // Click Teams link
    await page.locator('#headerNav a:has-text("Teams")').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/teams\.html/);

    // Click Programs link
    await page.locator('#headerNav a:has-text("Programs")').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/programs\.html/);

    // Click FAQ link
    await page.locator('#headerNav a:has-text("FAQ")').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/faq\.html/);

    // Click Home link
    await page.locator('#headerNav a:has-text("Home")').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/index\.html|\/$/);
  });

  test('Parent Dashboard button opens external link in new tab', async ({ page, context }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/`);

    const registerBtn = page.locator('#headerNav .header-register-btn');

    // Should have target="_blank"
    await expect(registerBtn).toHaveAttribute('target', '_blank');

    // Should have rel="noopener noreferrer"
    await expect(registerBtn).toHaveAttribute('rel', 'noopener noreferrer');

    // Should link to volleyball central
    await expect(registerBtn).toHaveAttribute('href', /volleyballcentral/);
  });
});