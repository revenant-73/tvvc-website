# Codex Handoff: TVVC Club-Season Registration and Payments

**Purpose:** Give a new Codex task or a different computer enough verified context to continue the TVVC club-season registration and payment project safely.

**Snapshot date:** August 30, 2026
**Repository:** `revenant-73/tvvc-website`  
**Production branch:** `main`  
**Production commit before the Resend webhook env-refresh update:** `00037c9` (`Document production Resend event migration`)
**Current operating state:** Deployed, registration closed, no real offers released, and no invitation emails sent.

## 1. Instructions for Codex

Before taking action:

1. Read `AGENTS.md` completely.
2. Read this handoff completely.
3. Read the relevant detailed references listed in Section 12.
4. Run `git status --short --branch` and inspect the current branch before editing.
5. Preserve unrelated local changes and ignored files.
6. Treat production database writes, registration-lock changes, offer release, invitation sending, live Stripe activity, refunds, and merges as explicit approval boundaries.

Do not assume that a request to inspect, explain, diagnose, document, or prepare authorizes a production mutation. Never release an offer, send an invitation, open registration, create a live charge, issue a refund, or alter production financial history without Loren Anderson's explicit approval for that specific action.

When implementing code, use a `codex/` feature branch, run risk-appropriate tests, push a PR, verify the Netlify Deploy Preview, and wait for approval before merging. Lead with the outcome and explain operational consequences in plain language.

## 2. Product Goal

TVVC needs one private season-registration link that is sent only to families receiving a team offer. A parent signs in using the email associated with the paid tryout registration, reviews the TVVC-assigned player/team offer, supplies the additional season information, accepts the approved agreements, chooses a payment option, and completes Stripe Checkout.

The route is private and unlisted, but security comes from authenticated ownership and offer checks—not secrecy of the URL.

## 3. Confirmed Pricing and Payment Rules

| Division | Total dues | Deposit at registration | Remaining schedule |
| --- | ---: | ---: | --- |
| 10U-12U | $1,200 | $300 | Five automatic payments of $180 |
| 13U-18U | $1,500 | $400 | Five automatic payments of $220 |

Standard schedule:

- Deposit is paid during November registration.
- December is intentionally skipped to reduce holiday financial pressure.
- Installments are charged January 5, February 5, March 5, April 5, and May 5.
- Parent choices are pay in full or the standard automatic plan.
- TVVC may prepare an exact custom initial plan for a family.
- TVVC may later propose a revision to future unpaid installments; the parent must authorize the replacement schedule.
- Stripe stores complete card data. TVVC stores Stripe references and immutable authorization evidence.
- TVVC absorbs Stripe processing fees.
- A failed payment changes financial status and triggers the retry/communication workflow; it does not automatically remove the player from the team.
- The standard billing day is the fifth, but custom plans may use approved individual dates.
- Business dates use `America/Los_Angeles`.

## 4. Confirmed Season and Policy Rules

- Season dates: December 1, 2026 through May 31, 2027.
- Registration window configured in the season record: November 8, 2026 at 6:00 PM through November 30, 2026 at 11:59 PM Pacific.
- Normal offer-response period: three calendar days, with individual extensions available.
- Uniform package: two jerseys, two practice T-shirts, one sweatshirt, and one bag tag.
- CEVA/USA Volleyball membership is purchased separately by families.
- Dues cover the approved tournament schedule, including the additional March tournaments for 12U and 18U.
- Further competitions can increase cost only after team-by-team approval.
- Voluntary withdrawal after the first practice is reviewed case by case.
- Media-release participation is optional, and the administrator offer workspace provides counts and filters for declined, granted, and pending choices.
- Approved parent-facing agreements are published and immutable.
- Club mailing address used in the approved agreements: 27170 NW Dorland Rd, North Plains, OR 97133.

## 5. Team Catalog and Tryout Waves

Production contains 36 possible teams: Teal, Coral, Black, and White for every age from 10U through 18U. They were staged inactive. After tryouts, activate only the teams TVVC will actually field; unused teams remain inactive.

| Wave | Divisions | Tryouts | Invitation emails |
| --- | --- | --- | --- |
| First | 10U-14U | November 8, 2026 | November 9, 2026 |
| Second | 15U-18U | November 15, 2026 | November 16, 2026 |

Existing offers and registrations are intentionally preserved if a team is later deactivated. Deactivation prevents new assignments; it is not a history-erasing switch.

## 6. What Is Already in Production

The deployed system includes:

- private parent magic-link authentication and household ownership enforcement;
- administrator season, pricing, team, agreement, readiness, offer, and finance workspaces;
- private draft and ready offer preparation states;
- wave filters, blocker summaries, team counts, and audited **Mark ready** actions;
- guarded **Open Registration / Close Registration** controls;
- parent registration drafts, agreements, uniform/medical/contact details, and payment selection;
- Stripe Checkout for deposits and pay-in-full payments;
- saved payment methods and parent authorization for automatic plans;
- standard, custom-initial, and parent-authorized revised schedules;
- immutable ledger transactions, adjustments, refunds, credits, write-offs, and reversals;
- a protected automatic billing worker with reminders, retries, and payment emails;
- parent portal balances, schedules, payment-method management, and secure receipts;
- administrator finance reconciliation and a Stripe-test-only recovery simulator;
- controlled invitation preview, administrator test mail, release, initial send, retry, deliberate resend, and append-only history.

Recent production milestones:

- PR #30: November offer preparation workflow.
- PR #31: guarded registration access control.
- PR #32: controlled invitation release workflow.
- PR #33: this Codex handoff was added as the restart reference.
- PR #34: local verification and header navigation fixes.
- PR #35: unused Outdoor Events and Private Training public pages hidden.
- PR #36: summer camp and non-tryout-prep clinic registration closed; only upcoming tryout-prep clinics remain open in the normal event registration system.
- PR #37: Netlify/Astro dependency audit cleanup and Node runtime pin.
- Commit `8826a5d`: non-season event waitlist support for camps, clinics, and tryout-prep clinics; production DB migration `0015_event-waitlists.sql` applied. This does not open or alter club-season registration.
- Commit `5814845`: Resend invitation provider-event ingestion for club-season invitation delivery tracking; production DB migration `0016_resend-invitation-events.sql` applied after creating recovery branch `tvvc-reg-backup-2026-08-23-pre-resend-events`. This does not open registration, release offers, send invitations, or create Stripe activity.

## 7. Current Safety State

As of this snapshot:

- The season is still `draft`.
- The season database registration lock is closed.
- `CLUB_SEASON_REGISTRATION_ENABLED` is closed in production.
- Pilot mode and the pilot allowlist are disabled.
- The registration route remains absent from public navigation and search indexing.
- No production invitation batches exist.
- No real offers have been released through the invitation workflow.
- No invitation emails have been sent through the workflow.
- No artificial live Stripe transaction was created for testing.
- Production `tvvc-registration` has zero club-season offers, zero season registrations, and zero invitation batches.
- Production contains two pricing tiers, nine active age groups, and 36 possible teams; all 36 teams are currently inactive.
- Production has one published version each for `season-commitment`, `refund-cancellation-policy`, and `media-release`.
- Production launch evidence contains one record each for `resend_domain`, `stripe_live_review`, and `controlled_pilot`.
- Production migration `0014_club-season-invitations.sql` is recorded with hash `f629bc2559413abfee5d0f6765c1bd111b0c802409741f7f6f758e3ad78286c1`.
- Non-season event waitlist migration `0015_event-waitlists.sql` is applied in production. It added `events.waitlist_enabled` and `event_waitlist_entries`; it is outside the club-season locks.
- Resend provider-event migration `0016_resend-invitation-events.sql` is applied in production. It added append-only invitation delivery events linked to existing send attempts. The Resend dashboard webhook is registered for `https://tualatinvalleyvb.com/api/webhooks/resend`, Netlify has `RESEND_WEBHOOK_SECRET` configured as a protected environment variable, and production deploy `049d3f6` smoke-tested the endpoint with signature verification active.
- August 23, 2026 read-only verification confirmed zero club-season offers, zero club-season registrations, zero payment plans, zero invitation batches, zero invitation attempts, all 36 teams inactive, and `PRAGMA integrity_check = ok`.
- August 23, 2026 local/test-only rehearsal passed the club-season unit suite (50/50) and Playwright offer/payment suite (15/15) without production writes, live Stripe, or invitation sends.
- August 23, 2026 Deploy Preview #39 completed the 13U-18U standard-plan happy-path rehearsal in the isolated `tvvc-season-pilot` database and Stripe test mode. The parent flow, $400 test Checkout, manually replayed `checkout.session.completed` webhook, confirmation email, parent dashboard, and receipt link all worked. The temporary preview Stripe webhook was disabled afterward, `CLUB_SEASON_PILOT_EMAILS` was deleted from Netlify, and `CLUB_SEASON_PILOT_MODE` was reset to `false` in every Netlify deploy context.
- August 23, 2026 Deploy Preview #39 completed the 10U-12U pay-in-full happy-path rehearsal in the isolated `tvvc-season-pilot` database and Stripe test mode. The seeded test offer was `Payin Full Pilot` on `12U Pilot` for `loren+tvvc-12u-pif-pilot@tualatinvalleyvb.com`. Checkout session `cs_test_a1jPETcXH2Gflp7xwUxjGP1036XXa32UNeo0rz3UuqHSwN0u7yqXBHB0E2` charged a $1,200 sandbox pay-in-full payment. The parent confirmation page, database records, confirmation email, and parent dashboard all showed paid in full, $0 remaining balance, and no future automatic club-season charges. After the rehearsal, the temporary preview Stripe webhook was disabled, `CLUB_SEASON_PILOT_EMAILS` was deleted from Netlify, and `CLUB_SEASON_PILOT_MODE` was reset to `false` in every Netlify deploy context.
- The local and production source currently require Node `>=22.12.0`.
- `npm audit` is reduced as far as currently reasonable without downgrading Astro/Netlify tooling: five high entries remain, all tracing to `extract-zip@2.0.1` through Netlify's latest `@netlify/functions-dev@2.0.1`. There is no patched upstream `extract-zip` or newer `@netlify/functions-dev` release at this snapshot.

The invitation UI may be visible to an authenticated administrator while the locks remain closed. That is expected; release and sending remain blocked.

### August 23, 2026 deploy-preview rehearsal notes

These notes preserve the current thread's operational context for the next Codex session:

- Working branch: `codex/deployed-rehearsal-2026-08-23`.
- Relevant branch commits before this note: `088c107` triggered the rehearsal preview, `d7703b6` rebuilt with the parent pilot alias, `72f926f` rebuilt after auth trust env, `c9a43ed` rebuilt after Stripe webhook secret setup, `d9dadce` documented the first deployed rehearsal cleanup, `456a75c` rebuilt for the 12U pay-in-full pilot, and `b9b3927` documented the 12U pay-in-full rehearsal.
- Deploy Preview #39 completed and then closed again. The post-cleanup preview build from `b9b3927` finished successfully, and `/season-registration` returned `NO ACTIVE OFFER FOUND`.
- Temporary Stripe test webhook destination `we_1U7fqaFzgaoVZJWYIVzh1akm` was disabled after the rehearsals. It was not deleted, so Stripe test delivery history should still be available.
- `CLUB_SEASON_PILOT_EMAILS` was deleted from Netlify.
- `CLUB_SEASON_PILOT_MODE` was verified as `false` for Production, Deploy Previews, Branch deploys, Preview Server & Agent Runners, and Local development (Netlify CLI).
- The pilot database `tvvc-season-pilot` intentionally retains rehearsal evidence for the 13U standard-plan and 12U pay-in-full test families.
- No production database writes, live Stripe charges, registration opening, offer release, or invitation sends happened during the deployed rehearsals.

## 8. Databases, Migrations, and Recovery

| Environment | Turso database | Purpose |
| --- | --- | --- |
| Production | `tvvc-registration` | Live website and future real family registrations |
| Deploy Preview / pilot | `tvvc-season-pilot` | Isolated Stripe-test rehearsal data |

Migration `0014_club-season-invitations.sql` is applied to both databases. Each contains:

- three invitation tables;
- 14 invitation indexes;
- six immutability triggers;
- exactly one `0014` Drizzle migration record.

The pilot verification returned foreign-key counts `3/2/3`, zero foreign-key violations, zero duplicate migration records, and `PRAGMA integrity_check = ok`.

Recovery branches retained from the rollout:

- Production: `tvvc-reg-backup-2026-08-22-pre-invitations`.
- Pilot: `tvvc-season-pilot-backup-2026-08-22-pre-invitations`.

Never infer the database target from a local `.env`. The work-computer `.env` has previously pointed at an unrelated legacy database. Verify the exact database name and URL before any migration or write.

## 9. External Services and Environment Boundaries

- **Netlify:** production deployment and environment variables. Production uses live Stripe keys; Deploy Previews use isolated/test settings.
- **Turso:** production and pilot LibSQL databases.
- **Stripe:** Checkout, saved payment methods, off-session charges, receipts, refunds, Billing Portal, and webhooks.
- **Resend:** transactional registration, invitation, reminder, payment, failure, and plan emails.
- **GitHub:** source of truth for committed code, documentation, migrations, and PR history.

Secrets are not stored in GitHub. A fresh home-computer clone can still be developed and tested through Netlify Deploy Previews without copying the work-computer `.env`. Full local authenticated integration testing requires recreating an appropriate local `.env`; never commit it.

## 10. Remaining Work Before November Launch

Immediate next step after this snapshot: continue the final prelaunch rehearsal in an isolated/test environment. The 13U-18U standard-plan and 10U-12U pay-in-full happy paths passed on Deploy Preview #39; the remaining cases are custom initial plan, later plan revision, duplicate-event idempotency, failure recovery, administrator ledger review, guardian restrictions, and mobile layouts. Do not open registration, activate real teams, release offers, send invitations, or create live Stripe activity as part of that rehearsal unless Loren explicitly approves that specific production action.

### Before November 8

1. Continue the final end-to-end rehearsal in the isolated/test environment.
2. Test the remaining custom initial plan and later plan revision cases.
3. Confirm administrator ledger, guardian restrictions, duplicate-event protection, failure recovery, and mobile layouts.
4. Approve the final 10U-14U invitation email preview.
5. Take a fresh Turso backup immediately before live opening.

### November 8: 10U-14U preparation

1. Activate only the teams TVVC will field.
2. Assign offered players to active teams.
3. Create private draft offers and set deadlines.
4. Resolve missing email, ownership, inactive-team, duplicate, and pricing blockers.
5. Mark reviewed offers ready.
6. Do not release offers or send invitations that day.

### November 9: first controlled release

1. Recheck launch readiness and live-service configuration.
2. Use the guarded admin control to open registration.
3. Test the shared link with an internal offered account and an unrelated account.
4. Preview the invitation and send only an administrator test email.
5. Release one reviewed team batch; release makes offers visible but sends nothing.
6. Send that released batch and verify Resend acceptance.
7. Closely monitor the first 5-10 family registrations and reconcile payments before continuing.

### November 15-16: second wave

Repeat the assignment, review, release, send, and monitoring process for 15U-18U. Registration may already be open for younger families; do not close and reopen it unnecessarily.

## 11. Commands for a Home Computer

```powershell
git clone https://github.com/revenant-73/tvvc-website.git
cd tvvc-website
node --version   # must satisfy package.json: >=22.12.0
npm ci
git status --short --branch
npm run build
```

Useful test commands:

```powershell
npm test
npm run test:headed
npm run test:ui
```

If local secrets are unavailable, do not invent them. Implement on a feature branch, push a PR, and use the configured Netlify Deploy Preview for integrated testing.

Suggested opening prompt for Codex on another computer:

> Read AGENTS.md and docs/CODEX_TVVC_PAYMENT_PROJECT_HANDOFF.md completely. Then read the detailed status and runbook files it references, inspect git status and the latest commits, and summarize the current safe state before proposing the next step. Do not perform production writes, open registration, release offers, send emails, or create live Stripe activity without my explicit approval.

## 12. Authoritative References

- `AGENTS.md` — repository instructions, architecture, commands, and working style.
- `docs/CLUB_SEASON_REGISTRATION_SYSTEM.md` — complete system requirements and policy design.
- `docs/CLUB_SEASON_REGISTRATION_STATUS.md` — detailed implementation and production history.
- `docs/CLUB_SEASON_TRYOUT_LAUNCH_RUNBOOK.md` — November 8-9 and November 15-16 operating procedure.
- `docs/CLUB_SEASON_AGREEMENT_APPROVAL_PACKET.md` — approved parent-facing agreement checklist.
- `src/db/schema.ts` and `drizzle/` — authoritative database schema and migrations.
- `src/pages/admin/club-season.astro` — season control and launch readiness.
- `src/pages/admin/club-season/offers.astro` — offer preparation and invitation release console.
- `src/pages/admin/club-season/finances.astro` — financial operations and reconciliation.

If this handoff conflicts with current code, database evidence, or a newer dated status entry, stop and investigate rather than silently choosing one source.
