Tone & Voice: Be casual, witty, and direct. Sarcasm is welcome, as long as it doesn’t get in the way of clarity. Feel free to use jokes, analogies, or pop culture references when it fits. Avoid being overly formal or robotic.

Response Detail Level: Give thorough and thoughtful responses for complex or conceptual topics (e.g., app architecture, debugging weird issues, philosophical coaching frameworks). But keep things snappy for basic or procedural stuff (e.g., terminal commands, small code edits).

Assume expertise: Treat me like I know what I’m doing unless I ask for something explained like I’m five. Skip the hand-holding and "you might not know this..." disclaimers.

Preferred Language & Tools: I mostly use JavaScript/HTML/CSS, Tailwind, Firebase, and Node.js. Also using Bubble and Replit for low-code/no-code projects. Tailor responses to these tools unless told otherwise. I work primarily in English.

Preferred Use Cases: I’m building apps for volleyball coaching and club management (payment systems, stat tracking, practice planning), plus some creative/AI storytelling tools (image generation, zine layouts, etc.).

Design Style: For UI/UX, I like clean, modern designs with dark mode by default. Rounded corners, bold fonts, intuitive flows. Function over fluff, but aesthetics still matter.

Don’t do this: Avoid moralizing, giving lectures, or telling me what I "should" do unless it’s a major safety/security issue. Also, skip over-explaining obvious stuff unless I specifically ask for more detail.

# TVVC Website Information

## Club-season payment project handoff

Before changing the club-season registration, invitation, payment-plan, billing, or finance workflows, read [docs/CODEX_TVVC_PAYMENT_PROJECT_HANDOFF.md](./docs/CODEX_TVVC_PAYMENT_PROJECT_HANDOFF.md). It contains the current production state, confirmed business rules, safety boundaries, November launch sequence, and resumption checklist for a new Codex task or computer.

## Summary
The **TVVC Website** is the official online presence for the Tualatin Valley Volleyball Club, a non-profit organization in Hillsboro, OR (2820 SE 58th Court). It is a **modern static website** built using **Astro**, **React**, and **Tailwind CSS**. It uses **Playwright** for E2E testing and is deployed via **Netlify**.

## Structure
- [**./src/pages/**](./src/pages/): Contains site routes (Astro components).
- [**./src/pages/api/**](./src/pages/api/): Backend API endpoints (Registration, Webhooks).
- [**./src/pages/admin/**](./src/pages/admin/): Passcode-protected administration tools.
- [**./src/components/**](./src/components/): Reusable UI components (React/Astro).
- [**./src/db/**](./src/db/): Database schema, client, and seeding scripts.
- [**./src/layouts/**](./src/layouts/): Page templates like `BaseLayout.astro`.
- [**./public/assets/**](./public/assets/): Static resources like images and legacy styles.
- [**./tests/**](./tests/): Comprehensive end-to-end test suite using Playwright.

## Language & Runtime
**Language**: JavaScript, Astro, JSX, TypeScript  
**Runtime**: Node.js 22.12+  
**Framework**: Astro 7.0+  
**Database**: Drizzle ORM + LibSQL (Turso)  
**Payments**: Stripe SDK  
**Styling**: Tailwind CSS  
**Package Manager**: npm  
**Registration Status**: Summer camp and non-tryout-prep clinic registration is **closed**. Only upcoming Tryout Prep clinic registration is currently open. Club-season registration remains deployed dark and closed.

## Dependencies
**Main Dependencies**:
- **astro**: ^7.1.3
- **drizzle-orm**: ^0.45.2
- **@libsql/client**: ^0.17.3
- **stripe**: ^22.1.1
- **react**: ^19.2.5
- **tailwindcss**: ^3.4.19
- **framer-motion**: ^12.38.0
- **uuid**: ^14.0.0

**Development Dependencies**:
- **@playwright/test**: ^1.56.1
- **drizzle-kit**: ^0.31.10
- **tsx**: ^4.22.0

## Build & Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Testing
**Framework**: Playwright  
**Test Location**: [**./tests/**](./tests/)  
**Naming Convention**: `*.spec.js`  
**Configuration**: [**./playwright.config.js**](./playwright.config.js)

**Key Test Suites**:
- [**./tests/core-values.spec.js**](./tests/core-values.spec.js): Validates the homepage core values section.
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

## Main Pages
- [**./src/pages/index.astro**](./src/pages/index.astro): Primary homepage.
- [**./src/pages/teams.astro**](./src/pages/teams.astro): Displays current rosters and tournament schedules (Club Teams).
- [**./src/pages/programs.astro**](./src/pages/programs.astro): Information on club programs (In-House Programs).
- [**./src/pages/summer-camps-clinics.astro**](./src/pages/summer-camps-clinics.astro): Summer training schedules.
- [**./src/pages/outdoor-events.astro**](./src/pages/outdoor-events.astro): Information on outdoor volleyball; intentionally hidden from public navigation while unused.
- [**./src/pages/events.astro**](./src/pages/events.astro): Seasonal events (May Shindig).
- [**./src/pages/faq.astro**](./src/pages/faq.astro): Frequently Asked Questions.

## CSS Architecture & Design System
The project uses **Tailwind CSS** for styling, with a centralized design system:
- **Design Tokens**: Configured in [**./tailwind.config.mjs**](./tailwind.config.mjs).
  - **Colors**: Teal (`#009695`), Coral (`#E85D4E`), Charcoal (`#1A1A1A`).
- **Global Styles**: Defined in [**./src/styles/globals.css**](./src/styles/globals.css).
