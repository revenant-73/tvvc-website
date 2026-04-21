# Testing Standards & Maintenance

This document outlines the testing strategy for the TVVC Website and provides guidance on maintaining test stability during future refactors.

## Overview

We use **Playwright** for end-to-end testing. The test suite is designed to verify core functionality, responsiveness, and accessibility across the site.

## Key DOM IDs & Classes to Preserve

To prevent tests from breaking, the following IDs and classes should be maintained in the components:

### Header / Navigation
- `#mobile-menu-toggle`: The button that toggles the mobile navigation menu.
- `#mobile-menu`: The container for the mobile navigation links.
- `aria-expanded`: Must be updated on the toggle button for accessibility tests.

### Homepage (index.astro)
- `.glass-card`: Used to identify value cards and program cards in the Bento grid.
- `h4`: Used for individual value titles within the "Core Principles" section.
- `h2`: Used for section headings.

### Tournament Schedules (teams.astro)
- `.schedule-tab`: The clickable tabs used to switch between age groups.
- `.schedule-table`: The table container for tournament data.

## Running Tests

### Local Development
1. **Build the site**: `npm run build`
2. **Run tests**: `npm test`

The test runner is configured to serve the `dist/` directory using Python's `http.server`. Ensure `astro.config.mjs` has `build.format: 'file'` to maintain `.html` extensions that match existing test paths.

## Best Practices for Future Changes

1. **Keep IDs Consistent**: If you must change an ID, update the corresponding test in `tests/*.spec.js`.
2. **Semantic HTML**: Use proper heading levels (`h1`-`h4`) as tests often rely on these for structure validation.
3. **Accessibility**: Maintain `aria-` attributes as they are used to verify interactive state changes.
4. **Responsive Testing**: Avoid changing the `lg` breakpoint (1024px) without updating the responsive test cases.
