# Club-Season Registration: Current Status and Remaining Work

**Status:** Implemented, deployed dark, and pilot-tested in Stripe test mode

**Last updated:** August 16, 2026

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

**Foundation and dates completed August 16, 2026:** the two confirmed pricing tiers, all seven age groups, invitation window, three-day offer standard, and season bounds are now configured. Registration remains closed.

- **Completed:** registration opens November 8, 2026 at 6:00 PM and closes November 30 at 11:59 PM Pacific.
- **Completed:** the normal offer-response period is three calendar days, with individual extensions available.
- Create the actual teams after tryouts determine the number at each age level.
- Assign each team to the correct age group and pricing tier.
- Set realistic roster capacity and activate only teams that will be offered.
- **Completed:** verify 12U maps to $1,200 and 13U–18U maps to $1,500. Recheck each actual team after team creation.
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

Run payment rehearsals with Stripe test keys. Do not manufacture live charges or refunds; supervise and reconcile the first genuine family payment during the staged rollout instead.

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
