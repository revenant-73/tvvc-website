# Parent Portal Roadmap (Auth.js)

This document outlines the step-by-step implementation plan for the TVVC Parent Portal using Auth.js.

## Phase 1: Authentication & User Core

1. **Install Dependencies**
   - Install `@auth/astro` and relevant database adapters.
   - Configure environment variables (`AUTH_SECRET`, OAuth credentials).

2. **Schema Migration**
   - Update `.\src\db\schema.ts` to include standard Auth.js tables: `users`, `accounts`, `sessions`, and `verificationTokens`.
   - Add a `stripe_customer_id` field to the `users` table.
   - Create a `players` table linked to `users` (Parent-Child relationship).

3. **Auth.js Configuration**
   - Create `.\src\auth.config.ts` to define providers (Email/Magic Links and optionally Google).
   - Implement the Astro middleware to handle session protection.

## Phase 2: Parent Management & Dashboard

1. **User Profile System**
   - Create a `.\src\pages\dashboard\index.astro` page.
   - Display parent account info and a list of registered "Players" (children).

2. **Player Management**
   - Build forms to Add/Edit/Remove players from the account.
   - This info will be used to auto-fill future registration forms.

3. **Purchase History**
   - Fetch Stripe checkout sessions linked to the `stripe_customer_id`.
   - Display a chronological list of all clinics, camps, and tournaments purchased.

## Phase 3: Registration Flow Integration

1. **Authenticated Checkout**
   - Update the current Stripe checkout logic to check if a user is logged in.
   - If logged in, pass their `customer` ID to Stripe to ensure the purchase is linked to their account.

2. **Post-Purchase Webhooks**
   - Update `.\src\pages\api\stripe\webhook.ts` to record the purchase in the local `purchases` table after a successful payment.

## Phase 4: Security & Polish

1. **Access Control**
   - Ensure users can only view/edit players and purchases linked to their own `user_id`.
   - Implement "Admin" roles to allow club staff to view all customer data.

2. **Transactional Emails**
   - Configure a service (e.g., Resend) to send account-related emails (Login links, Password resets).

## Technical Feasibility Note
This roadmap leverages the existing **Drizzle ORM** and **Astro 6** setup. No major infrastructure changes are required beyond adding the Auth.js library and updating the database schema.
