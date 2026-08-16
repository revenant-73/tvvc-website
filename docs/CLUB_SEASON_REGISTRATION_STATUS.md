# Club-Season Registration: Current Status and Remaining Work

**Status:** Implemented, deployed dark, and pilot-tested in Stripe test mode

**Last updated:** August 15, 2026

**Production access:** Disabled for general family use

**Primary requirements reference:** [CLUB_SEASON_REGISTRATION_SYSTEM.md](./CLUB_SEASON_REGISTRATION_SYSTEM.md)

## 1. Executive Summary

The club-season registration and payment system is substantially built and deployed. The production database has the complete club-season schema, the shared registration route is private and protected, the administrator workspaces are available, and the end-to-end standard-plan pilot has been completed with Stripe test payments and Resend email delivery.

The system is **not ready to open to all families yet**. The remaining launch work is mostly production configuration, final policy approval, real team setup, live Stripe verification, and final controlled rehearsal—not another large application build.

Current safety position:

- The 2026–2027 club season remains in `draft` status.
- Season-level public registration remains disabled.
- `CLUB_SEASON_REGISTRATION_ENABLED` remains off for general access.
- The page is absent from public navigation and the sitemap and is marked `noindex`.
- Controlled pilot access is restricted to exact allowlisted email addresses and requires Stripe test mode.
- Real families cannot discover or use the system through normal website browsing.

## 2. Confirmed Operating Rules

| Area | Current rule |
| --- | --- |
| Entry point | One shared `/season-registration` link is sent only to families receiving an offer. No unique link is required for each player. |
| Eligibility | Players must already have a paid tryout registration and an administrator-created team offer. |
| Team selection | TVVC assigns the offered team. Parents review that assignment rather than selecting any team themselves. |
| 12U dues | $1,200 total: $300 due at registration, then five $180 automatic payments. |
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
- The 12U tier is $1,200 total: $300 deposit plus five $180 installments.
- The 13U-18U tier is $1,500 total: $400 deposit plus five $220 installments.
- Active age groups 12U through 18U were created and linked to the correct tier.
- Production readiness now passes the standard billing schedule and pricing reconciliation checks.
- No teams, registration dates, offer deadlines, or season dates were invented.
- The season remained `draft`, `public_registration_enabled` remained `0`, and the Netlify registration flag remained off.

Checked-in recovery artifacts:

- `scripts/reconcile-production-club-season-foundation.sql`
- `tests/production-club-season-foundation.test.ts`

## 5. Remaining Work Before Live Family Registration

Complete these items in order. Items marked **Launch blocker** must be finished before sending the shared link to real families.

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

**Foundation completed August 16, 2026:** the two confirmed pricing tiers and all seven age groups are now configured in production. Registration remains closed.

- Confirm season opening and closing timestamps.
- Confirm the normal offer-response deadline.
- Create the actual teams after tryouts determine the number at each age level.
- Assign each team to the correct age group and pricing tier.
- Set realistic roster capacity and activate only teams that will be offered.
- **Completed:** verify 12U maps to $1,200 and 13U–18U maps to $1,500. Recheck each actual team after team creation.
- Confirm season start/end dates if refund proration will be used operationally.

### Step 4 — Finish live service verification

**Launch blocker.**

- Confirm the production Resend sending domain, sender addresses, and reply/contact behavior.
- Record permanent Resend-domain evidence in the launch console.
- Review current Stripe pricing and enabled payment methods.
- Replace test Stripe credentials with the correct live credentials only when ready for the final live rehearsal.
- Create/verify the live Stripe webhook endpoint and required events.
- Confirm Checkout, off-session charging, receipts, refunds, and Billing Portal behavior in the live account.
- Record permanent Stripe live-review evidence.
- Confirm `CLUB_SEASON_CRON_SECRET` and `CLUB_SEASON_BILLING_EMAIL` in the production Netlify environment.
- Confirm the scheduled billing function is enabled and inspect one successful no-op production run before any installment is due.

Never use a real family’s card for the test-mode pilot.

### Step 5 — Close out the controlled pilot

**Launch blocker.**

- Reconcile the pilot payment plan, installments, transactions, attempts, emails, and remaining balance.
- Confirm all six launch-console pilot checks: registration, payment, email, ledger reconciliation, failure recovery, and idempotency.
- Record the controlled-pilot evidence with a clear reference.
- Decide whether pilot records should be retained as labeled test evidence or removed before live offers are created.
- Remove the temporary pilot email allowlist.
- Set `CLUB_SEASON_PILOT_MODE=false` before public activation.

### Step 6 — Run a final prelaunch rehearsal

**Launch blocker.**

- Create one final internal offer using the exact production agreement versions and real season configuration.
- Verify the shared link remains absent from navigation and search indexing.
- Test both standard price tiers.
- Test pay in full and the standard plan.
- Test one custom initial arrangement and one later revision.
- Confirm all emails, receipt access, parent balance, administrator ledger, and guardian restrictions.
- Confirm a duplicate webhook/job run causes no duplicate payment or email.
- Confirm failure does not remove the player from the roster.
- Verify mobile registration and portal layouts.
- Take a fresh Turso backup immediately before opening registration.

Use Stripe’s supported low-risk live verification approach; do not manufacture real charges or refunds without an approved test plan.

### Step 7 — Create real offers

**Launch blocker immediately before opening.**

- Import/review the final tryout roster.
- Assign every offered player to the correct active team.
- Set offer deadlines.
- Bulk-create offers in manageable batches and review counts by team.
- Spot-check ownership, player name, team, price, and deadline before emailing families.
- Prepare the offer email containing the shared registration link, deadline, pricing summary, December pause, payment choices, and custom-plan contact instructions.

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
- Administrator manual email resend controls.
- Resend delivered/bounced webhook tracking.
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
| 12U | $300 | $180 | $180 | $180 | $180 | $180 | $1,200 |
| 13U–18U | $400 | $220 | $220 | $220 | $220 | $220 | $1,500 |

There is no standard December charge.

## 8. Documentation Maintenance Rule

Update this file whenever a production configuration step, pilot check, launch blocker, or operational decision changes. Keep detailed product rationale and policy language in `CLUB_SEASON_REGISTRATION_SYSTEM.md`; keep this file focused on actual project state and the next actions.
