# Registration System and Parent Portal Audit

Audit completed July 31, 2026 against the production-aligned `main` branch and
the deployed Netlify site.

## Validation baseline

- Focused registration and portal tests: 27 passed.
- Unit security and migration tests: 5 passed.
- Production build: passed.
- Production dependency audit: zero known vulnerabilities.
- Production correctly redirects unauthenticated portal routes to login.

## Remediation roadmap

### Payment and capacity integrity

- [x] Reject inactive, expired, and unknown events in the registration API and
  hide expired events from every public registration form.
- [x] Make Stripe webhook processing idempotent so retries cannot double-count
  capacity or resend confirmations.
- [ ] Reserve capacity with atomic conditional database updates to prevent two
  checkouts from claiming the final spot.
- [ ] Align database and Stripe Checkout expiration, handle
  `checkout.session.expired`, and release abandoned reservations promptly.

### Administration and abuse resistance

- [ ] Replace browser-supplied admin passcodes with authenticated admin-session
  authorization; remove hardcoded fallbacks and make cron authentication fail
  closed.
- [ ] Add registration rate limiting or bot protection plus bounded request
  sizes, athlete counts, event counts, and metadata.
- [ ] Make cancellation, removal, transfer, refund, and capacity updates
  transactional and auditable.

### Identity and browser security

- [ ] Reconcile signed-in registration contact email with the verified portal
  identity or require an explicit verified alternate-contact workflow.
- [ ] Apply the configured CSP, frame, and referrer headers to SSR responses as
  well as static pages.
- [ ] Normalize and enforce unique authentication emails after auditing existing
  user records for collisions.

### Delivery safeguards

- [ ] Add pull-request CI for unit, registration, and portal tests; repair the
  stale mobile-navigation expectations so the complete suite is reliably green.
- [ ] Add capacity reconciliation, structured payment logging, and an admin
  audit trail for operational recovery.

## Implementation order

1. Payment and capacity integrity.
2. Administration and abuse resistance.
3. Cancellation and refund consistency.
4. Identity and SSR security headers.
5. CI, reconciliation, and operational observability.
