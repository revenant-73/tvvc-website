# TVVC Website Repository Info

## Project Overview
Static HTML website for Tualatin Valley Volleyball Club. Built with vanilla HTML/CSS and hosted via Python HTTP server. All common CSS is centralized in a shared external stylesheet to eliminate duplication across pages.

## Tech Stack
- **Frontend:** HTML, CSS (no framework)
- **Testing Framework:** Playwright
- **Server:** Python `http.server` (port 8000)
- **CSS Architecture:** Centralized stylesheet with design tokens (CSS variables) and page-specific inline styles

## Directory Structure
```
├── index.html                # Main homepage
├── teams.html                # Teams page (with schedule table styles)
├── programs.html             # Programs page (with highlight box styles)
├── faq.html                  # FAQ page (with FAQ item styles)
├── privacy-policy.html       # Privacy policy page (with policy section styles)
├── assets/                   # Static assets
│   ├── styles.css            # CENTRALIZED SHARED STYLESHEET (all common styles)
│   └── images/               # Page images
├── tests/                    # E2E test files
│   ├── core-values.spec.js   # Homepage core values tests
│   └── tournament-schedule.spec.js # Tournament schedule tests
├── playwright.config.js      # Playwright configuration
└── .zencoder/
    └── rules/
        └── repo.md           # This file
```

## Test Framework: Playwright

### Setup
1. Install Playwright: `npm install -D @playwright/test`
2. Run tests: `npx playwright test`
3. View test results: `npx playwright show-report`

### Test Files Location
- `tests/` directory contains all `.spec.js` files
- Tests are automatically discovered by Playwright

### Running Tests
```bash
# Run all tests
npx playwright test

# Run tests for a specific file
npx playwright test tests/core-values.spec.js

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test
npx playwright test -g "should render all 10 value cards"
```

## Current Tests
- **core-values.spec.js** - E2E tests for the Core Values section on index.html
  - Validates all 10 value cards render correctly
  - Tests emoji icons, titles, and descriptions
  - Verifies colored left borders and hover effects
  - Tests responsive behavior and accessibility
  - Checks semantic HTML structure

## Development Server
Start the dev server for manual testing or test execution:
```bash
python -m http.server 8000
```
Website will be available at `http://localhost:8000`

## Key Selectors Used in Tests
- `.value-card` - Individual value cards
- `.value-icon` - Emoji icon in each card
- `.card-grid.values-grid` - Grid container
- `#values` - Core Values section
- `.value-card h3` - Card heading
- `.value-card p` - Card description

## CSS Architecture & Design System

### Centralized Stylesheet (assets/styles.css)
All shared CSS is contained in `assets/styles.css`, which is linked from every HTML page. This eliminates ~2,500 lines of duplicate CSS that previously existed inline on each page.

**Contents of shared stylesheet:**
- **CSS Design Tokens** (Color palette, typography, spacing scale, border radius, shadows, transitions, container settings)
- **Reset & Base Styles** (Global box-sizing, typography defaults, links, lists)
- **Layout Components** (Container, grid, flexbox utilities)
- **Header & Navigation** (Sticky header, logo, badge, nav links, register button)
- **Hero Section** (Background image, gradients, text styling)
- **Sections** (Main container, padding, alternating backgrounds)
- **Buttons & CTAs** (Multiple button variants with hover states)
- **Utility Classes** (Text styling, spacing utilities, gaps, margins)
- **Footer** (Dark background, links, grid layout, divider)
- **Accessibility** (Skip links, focus states, keyboard navigation)
- **Responsive Design** (Mobile breakpoint at 768px, motion preferences)

### Page-Specific Inline Styles
Each HTML file retains only its unique, page-specific styles in a `<style>` tag:
- **index.html** - No inline styles (all common styles from shared stylesheet)
- **teams.html** - Tournament schedule table styles (table, thead, tbody, tabs, date formatting)
- **programs.html** - Highlight box styling (left border, padding, background)
- **faq.html** - FAQ item cards (borders, padding, hover effects)
- **privacy-policy.html** - Privacy policy sections (bordered cards, metadata styling)

### Design System Tokens (CSS Variables)
All defined in `:root` of `assets/styles.css`:

**Colors:**
- `--color-primary-teal: #00B4B3` (Primary brand color)
- `--color-primary-coral: #FF6F61` (Accent/highlight color)
- `--color-charcoal: #222222` (Text, headers)
- `--color-gray-light: #F3F3F3` (Light backgrounds)
- `--color-gray-medium: #999999` (Secondary text)
- `--color-gray-dark: #555555` (Tertiary text)
- `--color-white: #FFFFFF` (White)

**Typography:**
- `--font-primary: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- `--font-size-base: 16px`, `--font-size-sm: 14px`, `--font-size-lg: 18px`
- Font weights: normal (400), medium (500), semibold (600), bold (700)
- Line heights: base (1.6), tight (1.3)

**Spacing Scale (8px base):**
- `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 16px`
- `--space-lg: 24px`, `--space-xl: 32px`, `--space-2xl: 48px`, `--space-3xl: 64px`

**Other Tokens:**
- Border radius: sm (4px), md (8px), lg (12px), full (999px)
- Shadows: sm, md, lg (with appropriate blur and spread)
- Transitions: fast (150ms), base (200ms), slow (300ms)
- Container max-width: 1000px with responsive padding

## CSS Maintenance Notes
1. **Single source of truth:** Update common styles in `assets/styles.css` only
2. **Page-specific styles:** Keep unique styling in inline `<style>` tags on individual pages
3. **Image paths in CSS:** Since the CSS file is in the `assets/` directory, image paths are relative: `./images/` not `./assets/images/`
4. **Design consistency:** Always use CSS variables for colors, spacing, and typography rather than hardcoded values