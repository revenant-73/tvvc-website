# TVVC Website

Official website for Tualatin Valley Volleyball Club — a high-quality, affordable volleyball club in Hillsboro, OR offering competitive play with joy.

## 🏐 Features

- **Modern UI** — Built with Astro, Tailwind CSS, and Framer Motion
- **Native Registration System** — Integrated athlete registration and payment processing
- **Responsive Design** — Fully optimized for mobile, tablet, and desktop
- **Performance** — Static site generation for lightning-fast load times
- **Interactive Schedules** — Real-time tournament tracking and team rosters
- **Admin Dashboard** — Passcode-protected management of events and rosters
- **SEO Optimized** — Semantic HTML and proper metadata

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [React](https://reactjs.org/) & [Framer Motion](https://www.framer.com/motion/)
- **Database**: [Turso (LibSQL)](https://turso.tech/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Payments**: [Stripe](https://stripe.com/)
- **Testing**: [Playwright](https://playwright.dev/)
- **Deployment**: [Netlify](https://www.netlify.com/)

## 📦 Getting Started

### Prerequisites

- **Node.js**: v18.17.1 or higher
- **npm**: v9.6.7 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/revenant-73/tvvc-website.git
cd tvvc-website

# Install dependencies
npm install
```

### Development

Start the local development server:

```bash
npm run dev
```

The website will be available at `http://localhost:4321`.

### Build

Create a production-ready build in the `dist/` directory:

```bash
npm run build
```

### Testing

Run the end-to-end test suite:

```bash
# Run all tests
npm test

# Run tests in headed mode
npm run test:headed

# Open Playwright UI
npm run test:ui
```

## 📁 Project Structure

```
.
├── src/
│   ├── components/      # Reusable React/Astro components
│   ├── db/              # Database schema and migration scripts
│   ├── layouts/         # Page templates (BaseLayout)
│   ├── pages/           # Site routes (including API and Admin)
│   └── styles/          # Global CSS and Tailwind directives
├── public/              # Static assets (images, icons)
├── tests/               # Playwright E2E tests
├── astro.config.mjs     # Astro configuration
├── tailwind.config.mjs  # Tailwind configuration
├── drizzle.config.ts    # Drizzle ORM configuration
└── netlify.toml         # Netlify deployment configuration
```

## 🗄️ Database Management

The project uses Drizzle ORM to manage the SQLite (LibSQL) database.

```bash
# Generate migrations
npm run db:generate

# Push changes to database
npm run db:push

# Open Drizzle Studio to view data
npm run db:studio

# Seed database with events from frontend
npm run db:seed
```

## 🚀 Deployment

The site is automatically deployed to Netlify on every push to the `main` branch.

**Deployment Configuration:**
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`

[View Live Site](https://tualatinvalleyvb.com)

## 📝 License

All rights reserved. TVVC Website © 2024.

## 📧 Contact

For questions about TVVC, visit the website or check the FAQ page.
