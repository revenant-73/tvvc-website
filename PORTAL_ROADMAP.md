# TVVC Portal Completion Roadmap

This roadmap outlines the remaining work to make the Customer Portal fully functional for TVVC parents and athletes.

## Phase 1: Order & Billing Transparency
- [ ] **Order Details Page (`/portal/orders/[id]`)**
  - Create a dedicated view for individual registrations.
  - Display itemized breakdown: which athlete is registered for which event/program.
  - Include "Download Receipt" link.
- [ ] **Stripe Customer Portal (`/api/stripe/portal`)**
  - Implement API endpoint to generate secure Stripe Billing Portal sessions.
  - Connect the "Manage via Stripe" button on the dashboard.

## Phase 2: Player Profile Management
- [ ] **Athlete CRUD Functionality**
  - Create "Add Player" modal/form on the Dashboard.
  - Implement `/api/athletes` endpoint for adding/editing player data (name, grade, etc.).
  - Add "Edit Profile" buttons to player cards.

## Phase 3: Account & Personalization
- [ ] **Settings Page (`/portal/settings`)**
  - Allow users to update their own contact information.
  - Manage notification preferences.
- [ ] **Team & Stat Tracking (Future)**
  - Integrate team assignments for club season.
  - Display basic stat tracking for players (Aces, Kills, etc.).

---
*Created on: 2026-06-19*
