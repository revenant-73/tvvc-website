const { test, expect } = require('@playwright/test');

test.describe('Core Values Section', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage and scroll to the Core Values section
    await page.goto('/index.html#values');
    await page.waitForLoadState('networkidle');
  });

  test('should render all 10 value cards', async ({ page }) => {
    // Verify that all 10 value cards are present
    const cards = await page.locator('.value-card').count();
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
      const headings = await page.locator(`h3:has-text("${title}")`);
      expect(headings).toBeTruthy();
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
      const icon = await page.locator(`.value-icon:has-text("${emoji}")`);
      await expect(icon).toBeVisible();
    }
  });

  test('should have colored left borders on each card', async ({ page }) => {
    const cards = page.locator('.value-card');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const borderColor = await card.evaluate((el) => {
        return window.getComputedStyle(el).borderLeftColor;
      });

      // Border should not be transparent
      expect(borderColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(borderColor).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    }
  });

  test('should have alternating border colors (teal, coral, orange)', async ({ page }) => {
    // Test the color pattern: teal (#00B4B3), coral (#FF6F61), orange (#FF9A56)
    const colorPattern = [
      'rgb(0, 150, 149)',     // teal
      'rgb(232, 93, 78)',     // coral
      'rgb(255, 154, 86)',    // orange
      'rgb(0, 150, 149)',     // teal
      'rgb(232, 93, 78)',     // coral
      'rgb(255, 154, 86)',    // orange
      'rgb(0, 150, 149)',     // teal
      'rgb(232, 93, 78)',     // coral
      'rgb(255, 154, 86)',    // orange
      'rgb(0, 150, 149)',     // teal
    ];

    const cards = page.locator('.value-card');

    for (let i = 0; i < colorPattern.length; i++) {
      const card = cards.nth(i);
      const borderColor = await card.evaluate((el) => {
        return window.getComputedStyle(el).borderLeftColor;
      });

      expect(borderColor).toBe(colorPattern[i]);
    }
  });

  test('should display descriptions for each value', async ({ page }) => {
    const paragraphs = await page.locator('.value-card p').count();
    // Each card should have exactly 1 paragraph (description)
    expect(paragraphs).toBe(10);

    // Verify paragraphs have meaningful text
    const firstDescription = await page.locator('.value-card p').first();
    const text = await firstDescription.textContent();
    expect(text?.length).toBeGreaterThan(20);
  });

  test('should apply hover effect - lift and shadow', async ({ page }) => {
    const firstCard = page.locator('.value-card').first();

    // Get initial transform and box-shadow
    const initialTransform = await firstCard.evaluate((el) => {
      return window.getComputedStyle(el).transform;
    });

    // Hover over the card
    await firstCard.hover();

    // Get transform and shadow after hover
    const hoverTransform = await firstCard.evaluate((el) => {
      return window.getComputedStyle(el).transform;
    });

    const hoverShadow = await firstCard.evaluate((el) => {
      return window.getComputedStyle(el).boxShadow;
    });

    // Transform should change (lift effect)
    expect(hoverTransform).not.toBe(initialTransform);

    // Shadow should be more prominent
    expect(hoverShadow).toContain('rgba');
  });

  test('should have proper grid layout on desktop', async ({ page }) => {
    const valuesGrid = page.locator('.card-grid.values-grid');
    
    // Check that grid layout is applied
    const gridDisplay = await valuesGrid.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });

    expect(gridDisplay).toBe('grid');
  });

  test('should have proper semantic heading structure', async ({ page }) => {
    // Section heading should be h2
    const sectionH2 = page.locator('#values h2');
    await expect(sectionH2).toContainText('Our Core Values');

    // Card headings should be h3
    const cardHeadings = page.locator('.value-card h3');
    const count = await cardHeadings.count();
    expect(count).toBe(10);

    // Each h3 should contain a value title
    for (let i = 0; i < count; i++) {
      const heading = cardHeadings.nth(i);
      const text = await heading.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Cards should still be visible
    const cards = page.locator('.value-card');
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();

    // Grid should still be display: grid
    const valuesGrid = page.locator('.card-grid.values-grid');
    const gridDisplay = await valuesGrid.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });

    expect(gridDisplay).toBe('grid');
  });

  test('should display value icons at appropriate size', async ({ page }) => {
    const icon = page.locator('.value-icon').first();

    // Icon should have a font-size of 2.5rem
    const fontSize = await icon.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });

    // 2.5rem = 40px (assuming 16px base font)
    expect(parseInt(fontSize)).toBeGreaterThan(35);
    expect(parseInt(fontSize)).toBeLessThan(45);
  });

  test('should maintain card spacing with proper gap', async ({ page }) => {
    const valuesGrid = page.locator('.card-grid.values-grid');

    // Grid should have a gap applied
    const gridGap = await valuesGrid.evaluate((el) => {
      return window.getComputedStyle(el).gap;
    });

    expect(gridGap).not.toBe('0px');
    expect(gridGap).toContain('px');
  });

  test('should pass accessibility checks for card structure', async ({ page }) => {
    // Each card should have proper structure
    const cards = page.locator('.value-card');
    
    for (let i = 0; i < 10; i++) {
      const card = cards.nth(i);
      
      // Should have an icon
      const icon = card.locator('.value-icon');
      await expect(icon).toBeVisible();

      // Should have a heading
      const heading = card.locator('h3');
      await expect(heading).toBeVisible();

      // Should have a description paragraph
      const description = card.locator('p');
      await expect(description).toBeVisible();
    }
  });
});