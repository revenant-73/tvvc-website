# Club-Season Registration: Current Status and Remaining Work

**Status:** Implemented, deployed dark, and pilot-tested in Stripe test mode

**Last updated:** August 23, 2026

**Production access:** Disabled for general family use

**Primary requirements reference:** [CLUB_SEASON_REGISTRATION_SYSTEM.md](./CLUB_SEASON_REGISTRATION_SYSTEM.md)

## 1. Executive Summary

The club-season registration and payment system is substantially built and deployed. The production database has the complete club-season schema, the shared registration route is private and protected, the administrator workspaces are available, and the end-to-end standard-plan pilot has been completed with Stripe test payments and Resend email delivery.

The system is **not ready to open to all families yet**. The remaining launch work is the final controlled rehearsal, activating the teams TVVC actually fields, preparing and reviewing real offers, deliberately opening registration, sending invitations in two supervised waves, and reconciling the first genuine payments—not another large application build.

Current safety position:

- The 2026–2027 club season remains in `draft` status.
- Season-level public registration remains disabled.
- `CLUB_SEASON_REGISTRATION_ENABLED` remains off for general access.
- The page is absent from public navigation and the sitemap and is marked `noindex`.
- Controlled pilot access is currently disabled. If it is deliberately re-enabled for a rehearsal, it is restricted to exact allowlisted email addresses and requires Stripe test mode.
- Real families cannot discover or use the system through normal website browsing.

Verified production snapshot from August 23, 2026:

- Current production source is `5814845` on `main` (`Track Resend invitation delivery events`).
- Production database verified: `tvvc-registration`.
- Season `2026-2027-club` is `draft`, timezone `America/Los_Angeles`, default billing day `5`, first installment date `2027-01-05`, and standard installment count `5`.
- Registration window is configured as November 8, 2026 at 6:00 PM Pacific through November 30, 2026 at 11:59 PM Pacific.
- Season dates are December 1, 2026 through May 31, 2027.
- `public_registration_enabled = 0`.
- Two pricing tiers exist, nine active age groups exist, and 36 possible teams exist; all 36 teams are inactive.
- There are zero club-season offers, zero club-season registrations, and zero invitation batches.
- There are zero club-season payment plans and zero invitation delivery attempts.
- Published agreements exist for `season-commitment`, `refund-cancellation-policy`, and `media-release`.
- Launch evidence exists for `resend_domain`, `stripe_live_review`, and `controlled_pilot`.
- Migration `0014_club-season-invitations.sql` is recorded with hash `f629bc2559413abfee5d0f6765c1bd111b0c802409741f7f6f758e3ad78286c1`.
- Non-season event waitlist migration `0015_event-waitlists.sql` is also applied in production. It does not open or alter club-season registration.
- Resend invitation provider-event migration `0016_resend-invitation-events.sql` is also applied in production. The Resend production webhook is registered, `RESEND_WEBHOOK_SECRET` is configured in Netlify, and production smoke testing now returns `Invalid webhook signature` for fake signed requests, proving the function can see the secret. This does not open registration, release offers, send invitations, or create Stripe activity.
- Normal summer camp and non-tryout-prep clinic registration has been closed separately; that does not open or alter club-season registration.
- The project now pins Node `>=22.12.0`. Netlify dependency audit findings were reduced from 10 high entries to 5; the remaining highs all trace to the upstream `extract-zip@2.0.1` advisory through Netlify's current `@netlify/functions-dev@2.0.1`.

August 23, 2026 verification checkpoint:

- Production club-season state was verified read-only after the non-season waitlist rollout: season draft, registration closed, all teams inactive, and zero offers, registrations, payment plans, invitation batches, or invitation attempts.
- Production pricing, age groups, published agreement versions, launch evidence, recent audit entries, and database integrity were verified; `PRAGMA integrity_check` returned `ok`.
- Local/test-only club-season automated rehearsal passed: `node --experimental-strip-types --test tests/club-season-*.test.ts` returned 50/50 passing tests.
- Local/test-only Playwright offer/payment rehearsal passed: `npx playwright test tests/club-season-offers.spec.js tests/club-season-payments.spec.js --reporter=list --timeout=90000` returned 15/15 passing tests.
- Deploy Preview #39 completed a live deployed rehearsal against the isolated `tvvc-season-pilot` database and Stripe test mode for the 13U-18U standard-plan happy path: parent magic-link sign-in, offer visibility, registration draft, agreement acceptance, $400 test Checkout, verified `checkout.session.completed` webhook replay to the preview endpoint, confirmation email delivery, parent dashboard, and Stripe receipt access.
- After the rehearsal, the temporary Stripe test webhook `TVVC season registration preview 39` was disabled for audit retention, `CLUB_SEASON_PILOT_EMAILS` was deleted from Netlify, and `CLUB_SEASON_PILOT_MODE` was set to `false` in every Netlify deploy context. Deploy Preview #39 should be rebuilt after this documentation commit so those closed settings take effect on the preview deployment.
- No production offers were created, no registration lock was opened, no invitation email was sent, and no live Stripe checkout was created during this checkpoint.

## 2. Confirmed Operating Rules

| Area | Current rule |
| --- | --- |
| Entry point | One shared `/season-registration` link is sent only to families receiving an offer. No unique link is required for each player. |
| Eligibility | Players must already have a paid tryout registration and an administrator-created team offer. |
| Team selection | TVVC assigns the offered team. Parents review that assignment rather than selecting any team themselves. |
| 10U–12U dues | $1,200 total: $300 due at registration, then five $180 automatic payments. |
| 13U–18U dues | $1,500 total: $400 due at registration, then five $220 automatic payments. |
| Standard dates | Deposit in November; no December charge; installments on January 5, February 5, March 5, April 5, and May 5. |
| Payment choices | Pay in full or authorize the standard plan. A parent may also select an exact custom arrangement prepared by TVVC. |
| Billing exceptions | Administrators may prepare an initial custom plan or propose a revision to future unpaid installments. Parents must authorize the exact replacement schedule. |
| Card handling | Stripe stores complete card data. TVVC stores only Stripe references and authorization evidence. |
| Failed payments | Failures change the financial status and trigger retries/communications; they do not automatically remove the player from the roster. |
| Refunds | Refund and cancellation decisions are recorded through immutable financial adjustments. Voluntary withdrawal after the first practice is reviewed case by case. |
| Billing day | The standard billing day is the fifth; custom future dates may be set per family. |
| Time zone | Business dates are evaluated in `America/Los_Angeles`. |

## 3. Work Completed

### 3.1 Product design and policy requirements

- Documented the shared-link model, data-security requirements, registration flow, pricing, automatic-payment consent, retries, reminders, custom plans, refunds, and administrator permissions.
- Documented the working refund and cancellation policy, including:
  - three-business-day cancellation;
  - TVVC cancellation or material service reduction;
  - season-ending medical inability;
  - voluntary withdrawal before the first practice;
  - case-by-case review after the first practice;
  - treatment of scholarships, fundraising, and non-cash credits.
- Documented the standard January–May plan and intentional December holiday pause.
- Upgraded the Netlify and Resend accounts in preparation for production volume.

### 3.2 Database and immutable financial model

Migrations `0004` through `0012` implement the club-season domain:

- seasons, pricing tiers, age groups, and teams;
- team offers and registration drafts;
- versioned agreements and immutable acceptance evidence;
- payment plans, plan versions, installments, and transactions;
- payment attempts and email delivery records;
- administrator audit history, parent authorizations, and plan revisions;
- immutable financial adjustments and Stripe refunds;
- launch-readiness evidence.

Important protections are implemented with unique indexes, idempotency keys, authorization checks, and database triggers. Paid transactions, accepted agreements, published agreement text, prior plan versions, financial adjustments, and launch evidence cannot be silently rewritten or deleted.

### 3.3 Administrator season setup

The protected `/admin/club-season` workspace supports:

- season status and registration-window configuration;
- pricing-tier and age-group mapping;
- team creation, activation, capacity, and pricing assignment;
- versioned agreement drafting, approval references, and publication;
- pilot and live launch-readiness gates;
- permanent Resend, Stripe, and controlled-pilot evidence records;
- display of both access locks: the Netlify feature flag and season database switch.

Database-backed administrator authorization is checked on each protected request so a stale browser session cannot preserve access after an administrator is demoted.

### 3.4 Offer management

The protected `/admin/club-season/offers` workspace supports:

- searching the existing tryout roster;
- selecting one or many eligible players;
- assigning an active team and response deadline;
- retry-safe bulk offer creation for the expected 140+ players;
- revoking and restoring offers;
- showing each family's media-release choice, the total number of declines, and direct filters for declined, granted, or pending responses;
- preventing cross-family access and duplicate player/season offers.

### 3.5 Parent registration

The private `/season-registration` flow supports:

- Resend magic-link sign-in using the parent account from tryouts;
- ownership checks tied to the paid tryout registration and immutable athlete snapshot;
- viewing only offers belonging to the authenticated household;
- declining an offer or starting a save-and-resume draft;
- family/contact, emergency-contact, player, uniform, medical-confirmation, CEVA, release, and known-conflict fields;
- server-side validation and stale-tab protection;
- exact agreement text, response, identity, timestamp, context, and content-hash capture;
- a final review before payment;
- pay-in-full, standard-plan, and administrator-prepared custom-plan choices;
- typed-name automatic-payment authorization;
- Stripe-hosted Checkout for the full amount or deposit;
- final roster acceptance only after a verified successful Stripe event.

The browser never supplies authoritative prices, balances, or installment dates.

### 3.6 Stripe payment lifecycle

- Stripe Checkout collects pay-in-full payments and deposits.
- Standard/custom plan Checkout saves the authorized payment method for future off-session charges.
- Verified webhooks reconcile Checkout sessions, PaymentIntents, amounts, currency, registration, and plan version before changing TVVC records.
- Duplicate webhook events and duplicate Checkout attempts are idempotent.
- Expired Checkout sessions can be safely restarted without losing registration or agreement information.
- Successful payments, failed payments, authentication-required results, and late events from superseded plans are handled without rewriting history.
- Secure receipt retrieval uses an internal transaction ID and performs an owner-only database authorization check before requesting a Stripe receipt.

### 3.7 Automatic billing and emails

- A daily Netlify scheduled function invokes a protected background billing worker.
- Billing decisions use Pacific dates even though the scheduled trigger runs at `16:00 UTC`.
- January’s reminder is delayed until January 2 to preserve the December holiday pause.
- February–May reminders are scheduled five days before the charge.
- Failed payments retry three days after the original attempt and make a final retry seven days after the original due date.
- Authentication-required or final-failure states stop automatic retries and flag manual follow-up.
- Retry-safe Resend delivery records prevent duplicate reminders and notifications.
- Email templates exist for upcoming charges, successful payments, receipts, failures, recovery, plan proposals, plan acceptance, refunds, credits, write-offs, offline payments, and reversals.

### 3.8 Administrator financial workspace

The protected `/admin/club-season/finances` workspace supports:

- account search and filters by team, payment status, and review state;
- season totals, collected amounts, and remaining balances;
- exact ledger history across all plan versions;
- an `Awaiting payment` queue;
- initial custom arrangements before Checkout;
- parent-authorized revisions to future unpaid installments;
- offline payments, credits, write-offs, Stripe refunds, and counter-entry reversals;
- before/after balance previews and required reasons;
- immutable administrator audit history;
- a Stripe-test-only billing recovery simulator for declined-card, authentication-required, and successful-recovery scenarios.

### 3.9 Parent portal

The parent `/portal/dashboard` now provides:

- player, team, registration, and financial status;
- total dues, amount paid, and authoritative remaining balance;
- next automatic charge or payment-attention state;
- the complete current installment schedule;
- preserved deposit/payment history after a plan revision;
- automatic-payment authorization status;
- owner-only Stripe receipt and payment-method controls;
- view-only plan visibility for approved secondary guardians without billing controls.

The portal includes a defensive fallback so an optional club-season query cannot take down the rest of the parent dashboard during a database rollout.

### 3.10 Automated coverage

The repository includes unit and Playwright coverage for:

- migrations and database immutability;
- feature flags and pilot interlocks;
- offer creation, expiration, revocation, isolation, and capacity;
- draft validation, agreement capture, and concurrency;
- standard and custom schedules;
- Checkout, webhook idempotency, and expired sessions;
- automatic billing dates, retries, and ledger reconciliation;
- custom initial plans and plan revisions;
- credits, refunds, offline payments, write-offs, and reversals;
- launch-readiness gates and evidence;
- parent portal plan visibility, receipts, and guardian restrictions;
- billing simulator failure and recovery behavior.

## 4. Production Work Completed

### 4.1 Deployment and schema recovery

- The complete club-season implementation was merged in PR #13 (`5c10b40`).
- The dependency security patches were merged separately.
- A temporary missing-schema failure on the authenticated parent dashboard was diagnosed from Netlify function logs.
- A defensive portal fallback was merged in PR #15 (`d74658f`) so the main dashboard remains available if optional club-season tables are temporarily unavailable.
- A production Turso backup branch named `tvvc-registration-backup-2026-08-12` was created before schema work.
- Migrations `0004` through `0012` were applied to the production `tvvc-registration` database.
- The final production audit confirmed:
  - 19 `club_*` tables;
  - 27 club-season immutability/validation triggers;
  - 74 committed `club_*` indexes;
  - the one-pending-revision unique guard;
  - the financial-adjustment table;
  - the launch-evidence table.
- The seeded `2026-2027-club` season was verified as `draft` with public registration set to `0`.
- The authenticated production parent dashboard and administrator financial workspace were retested successfully after migration.

### 4.2 Migration history reconciled

The production club-season migrations were originally applied manually through Turso Studio because the local environment did not point at the production database. On August 15, 2026, migration history was reconciled before introducing any later migration:

- A fresh recovery branch, `tvvc-registration-backup-2026-08-15-pre-baseline`, was created from production.
- Production was compared with a clean database built from committed migrations `0000` through `0012`.
- Ten missing committed indexes were identified. Six are uniqueness/data-integrity guards and four are lookup indexes.
- All uniqueness checks returned zero conflicting groups before repair.
- The repair and migration baseline were rehearsed twice on the recovery branch.
- Production was repaired to 19 `club_*` tables, 27 triggers, and 74 indexes.
- `__drizzle_migrations` now contains the exact hashes and timestamps for all 13 committed migrations (`0000` through `0012`).
- Both scripts were rerun successfully to prove idempotency, and `PRAGMA integrity_check` returned `ok`.

The checked-in recovery artifacts are:

- `scripts/repair-production-club-season-indexes.sql`
- `scripts/baseline-production-migrations-0000-0012.sql`
- `tests/production-migration-baseline.test.ts`

For the next schema change, generate a new migration (`0013` or later), review it, create a fresh Turso backup branch, and run the normal Drizzle migration command against the explicitly verified production URL. Historical migrations must not be manually replayed.

### 4.3 Controlled pilot completed

Using the allowlisted pilot parent and Stripe test mode, the deployed flow successfully demonstrated:

1. Magic-link authentication.
2. Visibility of only the pilot player’s offer.
3. Registration draft completion.
4. Agreement acceptance.
5. Standard-plan selection and exact automatic-payment authorization.
6. Stripe test Checkout and successful deposit.
7. Registration confirmation email delivery through Resend.
8. Parent portal display of the active plan, balance, next payment, and schedule.
9. Secure Stripe deposit receipt access.
10. Administrator access to the finance workspace.
11. Declined/authentication-required billing recovery messaging.
12. Successful recovery processing and payment-confirmation email delivery.

The pilot used test data and test payments. It does not by itself authorize live registration.

### 4.4 Production season foundation reconciled

On August 16, 2026, the confirmed pricing and age-group foundation was restored to the production `2026-2027-club` season:

- A fresh recovery branch, `tvvc-reg-backup-2026-08-16-pre-foundation`, was created immediately before the production write.
- The guarded reconciliation was tested for exact values, rerun safety, and refusal of conflicting existing pricing.
- The 10U–12U tier is $1,200 total: $300 deposit plus five $180 installments.
- The 13U-18U tier is $1,500 total: $400 deposit plus five $220 installments.
- Active age groups 10U through 18U were created and linked to the correct tier.
- Production readiness now passes the standard billing schedule and pricing reconciliation checks.
- At this stage, no teams, registration dates, offer deadlines, or season dates were invented.
- The season remained `draft`, `public_registration_enabled` remained `0`, and the Netlify registration flag remained off.

Checked-in recovery artifacts:

- `scripts/reconcile-production-club-season-foundation.sql`
- `tests/production-club-season-foundation.test.ts`

### 4.5 Production season dates configured

On August 16, 2026, the approved invitation and season dates were configured:

- Invitation window: November 8, 2026 at 6:00 PM through November 30, 2026 at 11:59 PM Pacific.
- Standard offer response period: three calendar days, applied when each offer batch is created; individual deadlines can be extended.
- Season start: December 1, 2026.
- Season end: May 31, 2027.
- Recovery branch: `tvvc-reg-backup-2026-08-16-pre-dates`.
- The invitation-window change used the audited production admin workflow.
- The season-bound update was recorded in the append-only admin audit log and tied to the same administrator.
- The season remained `draft`, and both registration locks remained off.

Checked-in recovery artifacts:

- `scripts/configure-production-club-season-dates.sql`
- `tests/production-club-season-dates.test.ts`

### 4.6 Production Resend verification recorded

On August 16, 2026, the production Resend configuration was reviewed and permanently recorded in the launch console:

- Sending domain: `mail.tualatinvalleyvb.com`.
- Domain status: verified and enabled for sending in `us-east-1`.
- DKIM record: verified.
- SPF MX record: verified.
- SPF TXT record: verified.
- Production sender: `TVVC Volleyball <reminders@mail.tualatinvalleyvb.com>`.
- Reply-to address: `loren@tualatinvalleyvb.com`.
- Delivered club-season evidence: Resend email `f6721a57-b4d1-4200-a1e6-1d3003ead3e3`, with both sent and delivered events.
- The append-only evidence entry was signed by Loren Anderson on August 16, 2026.
- Recording the evidence did not change the season status or either registration lock.

### 4.7 Production Stripe configuration reviewed and corrected

On August 16, 2026, the live Stripe account and production Netlify configuration were reviewed, the two approved configuration gaps were corrected, and no charge was created:

- Stripe account: Tualatin Valley Volleyball Club LLC (`acct_1Q9ZXsFzgaoVZJWY`) in live mode.
- Card payments are enabled. The club-season Checkout integration intentionally requests cards only.
- The account currently shows standard domestic-card pricing of 2.9% plus 30 cents per successful charge. TVVC's published policy remains that the club absorbs payment-processing fees.
- The Stripe Customer Portal is active and allows customers to update payment methods.
- The production webhook is active at `https://tualatinvalleyvb.com/api/webhooks/stripe`; its signing secret is functioning, with eight successful deliveries and zero failures shown for the review period.
- The production webhook now listens to all four required events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, and `payment_intent.payment_failed`.
- Netlify production now uses the matching live publishable and secret keys. Preview contexts retain test keys for safe testing.
- A production configuration deploy completed successfully after the key update. The automated Stripe configuration gate passed, advancing launch readiness from 7/15 to 8/15 checks with five blockers remaining.
- Checkout, receipt, refund, off-session payment, failure, and idempotency behavior were verified in the deployed Stripe test-mode pilot. Stripe's testing policy prohibits testing in live mode with real payment details, so production verification does not manufacture a charge or refund.
- No Stripe keys or signing secrets are included in this document.

### 4.8 Production billing worker protected and verified

On August 16, 2026, the scheduled production billing path was configured and exercised while no installments were due:

- Netlify production now has a dedicated 64-character `CLUB_SEASON_CRON_SECRET`; the value is stored only as a protected environment variable and is not included in the repository or this document.
- `CLUB_SEASON_BILLING_EMAIL` is configured as `loren@tualatinvalleyvb.com` for escalation messages.
- The scheduled `club-season-billing-cron` function is deployed with the daily `0 16 * * *` schedule, which Netlify displays as 9:00 AM Pacific for the current daylight-saving period.
- The first manual no-op exposed a standalone-function compatibility bug before candidate processing: the shared Stripe client assumed Astro's `import.meta.env` object always existed.
- PR #24 fixed the Stripe client to support both Astro routes and standalone Netlify functions and added regression coverage. Unit tests passed 54/54, and both the Netlify preview and production builds passed.
- The repaired production worker completed on August 16 at 10:30 AM Pacific with `candidates: 0`, `reminders: 0`, and `charges: 0`.
- The verification created no charge, email, or ledger mutation and did not change either registration lock.
- The automated billing-worker protection gate passed, advancing launch readiness from 8/15 to 9/15 checks with four blockers remaining.

### 4.9 Controlled pilot reconciled and closed

On August 16, 2026, the deployed Stripe test-mode pilot was reconciled, permanently recorded, and closed:

- The pilot family completed registration, all three agreement decisions, standard-plan automatic-payment authorization, and Stripe test Checkout.
- The $1,500 plan reconciled to a $400 deposit and one $220 recovered installment, for $620 collected and an $880 remaining test balance. Four $220 installments remain scheduled from February through May in the isolated pilot records.
- Confirmation, failure/action-required, and successful-recovery emails were received.
- Declined-card and authentication-required handling were exercised, followed by a successful recovery that returned the account to current status without removing the player from the roster.
- Idempotency was verified by manually resending the original `checkout.session.completed` event. The pilot endpoint returned HTTP 200 with `processed: false`, and the ledger retained one $400 deposit transaction.
- All six required launch-console checks were confirmed: registration, payment, email, ledger reconciliation, failure recovery, and idempotency.
- The append-only controlled-pilot evidence entry was signed by Loren Anderson on August 16, 2026. Launch readiness advanced from 9/15 to 10/15 checks with three blockers remaining.
- Pilot records were retained in the isolated pilot database as labeled audit evidence; no test transactions were copied into the production financial ledger.
- `CLUB_SEASON_PILOT_MODE` is now `false` in every Netlify deploy context, the temporary pilot email allowlist was deleted, and Deploy Preview #13 was rebuilt and verified to deny the former pilot offer.
- The retired Stripe test webhook destination remains preserved for audit history but is disabled.
- The production season remains `draft`; it has zero active teams, and both registration locks remain off.

### 4.10 Production Stripe evidence recorded

On August 16, 2026, the Stripe live-mode review was permanently recorded in the launch console without creating an artificial live transaction:

- The live account, card enablement, pricing, Customer Portal payment-method updates, matching Netlify live keys, webhook signing, required event subscriptions, and successful delivery history were reviewed.
- The protected production billing worker's successful zero-candidate no-op was included in the evidence.
- The deployed test-mode pilot remains the integration proof for Checkout, saved payment methods, off-session behavior, receipts, refunds, failure recovery, and idempotency.
- Stripe's official testing guidance requires test keys and testing environments and prohibits testing in live mode with real payment details: <https://docs.stripe.com/testing>.
- No artificial live charge or refund was created. The first genuine family payment will be supervised and reconciled as an operational rollout check.
- The append-only evidence entry was signed by Loren Anderson on August 16, 2026. Launch readiness advanced from 10/15 to 11/15 checks with two blockers remaining.
- The season remains `draft`, no teams are active, and both registration locks remain closed.

### 4.11 Possible team catalog staged in production

On August 16, 2026, the approved possible-team catalog was added to the production season:

- A recovery branch, `tvvc-reg-backup-2026-08-16-pre-team-catalog`, was created immediately before the production write.
- Age groups 10U and 11U were added, bringing the configured range to every age from 10U through 18U.
- The lower pricing tier was relabeled `10U-12U` and retains the approved $1,200 total, $300 deposit, and five $180 installments.
- The 13U-18U tier remains $1,500 total, with a $400 deposit and five $220 installments.
- Four possible teams were staged at every age: Teal, Coral, Black, and White, for 36 teams total.
- Every staged team is inactive. Inactive teams cannot be selected for new offers, but can be activated from the Club Season admin workspace after tryouts.
- Production verification returned nine active age groups, 36 inactive teams, zero active teams, season status `draft`, and `public_registration_enabled = 0`.
- The reconciliation is guarded, transactional, rerunnable, and covered by the production foundation test.

Checked-in recovery artifacts:

- `scripts/reconcile-production-club-season-foundation.sql`
- `tests/production-club-season-foundation.test.ts`

### 4.12 Invitation ledger schema prepared and rehearsed

On August 22, 2026, the append-only invitation-release ledger in migration `0014_club-season-invitations.sql` was applied and verified in both the production and isolated pilot databases:

- Production database: `tvvc-registration`.
- Production recovery branch: `tvvc-reg-backup-2026-08-22-pre-invitations`.
- Pilot database used by Deploy Previews: `tvvc-season-pilot`.
- Pilot recovery branch: `tvvc-season-pilot-backup-2026-08-22-pre-invitations`.
- Drizzle migration hash: `f629bc2559413abfee5d0f6765c1bd111b0c802409741f7f6f758e3ad78286c1`.
- Both databases now contain the three invitation tables, 14 invitation indexes, six immutability triggers, and exactly one `0014` migration record.
- Pilot verification confirmed the expected foreign-key counts (`3/2/3`), zero foreign-key violations, zero duplicate `0014` records, and `PRAGMA integrity_check = ok`.
- Existing production and pilot offers were unchanged; no offers were released and no invitation emails were sent.
- Deploy Preview #32 was retested after the pilot migration. Batch History loaded normally and showed the correct no-batches empty state instead of the prior missing-table error.

The database groundwork is complete. PR #32 was merged as production commit `820b01f` on August 22, 2026. Netlify published the production deployment, and the authenticated production offer workspace loaded the invitation controls and empty Batch History successfully with both registration locks closed.

### 4.13 Source, site-visibility, and dependency maintenance after invitation launch

On August 23, 2026, production source was advanced from the invitation-release milestone to commit `30e538c` through PRs #33-#37:

- PR #33 added `docs/CODEX_TVVC_PAYMENT_PROJECT_HANDOFF.md` as the short restart reference for future Codex tasks and other computers.
- PR #34 fixed local verification/header-navigation issues without changing club-season business rules.
- PR #35 hid the unused Outdoor Events and Private Training public pages. These pages are not part of the club-season registration system.
- PR #36 closed normal summer camp and non-tryout-prep clinic registration. Production event data now leaves only the upcoming tryout-prep clinics active. This does not open the private club-season route.
- PR #37 updated `@astrojs/netlify`, added targeted Netlify dependency overrides, and pinned Node `>=22.12.0`. Local verification passed, and the Netlify Deploy Preview passed before merge.

`npm audit` now reports five remaining high entries, all caused by `extract-zip@2.0.1` through Netlify's current `@netlify/functions-dev@2.0.1`. No patched upstream release was available at the time of the update, and npm's proposed fix would downgrade `@astrojs/netlify` to an older major version, so it was not applied.

No club-season database writes were made during these source-maintenance PRs. The August 23 production read-only verification still shows the season closed, no offers, no registrations, no invitation batches, and all possible teams inactive.

### 4.14 Deployed final-rehearsal checkpoint on Deploy Preview #39

On August 23, 2026, Deploy Preview #39 was used for the first final prelaunch rehearsal checkpoint in the isolated pilot environment:

- Pilot database: `tvvc-season-pilot`.
- Stripe mode: test mode only.
- Parent account: `loren+tvvc-parent-pilot@tualatinvalleyvb.com`.
- Offer: 14U Pilot using the 13U-18U pricing tier.
- Payment option tested: standard plan, with a $400 test deposit and five scheduled $220 automatic payments from January through May 2027.
- Stripe Checkout session: `cs_test_a1FwMmh0a6RHav5mUtB9OdAMsPD434oSocEATEfs4jdFwwpKPcsMv92TuR`.
- Stripe event replay: `checkout.session.completed` event `evt_1U7ewnFzgaoVZJWYOVz6u3Xp` was manually resent to the temporary Deploy Preview #39 webhook destination and returned `200 OK` at 11:17:16 AM Pacific.
- Parent result: `/season-registration` showed `YOUR SPOT IS CONFIRMED` for Parent Pilot on 14U Pilot.
- Email result: Resend delivered `TVVC registration confirmed: Parent Pilot - 14U Pilot` with the $400 deposit, $1,100 remaining balance, January-May payment schedule, no-December-charge language, Stripe receipt link, and parent portal link.
- Follow-up verification: Loren confirmed the parent portal/dashboard looked good and the receipt link worked as intended.

Cleanup after the checkpoint:

- The temporary Stripe test webhook destination `TVVC season registration preview 39` was disabled, not deleted, so delivery history remains available.
- `CLUB_SEASON_PILOT_EMAILS` was deleted from Netlify.
- `CLUB_SEASON_PILOT_MODE` was set to `false` in all Netlify deploy contexts.
- `STRIPE_WEBHOOK_SECRET` was intentionally left unchanged because production depends on that variable family and the temporary Stripe destination is disabled.

This checkpoint does not complete the full final rehearsal. The remaining final-rehearsal cases are the 10U-12U tier, pay-in-full checkout, custom initial arrangement, later plan revision, duplicate-event idempotency, failure/recovery behavior, administrator ledger review, guardian restrictions, and mobile layouts.

## 5. Remaining Work Before Live Family Registration

Complete these items in order. Items marked **Launch blocker** must be finished before sending the shared link to real families.

The next work item from the August 23, 2026 state is to continue Step 6, the final prelaunch rehearsal in an isolated/test environment. The 13U-18U standard-plan happy path has passed on Deploy Preview #39; the remaining Step 6 cases are still launch blockers. Production should remain closed while that rehearsal continues unless Loren explicitly approves a specific production action.

### Step 1 — Reconcile the repository and production migration record

**Completed August 15, 2026.**

- Production now tracks migrations `0000` through `0012` with exact repository hashes and timestamps.
- Missing committed indexes were safely restored after duplicate-data checks and a backup-branch rehearsal.
- The approved future migration procedure is documented in Section 4.2.

### Step 2 — Approve final parent-facing documents

**Completed August 15, 2026.**

Use `docs/CLUB_SEASON_AGREEMENT_APPROVAL_PACKET.md` as the single review checklist for this step.

- Production V1 versions of the season commitment, refund/cancellation policy, and media release are published and immutable.
- Approval reference: `TVVC approval confirmed by Loren Anderson — 2026-08-15`.
- Confirmed terms include the uniform package, tournament coverage, CEVA responsibility, family travel costs, Stripe fee absorption, North Plains address, case-by-case post-practice withdrawals, and optional media choice.
- Both registration locks remained off after publication.

### Step 3 — Configure the real 2026–2027 season

**Launch blocker.**

**Foundation, possible-team catalog, and dates completed August 16, 2026:** the two confirmed pricing tiers, all nine age groups, 36 inactive possible teams, invitation window, three-day offer standard, and season bounds are now configured. Registration remains closed.

- **Completed:** registration opens November 8, 2026 at 6:00 PM and closes November 30 at 11:59 PM Pacific.
- **Completed:** the normal offer-response period is three calendar days, with individual extensions available.
- **Completed:** stage Teal, Coral, Black, and White teams for every age from 10U through 18U and link each to the correct age group and pricing tier.
- After tryouts determine the teams TVVC will field, activate only those teams from the admin workspace. Leave every unused possibility inactive.
- **Completed:** verify 10U–12U maps to $1,200 and 13U–18U maps to $1,500. Recheck each actual team after team activation.
- **Completed:** season dates are December 1, 2026 through May 31, 2027.

### Step 4 — Finish live service verification

**Completed August 16, 2026.**

- **Completed:** verify `mail.tualatinvalleyvb.com`, its DKIM/SPF records, `reminders@mail.tualatinvalleyvb.com`, reply-to behavior, and a delivered club-season email.
- **Completed:** record permanent Resend-domain evidence in the launch console.
- **Completed:** review current Stripe pricing and enabled payment methods; cards are enabled and the account shows standard domestic-card pricing of 2.9% plus 30 cents per successful charge.
- **Completed:** Netlify production uses matching live Stripe publishable and secret keys; preview contexts retain test keys for safe testing.
- **Completed:** the live webhook endpoint is active, its signing secret is functioning, and all four required Checkout and PaymentIntent events are configured.
- **Completed:** the Billing Portal is active and permits payment-method updates.
- **Completed:** record permanent Stripe live-review evidence without manufacturing a live-mode test transaction.
- **Completed:** configure a protected 64-character `CLUB_SEASON_CRON_SECRET` and `loren@tualatinvalleyvb.com` as `CLUB_SEASON_BILLING_EMAIL` in production.
- **Completed:** confirm the daily scheduled function is deployed and inspect a successful production no-op with zero candidates, reminders, and charges.

Use Stripe test keys and testing environments for rehearsals. Never use real payment details to test in live mode.

### Step 5 — Close out the controlled pilot

**Completed August 16, 2026.**

- The test plan, transactions, attempts, notifications, schedule, and $880 remaining test balance were reconciled.
- All six pilot checks were confirmed and recorded in the permanent launch console.
- Pilot records were retained only in the isolated pilot database as labeled audit evidence.
- The temporary pilot email allowlist was deleted, pilot mode was disabled in every deploy context, and the retired test webhook destination was disabled.
- Deploy Preview #13 was rebuilt with the closed settings and verified to show no active offer for the former pilot account.

### Step 6 — Run a final prelaunch rehearsal

**Launch blocker.**

- **Checkpoint completed August 23, 2026:** Deploy Preview #39 passed the 13U-18U standard-plan happy path in Stripe test mode, including parent sign-in, registration, agreement acceptance, Checkout, verified webhook activation, confirmation email, parent dashboard, and receipt access.
- Create one final internal offer using the exact production agreement versions and real season configuration.
- Verify the shared link remains absent from navigation and search indexing.
- Test the remaining 10U-12U standard price tier.
- Test pay in full.
- Test one custom initial arrangement and one later revision.
- Confirm administrator ledger and guardian restrictions.
- Confirm a duplicate webhook/job run causes no duplicate payment or email.
- Confirm failure does not remove the player from the roster.
- Verify mobile registration and portal layouts.
- Take a fresh Turso backup immediately before opening registration.

Run payment rehearsals with Stripe test keys. Do not manufacture live charges or refunds; supervise and reconcile the first genuine family payment during the staged rollout instead.

### Step 7 — Create real offers

**Launch blocker immediately before opening.**

- Import/review the final tryout roster.
- Assign every offered player to the correct active team.
- Set offer deadlines.
- Bulk-create offers in manageable batches and review counts by team.
- Spot-check ownership, player name, team, price, and deadline before emailing families.
- Prepare the offer email containing the shared registration link, deadline, pricing summary, December pause, payment choices, and custom-plan contact instructions.

The operational release is scheduled in two waves: 14-and-under tryouts on November 8, 2026 with invitation emails on November 9, followed by 15U-18U tryouts on November 15 with invitation emails on November 16. The complete preparation, assignment, controlled release, and first-payment procedure is documented in `docs/CLUB_SEASON_TRYOUT_LAUNCH_RUNBOOK.md`.

The self-service offer workspace now includes the controlled invitation sequence: authoritative preview, restricted administrator test mail, atomic offer release, duplicate-safe initial sending, failed-message retry, deliberate resend, and batch/per-recipient result history. Release changes `ready` offers to family-visible `offered`; it never sends. Send actions notify already-released families and never change assignments, pricing, deadlines, or registration locks.

Release batches are server-enforced to one active team and at most 50 unique offers. The dashboard shows both registration locks, retains a release request key across ambiguous retries, and computes ready, released-unsent, sent, and failed totals from each recipient's latest attempt. Initial sends, retries, and deliberate resends are blocked whenever either registration lock is closed.

The source now includes Resend invitation-delivery webhook ingestion at `/api/webhooks/resend`. Migration `0016_resend-invitation-events.sql` stores provider delivery events append-only and links them to the accepted invitation send attempt by Resend message ID. The admin invitation history displays downstream provider events such as delivered, delayed, failed, bounced, complained, and suppressed. Production migration `0016` was applied after creating recovery branch `tvvc-reg-backup-2026-08-23-pre-resend-events`. The Resend dashboard webhook was registered for the production endpoint, and Netlify now has `RESEND_WEBHOOK_SECRET` configured as a protected environment variable across deploy contexts. Production deploy `049d3f6` was smoke-tested with fake Svix headers and returned `Invalid webhook signature`, proving signature verification is active.

**Published in production:** the November offer-preparation workspace supports separate November 8 and November 15 waves, private draft offers, draft/ready corrections, readiness and blocker summaries, audited review-to-ready actions, assignment conflict details, and parent isolation for both draft and ready states.

**Published in production:** the guarded registration-access control rechecks every launch requirement before opening, requires an audit reason plus the exact `OPEN REGISTRATION` phrase, uses compare-and-swap protection against stale admin pages, and writes an immutable audit entry. Emergency close requires `CLOSE REGISTRATION`, remains available without passing readiness gates, and preserves offers, completed registrations, agreements, payments, and ledger history while pausing new or unfinished registration activity.

**Published in production:** the controlled invitation workflow provides administrator-only preview and test mail, atomic offer release, duplicate-safe initial sending, failed-message retry, deliberate resend, and append-only batch/per-recipient history. Production and pilot databases both contain migration `0014`; production currently has no invitation batches, released offers, or invitation sends.

### Step 8 — Enable live registration deliberately

**Final launch action.**

Only after the readiness console is clear:

1. Confirm Stripe is in live mode and the pilot bypass is off.
2. Confirm approved agreements are published.
3. Confirm real teams, pricing, registration window, and offers.
4. Enable the season database registration switch.
5. Set `CLUB_SEASON_REGISTRATION_ENABLED=true` in Netlify and allow the production deploy to finish.
6. Open the shared link with an offered-family account and an unrelated account.
7. Send the offer email only after both checks behave correctly.

Keep the route unlisted; “live” means available to verified offered families, not advertised publicly.

### Step 9 — Monitor the first registrations

**Operational launch requirement.**

- Closely monitor the first 5–10 registrations before sending to all families.
- Reconcile each Stripe payment against the TVVC ledger.
- Confirm confirmation emails and receipt links.
- Review Netlify function logs, Resend delivery, and Stripe webhook delivery.
- Pause the rollout—not completed registrations—if any money or ownership mismatch appears.
- After the first cohort is clean, release the link to the remaining offered families.

## 6. Useful Enhancements That Do Not Need to Block Launch

- Stripe dispute-webhook handling and dispute workflow.
- Manual pause/resume controls for automatic charges.
- Resend provider-event tracking is implemented, migration `0016` is applied in production, the Resend webhook is registered, Netlify has `RESEND_WEBHOOK_SECRET` configured, and the production endpoint has been smoke-tested with signature verification active. During the first real invitation wave, keep manual Resend dashboard monitoring in place until real provider events have been observed in the admin invitation history.
- Household-level consolidation of sibling reminders.
- A formal parent cancellation/refund-request form and automated proration worksheet.
- A coach-facing readiness view with financial and medical details excluded.
- Expanded CEVA/USA Volleyball readiness tracking.
- Spanish-language registration and email templates.
- Uniform inventory/ordering integration.
- Calendar subscriptions and team welcome automation.
- Registration and collection analytics.
- Season rollover tools.
- A formal data-retention and deletion schedule.

## 7. Operational Reference

### Parent and administrator routes

| Route | Purpose |
| --- | --- |
| `/season-registration` | Private shared registration link for verified offered families |
| `/portal/dashboard` | Parent plan, balance, schedule, receipts, and revision review |
| `/admin/club-season` | Season, teams, agreements, launch readiness, and evidence |
| `/admin/club-season/offers` | Tryout-roster offer creation and management |
| `/admin/club-season/finances` | Ledger, plans, revisions, adjustments, refunds, and pilot simulator |

### Tryout launch runbook

Use `docs/CLUB_SEASON_TRYOUT_LAUNCH_RUNBOOK.md` for the November 8-9 14-and-under launch, the November 15-16 15U-18U launch, required admin enhancements, invitation release sequence, and first-family payment monitoring.

### Production feature controls

```text
CLUB_SEASON_REGISTRATION_ENABLED=false
CLUB_SEASON_PILOT_MODE=false
CLUB_SEASON_PILOT_EMAILS=
CLUB_SEASON_CRON_SECRET=<production secret>
CLUB_SEASON_BILLING_EMAIL=loren@tualatinvalleyvb.com
```

The season database field `public_registration_enabled` is a separate lock. General parent access requires both the Netlify feature flag and the season database switch. Pilot access works only under the narrower test-key/allowlist interlocks described in the main requirements document.

### Standard payment schedules

| Division | Due at registration | Jan 5 | Feb 5 | Mar 5 | Apr 5 | May 5 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10U–12U | $300 | $180 | $180 | $180 | $180 | $180 | $1,200 |
| 13U–18U | $400 | $220 | $220 | $220 | $220 | $220 | $1,500 |

There is no standard December charge.

## 8. Documentation Maintenance Rule

Update this file whenever a production configuration step, pilot check, launch blocker, or operational decision changes. Keep detailed product rationale and policy language in `CLUB_SEASON_REGISTRATION_SYSTEM.md`; keep this file focused on actual project state and the next actions.
