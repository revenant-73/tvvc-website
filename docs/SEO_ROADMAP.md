# TVVC SEO Roadmap

Last updated: September 7, 2026

This roadmap captures the practical SEO work for the TVVC public website. The goal is not to chase gimmicks. The goal is to make the site easier for families to find, easier for search engines to understand, and less noisy for crawlers.

## Current Baseline

- Astro sitemap generation is already installed.
- Public pages already use `BaseLayout` for page titles, descriptions, canonical links, Open Graph, and Twitter card tags.
- Private/admin flows already support `noindex` through `BaseLayout`.
- The public site has useful local content around teams, tryouts, camps, clinics, programs, FAQ, and boys volleyball interest.
- Google has seen both clean URLs and `.html` variants, so canonical consistency matters.

## Phase 1: Technical Crawl Hygiene

Status: started

- [x] Normalize canonical URLs to clean paths instead of generated `.html` paths.
- [x] Use the clean canonical URL for Open Graph and Twitter URL metadata.
- [x] Add `robots.txt` with sitemap discovery and crawl exclusions for private/non-search routes.
- [x] Tighten sitemap generation so it excludes admin, portal, account-only, thank-you, success, offline, redirected, and dark-launch pages.
- [x] Add `noindex` to thank-you, success, offline, and 404 pages.
- [x] Add Netlify 301 redirects from `.html` URLs to clean URLs.
- [ ] After deployment, verify live redirects for `/index.html`, `/teams.html`, `/faq.html`, and `/boys-volleyball/thanks.html`.
- [ ] Submit or re-submit `https://tualatinvalleyvb.com/sitemap-index.xml` in Google Search Console.
- [ ] Use Google Search Console URL Inspection for the homepage, `/teams`, `/tryouts`, `/programs`, `/summer-camps-clinics`, `/boys-volleyball`, and `/faq`.

## Phase 2: Structured Data

Status: started

- [x] Add sitewide JSON-LD for TVVC as a local volleyball organization/business with name, URL, logo, image, phone, email, address, geo coordinates, sport, and local service areas.
- [x] Add FAQPage JSON-LD to the FAQ page from the existing question/answer content.
- [x] Add FAQPage JSON-LD to the boys volleyball interest page from the existing public FAQ content.
- [ ] Validate deployed structured data with Google's Rich Results Test.
- [ ] Add Event structured data later for tryouts, camps, clinics, and tournaments once event dates, locations, registration URLs, and availability rules are stable.
- [ ] Add BreadcrumbList structured data if the site adds deeper public content paths.

## Phase 3: Search-Focused Page Metadata

Status: started

- [x] Replace the homepage title from generic `Home` to `Tualatin Valley Volleyball Club`.
- [x] Replace the homepage description with a stronger local youth-volleyball snippet.
- [x] Improve FAQ title/description around parent search intent.
- [ ] Review and sharpen titles/descriptions for `/teams`, `/tryouts`, `/programs`, `/summer-camps-clinics`, `/boys-volleyball`, and `/events`.
- [ ] Keep each page title unique, direct, and tied to one primary search intent.
- [ ] Avoid overstuffing keyword phrases. Write for parents first; Google is not impressed by word salad in a tracksuit.

## Phase 4: Local Search Content

Status: recommended backlog

Create useful pages or sections for real parent/player searches:

- [ ] Volleyball club in Hillsboro, OR.
- [ ] Youth volleyball tryouts in Hillsboro.
- [ ] Girls volleyball club teams for 12U-18U.
- [ ] Boys volleyball interest and potential boys programming.
- [ ] Volleyball camps and clinics near Hillsboro and Beaverton.
- [ ] Beginner volleyball training for middle school athletes.
- [ ] CEVA club volleyball overview for new families.
- [ ] Age-group eligibility guide for the 2026-2027 season.
- [ ] Parent guide to club volleyball costs, travel, and commitment.

These should be practical resources, not fake blog filler. A useful parent guide will beat five thin SEO pages every time.

## Phase 5: Local Business Trust Signals

Status: operational follow-up

- [ ] Fully update the Google Business Profile: category, address, phone, website, hours, photos, services, and seasonal posts.
- [ ] Add real facility/team photos over time with descriptive filenames and accurate alt text.
- [ ] Confirm NAP consistency everywhere: Tualatin Valley Volleyball Club, 2820 SE 58th Court, Hillsboro, OR 97123, and the primary phone/email.
- [ ] Build legitimate local backlinks from CEVA, partner schools, event listings, sponsors, community directories, and local sports resources.
- [ ] Encourage families to review TVVC on Google after real participation, without gating, scripting, or bribing reviews.

## Phase 6: Measurement

Status: recommended backlog

- [ ] Configure Google Search Console if it is not already active.
- [ ] Track indexed pages, queries, click-through rate, and crawl/indexing issues monthly.
- [ ] Track local discovery separately from registration conversion. Ranking for "volleyball club Hillsboro" is useful only if families actually find the right next step.
- [ ] Use Lighthouse/PageSpeed after larger UI or image changes, but do not treat Lighthouse as the whole SEO game.
- [ ] Watch for stale seasonal pages after tryouts/camps close, then update copy instead of leaving old registration language indexed.

## Guardrails

- Keep admin, portal, private registration, payment, invitation, success, and account pages out of public search.
- Do not publish dark-launch club-season registration content into sitemap/navigation until launch is intentionally approved.
- Do not mark up fake reviews, fake ratings, or business claims that are not visible and true on the page.
- Do not create thin location-doorway pages for nearby cities unless the page provides specific, useful content for those families.
