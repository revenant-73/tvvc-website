const { test, expect } = require('@playwright/test');

test.describe('Core Values Section', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render all 10 value cards', async ({ page }) => {
    // Verify that all 10 value cards are present (using glass-card class within core-values section)
    const cards = await page.locator('#core-values .glass-card h4').count();
    expect(cards).toBe(10);
  });

  test('should display correct titles for all values', async ({ page }) => {
    const expectedTitles = [
      'Curiosity Over Certainty',
      'Adaptability in Action',
      'Athlete Ownership',
      'Connection Before Correction',
      'Play with Purpose',
      'Resilience Through Challenge',
      'Freedom to Explore',
      'Authenticity Always',
      'Joy in the Process',
      'Support with Standards',
    ];

    for (const title of expectedTitles) {
      const headings = await page.locator(`h4:has-text("${title}")`);
      await expect(headings.first()).toBeVisible();
    }
  });

  test('should display emoji icons for each value', async ({ page }) => {
    const expectedEmojis = [
      '🤔', // Curiosity
      '🔄', // Adaptability
      '🎯', // Athlete Ownership
      '🤝', // Connection
      '🏐', // Play
      '💪', // Resilience
      '🚀', // Freedom
      '✨', // Authenticity
      '🎉', // Joy
      '🛡️', // Support
    ];

    for (const emoji of expectedEmojis) {
      const icon = await page.locator(`span:has-text("${emoji}")`);
      await expect(icon.first()).toBeVisible();
    }
  });

  test('should have proper grid layout on desktop', async ({ page }) => {
    // The new structure uses standard tailwind grid classes
    const valuesGrid = page.locator('#core-values .grid.grid-cols-1.md\\:grid-cols-3').first();
    await expect(valuesGrid).toBeVisible();
  });

  test('should have proper semantic heading structure', async ({ page }) => {
    // Section heading should be h2
    const sectionH2 = page.locator('#core-values h2:has-text("Our Core")');
    await expect(sectionH2.first()).toBeVisible();

    // Card headings should be h4 in the new structure
    const cardHeadings = page.locator('#core-values .glass-card h4');
    const count = await cardHeadings.count();
    expect(count).toBe(10);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Cards should still be visible
    const cards = page.locator('#core-values .glass-card h4');
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
  });

  test('should pass accessibility checks for card structure', async ({ page }) => {
    // Each card should have proper structure
    const cards = page.locator('#core-values .glass-card');
    const count = await cards.count();
    
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      
      // Should have a heading
      const heading = card.locator('h4');
      await expect(heading.first()).toBeVisible();

      // Should have a description paragraph
      const description = card.locator('p');
      await expect(description.first()).toBeVisible();
    }
  });
});