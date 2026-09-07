const { test, expect } = require('@playwright/test');

async function getStructuredData(page) {
  return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
    scripts.map((script) => JSON.parse(script.textContent || '{}'))
  );
}

test.describe('SEO metadata', () => {
  const publicPageMetadata = [
    {
      path: '/teams',
      title: 'Girls Volleyball Teams & Tryouts in Hillsboro — TVVC',
      description: 'TVVC offers 12U-18U girls club volleyball teams in Hillsboro, OR with local practices, CEVA tournaments, clear costs, and development-first coaching.',
    },
    {
      path: '/tryouts',
      title: 'Club Volleyball Tryouts & Prep Clinics — TVVC',
      description: 'TVVC 2026-2027 club volleyball tryouts and tryout prep clinics in Hillsboro, OR for 12U-18U athletes preparing for the CEVA season.',
    },
    {
      path: '/programs',
      title: 'In-House Youth Volleyball Programs — TVVC',
      description: 'TVVC in-house volleyball programs in Hillsboro, OR: Ignition for 4th-6th graders and PlayWorks for middle school athletes building skills through play.',
    },
    {
      path: '/summer-camps-clinics',
      title: 'Volleyball Camps & Clinics in Hillsboro — TVVC',
      description: 'TVVC volleyball camps and clinics in Hillsboro, OR, including Girls Club Prep, tryout prep, skill clinics, and game-based youth volleyball training.',
    },
    {
      path: '/boys-volleyball',
      title: 'Boys Volleyball Interest in Hillsboro — TVVC',
      description: 'TVVC is gathering family interest for potential boys volleyball opportunities in Hillsboro, OR for the 2026-2027 season.',
    },
    {
      path: '/register',
      title: 'Volleyball Event Registration — TVVC',
      description: 'Register for open TVVC volleyball clinics, camps, and tryout prep events in Hillsboro, OR.',
    },
    {
      path: '/events',
      title: 'May ShinDig Volleyball Tournament — TVVC',
      description: 'TVVC May ShinDig is an end-of-season volleyball tournament in Hillsboro, OR for 14U and 16U teams looking for a competitive season wrap-up.',
    },
  ];

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

  for (const pageMetadata of publicPageMetadata) {
    test(`${pageMetadata.path} uses targeted title, description, and clean canonical URL`, async ({ page }) => {
      await page.goto(pageMetadata.path);

      await expect(page).toHaveTitle(pageMetadata.title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', pageMetadata.description);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://tualatinvalleyvb.com${pageMetadata.path}`
      );
    });
  }

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
