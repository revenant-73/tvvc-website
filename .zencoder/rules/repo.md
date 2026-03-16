---
description: Repository Information Overview
alwaysApply: true
---

# TVVC Website Information

## Summary
The **TVVC Website** is the official online presence for the Tualatin Valley Volleyball Club, a non-profit organization in Hillsboro, OR. It is a **static website** built using vanilla **HTML5**, **CSS3**, and **JavaScript**, designed for simplicity, performance, and maintainability. The project uses **Playwright** for end-to-end testing and is optimized for deployment via **Netlify**.

## Structure
- **Root**: Contains all main entry points and static HTML files (e.g., [**./index.html**](./index.html), [**./teams.html**](./teams.html)).
- [**./assets/**](./assets/): Shared resources including the centralized [**./assets/styles.css**](./assets/styles.css) and [**./assets/menu-toggle.js**](./assets/menu-toggle.js).
- [**./assets/images/**](./assets/images/): Directory for all image assets used across the site.
- [**./tests/**](./tests/): Comprehensive end-to-end test suite using Playwright.
- [**./.zencoder/**](./.zencoder/): Contains AI-specific rules and development workflows (excluded via `.gitignore`).

## Language & Runtime
**Language**: HTML5, CSS3, Vanilla JavaScript  
**Runtime**: Node.js 16+ (Testing environment), Python 3.6+ (Local development server)  
**Build System**: Static site (Direct deployment)  
**Package Manager**: npm (v10.9.2 or compatible)
**Registration Status**: Summer 2026 Registration is now **OPEN**.

## Dependencies
**Main Dependencies**:
- None (Purely static site).

**Development Dependencies**:
- **@playwright/test**: ^1.56.1 (End-to-end testing framework)

## Build & Installation
```bash
# Install testing dependencies
npm install

# Start local development server (default port 8000)
python -m http.server 8000
```

## Testing
**Framework**: Playwright  
**Test Location**: [**./tests/**](./tests/)  
**Naming Convention**: `*.spec.js`  
**Configuration**: [**./playwright.config.js**](./playwright.config.js)

**Key Test Suites**:
- [**./tests/core-values.spec.js**](./tests/core-values.spec.js): Validates the homepage core values section and responsiveness.
- [**./tests/tournament-schedule.spec.js**](./tests/tournament-schedule.spec.js): Verifies tournament schedule table rendering and data accuracy.
- [**./tests/mobile-navigation.spec.js**](./tests/mobile-navigation.spec.js): Tests the interactive mobile navigation menu.

**Run Commands**:
```bash
# Run all tests
npm test

# Run tests in headed mode
npm run test:headed

# Run tests with Playwright UI
npm run test:ui
```

## Main Files & Resources
- [**./index.html**](./index.html): Primary homepage with hero section and core values.
- [**./teams.html**](./teams.html): Displays current rosters and tournament schedules.
- [**./programs.html**](./programs.html): Information on club programs and tryouts.
- [**./faq.html**](./faq.html): Frequently Asked Questions with interactive cards.
- [**./netlify.toml**](./netlify.toml): Netlify configuration for deployment and headers.
- [**./assets/styles.css**](./assets/styles.css): Centralized design tokens (colors, spacing, typography) and common layout styles.
- [**./assets/menu-toggle.js**](./assets/menu-toggle.js): Logic for the responsive mobile navigation menu.

## CSS Architecture & Design System
The project follows a "Shared Core, Page-Specific Extensions" strategy:
- **Design Tokens**: Centralized in `:root` of [**./assets/styles.css**](./assets/styles.css) using CSS variables.
  - **Colors**: Teal (`#009695`), Coral (`#E85D4E`), Charcoal (`#1A1A1A`).
  - **Spacing**: 8px base scale (e.g., `--space-md: 16px`).
- **Shared Styles**: Global resets, header/footer layouts, and common components (buttons, sections) are defined in the shared stylesheet.
- **Page-Specific Styles**: Unique styling for specific components (like tournament tables or FAQ cards) are contained within `<style>` blocks in the respective HTML files.
