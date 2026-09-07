const { test, expect } = require('@playwright/test');

async function getStructuredData(page) {
  return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
    scripts.map((script) => JSON.parse(script.textContent || '{}'))
  );
}

test.describe('SEO metadata', () => {
  test('homepage uses a local search title, clean canonical URL, and organization structured data', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Tualatin Valley Volleyball Club — TVVC');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Youth volleyball club in Hillsboro, OR offering competitive teams, tryouts, camps, clinics, and player-centered training for Tualatin Valley athletes.'
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://tualatinvalleyvb.com/');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://tualatinvalleyvb.com/');

    const structuredData = await getStructuredData(page);
    const organization = structuredData.find((entry) => {
      const types = Array.isArray(entry['@type']) ? entry['@type'] : [entry['@type']];
      return types.includes('LocalBusiness') && types.includes('SportsOrganization');
    });

    expect(organization).toBeTruthy();
    expect(organization.name).toBe('Tualatin Valley Volleyball Club');
    expect(organization.address.addressLocality).toBe('Hillsboro');
    expect(organization.sport).toBe('Volleyball');
  });

  test('FAQ page exposes FAQPage structured data', async ({ page }) => {
    await page.goto('/faq');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://tualatinvalleyvb.com/faq');

    const structuredData = await getStructuredData(page);
    const faq = structuredData.find((entry) => entry['@type'] === 'FAQPage');

    expect(faq).toBeTruthy();
    expect(faq.mainEntity.length).toBeGreaterThan(10);
    expect(faq.mainEntity.some((item) => item.name === 'What is club volleyball?')).toBe(true);
  });

  test('boys volleyball page exposes interest FAQ structured data', async ({ page }) => {
    await page.goto('/boys-volleyball');

    const structuredData = await getStructuredData(page);
    const faq = structuredData.find((entry) => entry['@type'] === 'FAQPage');

    expect(faq).toBeTruthy();
    expect(faq.mainEntity).toHaveLength(4);
    expect(faq.mainEntity.some((item) => item.name === 'Is this registration?')).toBe(true);
  });

  test('utility confirmation page stays out of the index', async ({ page }) => {
    await page.goto('/boys-volleyball/thanks');

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://tualatinvalleyvb.com/boys-volleyball/thanks');
  });

  test('robots.txt advertises the sitemap and excludes private routes', async ({ request }) => {
    const response = await request.get('/robots.txt');

    expect(response.ok()).toBe(true);
    const text = await response.text();

    expect(text).toContain('Sitemap: https://tualatinvalleyvb.com/sitemap-index.xml');
    expect(text).toContain('Disallow: /admin/');
    expect(text).toContain('Disallow: /portal/');
    expect(text).toContain('Disallow: /season-registration');
    expect(text).toContain('Disallow: /boys-volleyball/thanks');
  });
});
