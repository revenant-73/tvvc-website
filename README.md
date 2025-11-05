# TVVC Website

Official website for Tualatin Valley Volleyball Club — a high-quality, affordable volleyball club in Hillsboro, OR offering competitive play with joy.

## 🏐 Features

- **Homepage** (`index.html`) — Hero section, core values, call-to-action
- **Teams** (`teams.html`) — Current rosters and team information
- **Programs** (`programs.html`) — Available programs and tryouts
- **FAQ** (`faq.html`) — Frequently asked questions

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (vanilla, no framework)
- **Testing**: Playwright
- **Server**: Python `http.server` (port 8000)
- **Deployment**: Netlify

## 📦 Getting Started

### Prerequisites
- Node.js 16+ (for Playwright tests)
- Python 3.6+ (for local server)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/revenant-73/tvvc-website.git
cd tvvc-website

# Install Playwright
npm install
```

### Development

Start the local development server:

```bash
python -m http.server 8000
```

Website will be available at `http://localhost:8000`

### Testing

Run Playwright tests:

```bash
# Run all tests
npx playwright test

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/core-values.spec.js

# View test results
npx playwright show-report
```

## 📁 Project Structure

```
.
├── index.html                 # Homepage
├── teams.html                 # Teams page
├── programs.html              # Programs page
├── faq.html                   # FAQ page
├── playwright.config.js       # Playwright configuration
├── assets/
│   └── images/               # All image assets
├── tests/
│   ├── core-values.spec.js   # Homepage core values tests
│   └── tournament-schedule.spec.js
├── README.md
└── .gitignore
```

## 🎨 Design System

CSS variables are defined in each HTML file's `<style>` block:

- **Colors**: Teal (#00B4B3), Coral (#FF6F61), Charcoal (#222222)
- **Spacing**: 8px base scale (4px, 8px, 16px, 24px, 32px, 48px, 64px)
- **Typography**: System font stack, responsive sizing
- **Radius**: 4px, 8px, 12px, full
- **Shadows**: sm, md, lg

## 🚀 Deployment

The site is automatically deployed to Netlify on every push to `main`.

[View Live](https://tvvc-website.netlify.app)

## 📝 License

All rights reserved. TVVC Website © 2024.

## 📧 Contact

For questions about TVVC, visit the website or check the FAQ page.