# TVVC Portal Completion Roadmap

This roadmap tracks the development of the Customer Portal for TVVC parents and athletes.

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
*Last Updated: 2026-07-20*
