# TVVC Website Repository Info

## Project Overview
Static HTML website for Tualatin Valley Volleyball Club. Built with vanilla HTML/CSS and hosted via Python HTTP server.

## Tech Stack
- **Frontend:** HTML, CSS (no framework)
- **Testing Framework:** Playwright
- **Server:** Python `http.server` (port 8000)

## Directory Structure
```
├── index.html           # Main homepage
├── teams.html           # Teams page
├── programs.html        # Programs page
├── faq.html            # FAQ page
├── assets/             # Images and static assets
│   └── images/
├── tests/              # E2E test files
│   └── core-values.spec.js
├── playwright.config.js # Playwright configuration
└── .zencoder/
    └── rules/
        └── repo.md     # This file
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

## Design System Tokens (CSS Variables)
- **Colors:**
  - `--color-primary-teal: #00B4B3`
  - `--color-primary-coral: #FF6F61`
  - Custom orange: `#FF9A56`
- **Spacing:**
  - `--space-md: 16px`
  - `--space-lg: 24px`
- **Typography:**
  - `--font-size-sm: 14px`
  - `--font-size-base: 16px`