// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
require('dotenv').config();
const portalFixtures = require('./tests/portal-fixtures');
const localPort = process.env.PLAYWRIGHT_PORT || '4321';
const localBaseUrl = `http://127.0.0.1:${localPort}`;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  globalSetup: './tests/portal-global-setup.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || localBaseUrl,
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  stdout: 'pipe',
  stderr: 'pipe',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.BASE_URL ? undefined : [
    {
      command: 'node tests/stripe-mock-server.js',
      url: 'http://127.0.0.1:4322/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${localPort} --ignore-lock`,
      url: localBaseUrl,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        APPDATA: path.join(os.tmpdir(), 'tvvc-netlify-test-config'),
        ASTRO_DEV_BACKGROUND: '0',
        ASTRO_TELEMETRY_DISABLED: '1',
        ADMIN_PASSWORD_LOGIN_EMAILS: portalFixtures.admin.email,
        ADMIN_PASSWORD_LOGIN_HASH: 'scrypt:16384:8:1:LQB7zv1A34cNQoYsmvzggA:vXM5oBQWtrStLCvK_ONgh5oeP-9X62ZFsI15Rc0L_hoPzNXd380mzTDUf3jVcgNot2e7jjaq_wp0nuqhOdYcWg',
        AUTH_SECRET: 'playwright-only-auth-secret-not-for-production-use',
        CLUB_SEASON_REGISTRATION_ENABLED: 'false',
        CLUB_SEASON_PILOT_MODE: 'true',
        CLUB_SEASON_PILOT_EMAILS: [
          portalFixtures.parentA.email,
          portalFixtures.parentB.email,
          portalFixtures.clubSeasonPayments.standard.email,
          portalFixtures.clubSeasonPayments.full.email,
          portalFixtures.clubSeasonPayments.custom.email,
        ].join(','),
        CRON_SECRET: 'playwright-only-cron-secret-not-for-production-use',
        PLAYWRIGHT_TEST: '1',
        RESEND_API_KEY: 're_playwright_not_used',
        STRIPE_API_BASE: 'http://127.0.0.1:4322',
        STRIPE_SECRET_KEY: 'sk_test_playwright_not_used',
        STRIPE_WEBHOOK_SECRET: 'whsec_playwright_not_used',
        TURSO_AUTH_TOKEN: '',
        TURSO_DATABASE_URL: portalFixtures.databaseUrl,
      },
    },
  ],
});
