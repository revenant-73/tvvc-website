# TVVC Portal Completion Roadmap

This roadmap tracks the development of the Customer Portal for TVVC parents and athletes.

## Stabilization TODO

### Security and data integrity
- [x] Restrict login callback URLs to same-origin portal/admin paths.
- [x] Enable Astro origin checks and validate origins on JSON write endpoints.
- [x] Validate and normalize all portal API payloads with shared Zod schemas.
- [x] Stop recording waiver and photo-release consent when a parent only creates a player profile.
- [x] Replace email-only ownership fallbacks with claimed, canonical user relationships.

### Billing and purchase history
- [x] Always create or reuse a Stripe Customer during checkout.
- [x] Guard against missing Stripe Customer IDs in webhook processing.
- [x] Add an authenticated receipt endpoint and connect the Receipt button.
- [x] Store immutable purchase-time line-item names and prices.
- [x] Reconcile existing registrations with Stripe Customer IDs where possible.

### Player profiles
- [x] Separate persistent player profiles from per-registration athlete snapshots.
- [x] Pass saved player IDs through registration forms.
- [x] Prevent repeat registrations from creating duplicate player profiles.
- [x] Add an intentional merge/archive flow for existing duplicates.

### Dashboard and sessions
- [x] Filter Upcoming Events by the club timezone and exclude past/cancelled events.
- [x] Make “Sign Out Everywhere” revoke every database session for the user.
- [x] Add explicit, revocable view-only access for invited parents/guardians.

### Automated coverage
- [x] Test unauthenticated portal redirects and cross-origin request handling.
- [x] Test that one parent cannot access another parent’s orders or players.
- [ ] Test add/edit player validation and ownership.
- [ ] Test upcoming-event filtering and historical order totals.
- [x] Test Stripe Customer creation, billing portal access, and receipt authorization.

### Deployment note: player profile migrations

The profile/snapshot split adds `player_profiles` and `athletes.profile_id`.
The lifecycle migration adds the nullable `archived_at` and
`merged_into_profile_id` columns plus their indexes.
The guardian-access migration adds the `household_guardians` invitation and
authorization table. Before deploying an application commit that depends on
these migrations:

1. Set the production `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
2. Run `npm run db:migrate`.
3. Deploy the application only after the migration succeeds.

All migrations are additive. The first backfills profiles with their existing
athlete IDs, the lifecycle migration leaves every existing profile active by
default, and guardian access begins empty with no automatic sharing. They can
safely run before the application deployment.

## ✅ Phase 1: Order & Billing Transparency (COMPLETED)
- [x] **Order Details Page (`/portal/orders/[id]`)**
  - Dedicated view for individual registrations.
  - Itemized breakdown: which athlete is registered for which event/program.
  - "View Receipt" logic (redirects to Stripe).
- [x] **Stripe Customer Portal (`/api/stripe/portal`)**
  - API endpoint to generate secure Stripe Billing Portal sessions.
  - Connected the "Manage via Stripe" button on the dashboard.

## ✅ Phase 2: Player Profile Management (COMPLETED)
- [x] **Athlete CRUD Functionality**
  - "Add Player" page in the portal.
  - Dedicated athlete profile pages for editing.
  - Quick-select integration for registration forms.

## ✅ Phase 3: Account & Personalization (COMPLETED)
- [x] **Settings Page (`/portal/settings`)**
  - Allow users to update their own contact information.
  - Secure Magic Link authentication via Resend.
- [x] **Site Integration**
  - Added "My Portal" to main navigation.
  - Added Portal entry points to Homepage and Footer.

## 📅 Phase 4: Future Portal Features
- [ ] **Team & Stat Tracking**
  - Integrate team assignments for club season.
  - Display basic stat tracking for players (Aces, Kills, etc.).
- [ ] **Automatic Form Pre-fill**
  - Fully pre-fill parent info from logged-in session.

---
*Last Updated: 2026-07-30*
