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
        const menuToggle = page.locator('#mobile-menu-toggle');
        await expect(menuToggle).toHaveCSS('display', 'none');

        // Navigation menu should be visible
        const headerNav = page.locator('header nav div.lg\\:flex');
        await expect(headerNav).toBeVisible();

        // Navigation items should be visible
        const navLinks = headerNav.locator('a');
        await expect(navLinks).toHaveCount(7); // 6 links + Dashboard button

        // Check nav items
        await expect(navLinks.nth(0)).toContainText('Teams');
        await expect(navLinks.nth(1)).toContainText('Programs');
        await expect(navLinks.nth(2)).toContainText('Summer Camps');
        await expect(navLinks.nth(3)).toContainText('Outdoor');
        await expect(navLinks.nth(4)).toContainText('Events');
        await expect(navLinks.nth(5)).toContainText('FAQ');
        await expect(navLinks.nth(6)).toContainText('Dashboard');
      });

      test('mobile: hamburger icon displays at breakpoint', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        // Hamburger menu should be displayed
        const menuToggle = page.locator('#mobile-menu-toggle');
        await expect(menuToggle).toHaveCSS('display', 'block');

        // Should have an SVG
        const svg = menuToggle.locator('svg');
        await expect(svg).toBeVisible();
      });

      test('mobile: menu opens and closes on hamburger click', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#mobile-menu-toggle');
        const mobileMenu = page.locator('#mobile-menu');

        // Initially menu should be hidden
        await expect(mobileMenu).toBeHidden();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

        // Click hamburger to open menu
        await menuToggle.click();

        // Menu should now be open
        await expect(mobileMenu).toBeVisible();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');

        // Click hamburger again to close menu
        await menuToggle.click();

        // Menu should be closed again
        await expect(mobileMenu).toBeHidden();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
      });

      test('mobile: all navigation items visible in dropdown', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#mobile-menu-toggle');
        const mobileMenu = page.locator('#mobile-menu');

        // Open menu
        await menuToggle.click();

        // Navigation items should be visible
        const navLinks = mobileMenu.locator('a');
        await expect(navLinks).toHaveCount(7); // 6 + Parent Dashboard

        const expectedItems = ['Teams', 'Programs', 'Summer Camps', 'Outdoor', 'Events', 'FAQ', 'Parent Dashboard'];
        for (let i = 0; i < expectedItems.length; i++) {
          await expect(navLinks.nth(i)).toBeVisible();
          await expect(navLinks.nth(i)).toContainText(expectedItems[i]);
        }
      });

      test('mobile: Parent Dashboard button has proper styling', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#mobile-menu-toggle');
        await menuToggle.click();

        // Find Parent Dashboard button
        const dashboardBtn = page.locator('#mobile-menu a').filter({ hasText: 'Parent Dashboard' });
        await expect(dashboardBtn).toBeVisible();

        // Should have teal background color (btn-primary in new theme)
        const bgColor = await dashboardBtn.evaluate(el => 
          window.getComputedStyle(el).backgroundColor
        );
        // Teal is #009695 which is rgb(0, 150, 149)
        expect(bgColor).toBe('rgb(0, 150, 149)');
      });

      test('mobile: hamburger button has proper accessibility attributes', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#mobile-menu-toggle');

        // Should have aria-label
        await expect(menuToggle).toHaveAttribute('aria-label', 'Toggle navigation menu');
      });

      test('responsive breakpoint at 1024px', async ({ page }) => {
        // Test at 1023px (mobile/tablet breakpoint for lg)
        await page.setViewportSize({ width: 1023, height: 1024 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        const menuToggle = page.locator('#mobile-menu-toggle');
        await expect(menuToggle).toHaveCSS('display', 'block');

        // Test at 1024px (desktop)
        await page.setViewportSize({ width: 1024, height: 1024 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        await expect(menuToggle).toHaveCSS('display', 'none');
      });

      test('desktop: hover effect on nav links', async ({ page }) => {
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.goto(`${BASE_URL}${pageData.url}`);

        // Find a link that is NOT currently active (doesn't have brand-teal color)
        // We look for links in the desktop nav that don't have the active class
        const navLinks = page.locator('header nav div.lg\\:flex a:not(.btn)');
        const count = await navLinks.count();
        
        let targetLink = null;
        for (let i = 0; i < count; i++) {
          const link = navLinks.nth(i);
          const color = await link.evaluate(el => getComputedStyle(el).color);
          // If color is white (rgb(255, 255, 255)), it's not active
          if (color === 'rgb(255, 255, 255)') {
            targetLink = link;
            break;
          }
        }

        // If we found a non-active link, test its hover state
        if (targetLink) {
          // Hover over link
          await targetLink.hover();
          await page.waitForTimeout(200);

          // Color should change to primary teal on hover
          await expect(targetLink).toHaveCSS('color', 'rgb(0, 150, 149)');
        }
      });
    });
  });

  test('navigation links are functional and navigate correctly', async ({ page, context }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/`);

    // Click Teams link
    await page.locator('header nav a').filter({ hasText: 'Teams' }).first().click();
    await page.waitForURL(/\/teams\.html/);
    await expect(page.url()).toContain('teams.html');

    // Click FAQ link
    await page.locator('header nav a').filter({ hasText: 'FAQ' }).first().click();
    await page.waitForURL(/\/faq\.html/);
    await expect(page.url()).toContain('faq.html');
  });

  test('Parent Dashboard button opens external link in new tab', async ({ page, context }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/`);

    const dashboardBtn = page.locator('header nav a:has-text("Dashboard")');

    // Should have target="_blank"
    await expect(dashboardBtn).toHaveAttribute('target', '_blank');

    // Should link to volleyball central
    await expect(dashboardBtn).toHaveAttribute('href', /volleyballcentral/);
  });
});