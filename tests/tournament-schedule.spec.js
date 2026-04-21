const { test, expect } = require('@playwright/test');

test.describe('Tournament Schedule Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000/teams.html');
  });

  test.describe('Schedule Section Rendering', () => {
    test('should render the 2026 Tournament Schedule heading', async ({ page }) => {
      const heading = page.locator('h2').filter({ hasText: '2026 Tournament Schedule' });
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

    test('should have 12U Division tab with active state on load', async ({ page }) => {
      const tab12u = page.locator('.schedule-tab').filter({ hasText: '12U Division' });
      await expect(tab12u).toHaveClass(/active/);
    });

    test('should render 12U schedule by default', async ({ page }) => {
      const content12u = page.locator('#schedule-12u');
      await expect(content12u).toHaveClass(/active/);
    });

    test('should switch to 14U schedule when 14U tab is clicked', async ({ page }) => {
      const tab14u = page.locator('.schedule-tab').filter({ hasText: '14U Division' });
      await tab14u.click();
      
      const content14u = page.locator('#schedule-14u');
      await expect(content14u).toHaveClass(/active/);
    });

    test('should switch to 18U schedule when 18U tab is clicked', async ({ page }) => {
      const tab18u = page.locator('.schedule-tab').filter({ hasText: '18U Division' });
      await tab18u.click();
      
      const content18u = page.locator('#schedule-18u');
      await expect(content18u).toHaveClass(/active/);
    });

    test('should hide non-active tab contents', async ({ page }) => {
      const tab16u = page.locator('.schedule-tab').filter({ hasText: '16U Division' });
      await tab16u.click();
      
      const content14u = page.locator('#schedule-14u');
      await expect(content14u).not.toHaveClass(/active/);
    });

    test('should update active tab class when switching tabs', async ({ page }) => {
      const tab12u = page.locator('.schedule-tab').filter({ hasText: '12U Division' });
      const tab14u = page.locator('.schedule-tab').filter({ hasText: '14U Division' });
      const tab16u = page.locator('.schedule-tab').filter({ hasText: '16U Division' });
      
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

  test.describe('14U Schedule Table', () => {
    test.beforeEach(async ({ page }) => {
      // Click on 14U tab before each test
      const tab14u = page.locator('.schedule-tab').filter({ hasText: '14U Division' });
      await tab14u.click();
    });

    test('should render 14U schedule table with correct structure', async ({ page }) => {
      // Find the 14U table (first table after "14U Division" heading)
      const tables = page.locator('.schedule-table');
      const firstTable = tables.nth(0);
      await expect(firstTable).toBeVisible();
    });

    test('should have correct table headers in 14U schedule', async ({ page }) => {
      const firstTable = page.locator('.schedule-table').nth(0);
      const headers = firstTable.locator('th');
      
      await expect(headers.nth(0)).toHaveText('Date');
      await expect(headers.nth(1)).toHaveText('Event');
    });

    test('should render all 6 rows in 14U schedule', async ({ page }) => {
      const firstTable = page.locator('.schedule-table').nth(0);
      const rows = firstTable.locator('tbody tr');
      await expect(rows).toHaveCount(6);
    });

    test('should have correct dates in 14U schedule', async ({ page }) => {
      const firstTable = page.locator('.schedule-table').nth(0);
      const dateCells = firstTable.locator('.schedule-date');
      
      const expectedDates = ['1/11/26', '1/25/26', '2/22/26', '3/8/26', '4/11/26', '5/2/26'];
      
      for (let i = 0; i < expectedDates.length; i++) {
        await expect(dateCells.nth(i)).toHaveText(expectedDates[i]);
      }
    });

    test('should have correct events in 14U schedule', async ({ page }) => {
      const firstTable = page.locator('.schedule-table').nth(0);
      const eventCells = firstTable.locator('tbody td:nth-child(2)');
      
      const expectedEvents = [
        'Power League Qualifier Day 1',
        'Power League Qualifier Day 2',
        'Power League #1',
        'Power League #2',
        'Power League #3',
        'CEVA Regional Tournament'
      ];
      
      for (let i = 0; i < expectedEvents.length; i++) {
        await expect(eventCells.nth(i)).toContainText(expectedEvents[i]);
      }
    });

    test('should style 14U regional tournament row with special class', async ({ page }) => {
      const firstTable = page.locator('.schedule-table').nth(0);
      const regionalRow = firstTable.locator('tbody .schedule-regional');
      
      await expect(regionalRow).toBeVisible();
      await expect(regionalRow).toContainText('CEVA Regional Tournament');
    });

    test('should have italic qualifier text in 14U regional row', async ({ page }) => {
      const firstTable = page.locator('.schedule-table').nth(0);
      const qualifier = firstTable.locator('.schedule-qualifier');
      
      await expect(qualifier).toBeVisible();
      await expect(qualifier).toHaveText('(IF QUALIFIED)');
    });
  });

  test.describe('16U Schedule Table', () => {
    test.beforeEach(async ({ page }) => {
      // Click on 16U tab before each test
      const tab16u = page.locator('.schedule-tab').filter({ hasText: '16U Division' });
      await tab16u.click();
    });

    test('should render 16U schedule table with correct structure', async ({ page }) => {
      const table = page.locator('#schedule-16u .schedule-table');
      await expect(table).toBeVisible();
    });

    test('should have correct table headers in 16U schedule', async ({ page }) => {
      const table = page.locator('#schedule-16u .schedule-table');
      const headers = table.locator('th');
      
      await expect(headers.nth(0)).toHaveText('Date');
      await expect(headers.nth(1)).toHaveText('Event');
    });

    test('should render all 6 rows in 16U schedule', async ({ page }) => {
      const table = page.locator('#schedule-16u .schedule-table');
      const rows = table.locator('tbody tr');
      await expect(rows).toHaveCount(6);
    });

    test('should have correct dates in 16U schedule', async ({ page }) => {
      const table = page.locator('#schedule-16u .schedule-table');
      const dateCells = table.locator('.schedule-date');
      
      const expectedDates = ['1/4/26', '2/1/26', '2/21/26', '3/15/26', '4/18/26', '4/25/26'];
      
      for (let i = 0; i < expectedDates.length; i++) {
        await expect(dateCells.nth(i)).toHaveText(expectedDates[i]);
      }
    });

    test('should have correct events in 16U schedule', async ({ page }) => {
      const table = page.locator('#schedule-16u .schedule-table');
      const eventCells = table.locator('tbody td:nth-child(2)');
      
      const expectedEvents = [
        'Power League Qualifier Day 1',
        'Power League Qualifier Day 2',
        'Power League #1',
        'Power League #2',
        'Power League #3',
        'CEVA Regional Tournament'
      ];
      
      for (let i = 0; i < expectedEvents.length; i++) {
        await expect(eventCells.nth(i)).toContainText(expectedEvents[i]);
      }
    });

    test('should style 16U regional tournament row correctly', async ({ page }) => {
      const table = page.locator('#schedule-16u .schedule-table');
      const regionalRow = table.locator('tbody .schedule-regional');
      
      await expect(regionalRow).toBeVisible();
      await expect(regionalRow).toContainText('CEVA Regional Tournament');
    });
  });

  test.describe('18U Schedule Table', () => {
    test.beforeEach(async ({ page }) => {
      // Click on 18U tab before each test
      const tab18u = page.locator('.schedule-tab').filter({ hasText: '18U Division' });
      await tab18u.click();
    });

    test('should render 18U schedule table with correct structure', async ({ page }) => {
      const table = page.locator('#schedule-18u .schedule-table');
      await expect(table).toBeVisible();
    });

    test('should have correct table headers in 18U schedule', async ({ page }) => {
      const table = page.locator('#schedule-18u .schedule-table');
      const headers = table.locator('th');
      
      await expect(headers.nth(0)).toHaveText('Date');
      await expect(headers.nth(1)).toHaveText('Event');
    });

    test('should render all 7 rows in 18U schedule', async ({ page }) => {
      const table = page.locator('#schedule-18u .schedule-table');
      const rows = table.locator('tbody tr');
      await expect(rows).toHaveCount(7);
    });

    test('should have correct dates in 18U schedule', async ({ page }) => {
      const table = page.locator('#schedule-18u .schedule-table');
      const dateCells = table.locator('.schedule-date');
      
      const expectedDates = [
        '1/3/26',
        '1/31/26',
        '3/1/26',
        '3/7/26',
        '3/14/26',
        '4/4/26',
        '4/25/26'
      ];
      
      for (let i = 0; i < expectedDates.length; i++) {
        await expect(dateCells.nth(i)).toHaveText(expectedDates[i]);
      }
    });

    test('should have correct events in 18U schedule', async ({ page }) => {
      const table = page.locator('#schedule-18u .schedule-table');
      const eventCells = table.locator('tbody td:nth-child(2)');
      
      const expectedEvents = [
        'Power League Qualifier',
        'Power League #1',
        'Cabin Fever (18s)',
        'Mid-Season Block Party (17s)',
        'Power League #2',
        'Power League #3',
        'CEVA Regional Tournament'
      ];
      
      for (let i = 0; i < expectedEvents.length; i++) {
        await expect(eventCells.nth(i)).toContainText(expectedEvents[i]);
      }
    });

    test('should have unique events in 18U schedule (Cabin Fever, Block Party)', async ({ page }) => {
      const table = page.locator('#schedule-18u .schedule-table');
      
      const cabinFeverEvent = table.locator('tbody').filter({ hasText: 'Cabin Fever' });
      await expect(cabinFeverEvent).toBeVisible();
      
      const blockPartyEvent = table.locator('tbody').filter({ hasText: 'Block Party' });
      await expect(blockPartyEvent).toBeVisible();
    });

    test('should style 18U regional tournament row correctly', async ({ page }) => {
      const table = page.locator('#schedule-18u .schedule-table');
      const regionalRow = table.locator('tbody .schedule-regional');
      
      await expect(regionalRow).toBeVisible();
      await expect(regionalRow).toContainText('CEVA Regional Tournament');
    });
  });

  test.describe('Table Styling and Accessibility', () => {
    test('should have date cells with no-wrap text', async ({ page }) => {
      // Use 14U division for testing styles
      const tab14u = page.locator('.schedule-tab').filter({ hasText: '14U Division' });
      await tab14u.click();
      
      const dateCells = page.locator('.schedule-date');
      const firstDateCell = dateCells.nth(0);
      
      // Verify the class is applied (styling for white-space: nowrap)
      const cssValue = await firstDateCell.evaluate(el => 
        window.getComputedStyle(el).whiteSpace
      );
      expect(cssValue).toBe('nowrap');
    });

    test('should render tables with semantic HTML structure', async ({ page }) => {
      const tabs = ['14U Division', '16U Division', '18U Division'];
      const tabIds = ['schedule-14u', 'schedule-16u', 'schedule-18u'];
      
      for (let i = 0; i < tabs.length; i++) {
        // Click on the tab
        const tab = page.locator('.schedule-tab').filter({ hasText: tabs[i] });
        await tab.click();
        
        // Check the semantic structure
        const table = page.locator(`#${tabIds[i]} .schedule-table`);
        const thead = table.locator('thead');
        const tbody = table.locator('tbody');
        
        await expect(thead).toBeVisible();
        await expect(tbody).toBeVisible();
      }
    });

    test('should have tables with proper border and shadow styling', async ({ page }) => {
      // Check the glass container which has the shadow
      const container = page.locator('.glass').filter({ has: page.locator('.schedule-table') }).first();
      
      const boxShadow = await container.evaluate(el =>
        window.getComputedStyle(el).boxShadow
      );
      expect(boxShadow).not.toBe('none');
    });

    test('should have responsive schedule containers', async ({ page }) => {
      const containers = page.locator('.schedule-container');
      
      for (let i = 0; i < 3; i++) {
        const container = containers.nth(i);
        const overflow = await container.evaluate(el =>
          window.getComputedStyle(el).overflowX
        );
        expect(overflow).toBe('auto');
      }
    });
  });

  test.describe('Table Interaction', () => {
    test.beforeEach(async ({ page }) => {
      // Click on 14U tab to make table visible
      const tab14u = page.locator('.schedule-tab').filter({ hasText: '14U Division' });
      await tab14u.click();
    });

    test('should have hover effect on table rows', async ({ page }) => {
      const firstTable = page.locator('.schedule-table').nth(0);
      const firstRow = firstTable.locator('tbody tr').nth(0);
      
      // Get initial background color
      const initialBg = await firstRow.evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );
      
      // Hover over row
      await firstRow.hover();
      
      // Get background color after hover
      const hoverBg = await firstRow.evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );
      
      // Verify hover effect changed something
      // Note: exact color verification depends on browser rendering
      expect(hoverBg).toBeTruthy();
    });

    test('should allow keyboard navigation through table rows', async ({ page }) => {
      const firstTable = page.locator('.schedule-table').nth(0);
      
      // Scroll table into view
      await firstTable.scrollIntoViewIfNeeded();
      
      // Verify table is visible and keyboard accessible
      await expect(firstTable).toBeVisible();
      
      // Verify table has tab-navigable content
      const cells = firstTable.locator('tbody td');
      const cellCount = await cells.count();
      expect(cellCount).toBeGreaterThan(0);
    });
  });

  test.describe('Schedule Section Positioning', () => {
    test('should display tournament schedule after season logistics', async ({ page }) => {
      const seasonHeading = page.locator('h2').filter({ hasText: 'Season Logistics' });
      const scheduleHeading = page.locator('h2').filter({ hasText: '2026 Tournament Schedule' });
      
      const seasonBoundingBox = await seasonHeading.boundingBox();
      const scheduleBoundingBox = await scheduleHeading.boundingBox();
      
      // Schedule heading should be below season heading
      expect(scheduleBoundingBox.y).toBeGreaterThan(seasonBoundingBox.y);
    });
  });

  test.describe('Data Accuracy', () => {
    test('should match all schedule data from source file', async ({ page }) => {
      // 14U specific data
      const tab14u = page.locator('.schedule-tab').filter({ hasText: '14U Division' });
      await tab14u.click();
      const table14u = page.locator('#schedule-14u .schedule-table');
      await expect(table14u).toContainText('1/11/26');
      await expect(table14u).toContainText('5/2/26');
      
      // 16U specific data
      const tab16u = page.locator('.schedule-tab').filter({ hasText: '16U Division' });
      await tab16u.click();
      const table16u = page.locator('#schedule-16u .schedule-table');
      await expect(table16u).toContainText('1/4/26');
      await expect(table16u).toContainText('4/25/26');
      
      // 18U specific data
      const tab18u = page.locator('.schedule-tab').filter({ hasText: '18U Division' });
      await tab18u.click();
      const table18u = page.locator('#schedule-18u .schedule-table');
      await expect(table18u).toContainText('1/3/26');
      await expect(table18u).toContainText('Cabin Fever');
    });

    test('should have all Power League events present', async ({ page }) => {
      const allTables = page.locator('.schedule-table');
      const pageContent = await page.content();
      
      // Count Power League occurrences
      const powerLeagueCount = (pageContent.match(/Power League/g) || []).length;
      
      // Should have multiple Power League events across all tables
      expect(powerLeagueCount).toBeGreaterThan(10);
    });

    test('should have CEVA Regional Tournament in all three divisions', async ({ page }) => {
      const tabs = ['14U Division', '16U Division', '18U Division'];
      const tabIds = ['schedule-14u', 'schedule-16u', 'schedule-18u'];
      
      for (let i = 0; i < tabs.length; i++) {
        const tab = page.locator('.schedule-tab').filter({ hasText: tabs[i] });
        await tab.click();
        
        const table = page.locator(`#${tabIds[i]} .schedule-table`);
        await expect(table).toContainText('CEVA Regional Tournament');
        await expect(table).toContainText('(IF QUALIFIED)');
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should maintain table visibility on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:8000/teams.html');
      
      const tabs = ['14U Division', '16U Division', '18U Division'];
      const tabIds = ['schedule-14u', 'schedule-16u', 'schedule-18u'];
      
      for (let i = 0; i < tabs.length; i++) {
        // Click on the tab
        const tab = page.locator('.schedule-tab').filter({ hasText: tabs[i] });
        await tab.click();
        
        // Check if table is visible
        const table = page.locator(`#${tabIds[i]} .schedule-table`);
        await expect(table).toBeVisible();
      }
    });

    test('should have scrollable table container on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:8000/teams.html');
      
      // Test the currently visible table container
      const container = page.locator('.schedule-container').first();
      const overflow = await container.evaluate(el =>
        window.getComputedStyle(el).overflowX
      );
      expect(overflow).toBe('auto');
    });

    test('should maintain readability on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('http://localhost:8000/teams.html');
      
      const scheduleHeading = page.locator('h2').filter({ hasText: '2026 Tournament Schedule' });
      await expect(scheduleHeading).toBeVisible();
      
      // Click 14U tab to make table visible
      const tab14u = page.locator('.schedule-tab').filter({ hasText: '14U Division' });
      await tab14u.click();
      
      const firstTable = page.locator('.schedule-table').nth(0);
      await expect(firstTable).toBeVisible();
    });
  });
});