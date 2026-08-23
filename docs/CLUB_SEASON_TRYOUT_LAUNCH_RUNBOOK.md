# TVVC 2026-2027 Club-Season Tryout Launch Runbook

**Runbook owner:** TVVC administrator  
**14-and-under tryouts:** November 8, 2026  
**14-and-under invitation date:** November 9, 2026  
**15U-18U tryouts:** November 15, 2026  
**15U-18U invitation date:** November 16, 2026  
**Registration route:** `/season-registration` (private, unlisted, and limited to verified offered families)

## 1. Goal

The November 8-9 and November 15-16 launch waves must be administrator workflows, not coding or deployment exercises. Before the first tryout weekend, the system should be configured so the administrator can:

1. activate only the teams TVVC will field;
2. assign offered players to those teams;
3. review player, team, price, and deadline information before release;
4. open or close family registration with an audited admin control;
5. send and, when needed, resend invitation emails;
6. monitor offer responses, email results, registrations, and payments.

No code changes, commits, manual production SQL, or launch-day Netlify editing should be required during either tryout and invitation wave.

## 2. Launch Waves

The launch will occur in two separate waves:

| Divisions | Tryouts | Invitation release |
| --- | --- | --- |
| 10U-14U | November 8, 2026 | November 9, 2026 |
| 15U-18U | November 15, 2026 | November 16, 2026 |

The first wave covers 10U through 14U. The 15U through 18U teams remain inactive and receive no offers until their November 15 tryouts are complete. The second wave follows the same activation, assignment, review, release, and monitoring process on November 15-16.

The staged possible-team catalog contains Teal, Coral, Black, and White at every age from 10U through 18U. Only teams TVVC is actually fielding should be activated. Unused teams remain inactive and unavailable for new offers.

## 3. Configuration to Complete Before Tryout Weekend

Complete and rehearse the following before November 8:

- Set the season to active internally while keeping family registration closed.
- Enable the Netlify club-season feature flag in advance. The separate season database lock must remain closed, so enabling this flag alone does not give families access.
- Rehearse the guarded **Open Registration / Close Registration** control. Opening requires every launch check, an audit reason, and the exact confirmation phrase; emergency close remains available at any time.
- Prepare and approve the 14-and-under offer-email template.
- Use the administrator email preview and test-send workflow to approve the final template without contacting a family.
- The offer workspace now provides team-scoped preview, administrator-only test sending, atomic release, initial sending, failed-message retry, deliberate resend, and per-recipient history. Release and send remain separate actions.
- Use the 10U-14U wave filter and launch summary to review team counts, missing assignments, ineligible records, and other items needing attention.
- Keep assignments in the private draft/review states while preparing teams on November 8; draft and ready offers remain unavailable to families.
- Configure the normal three-calendar-day response period. For invitations sent November 9, the default deadline is November 12, 2026 at 11:59 PM Pacific. For invitations sent November 16, the default deadline is November 19, 2026 at 11:59 PM Pacific. Individual deadlines may still be extended.
- Run the final prelaunch rehearsal with Stripe test keys and take the required Turso backup.
- Verify the private registration route remains absent from public navigation and search indexing.

### Current implementation boundary

The admin dashboard already supports:

- activating and deactivating teams;
- selecting eligible tryout players;
- assigning players to an active team;
- setting offer deadlines;
- creating offers in batches;
- opening registration only after a fresh readiness check and exact typed confirmation;
- emergency-closing registration without changing offers, completed registrations, payments, or ledger history;
- viewing registration and financial activity.

The November offer-preparation milestone is published in production. It adds:

- separate November 8 and November 15 operational-wave views;
- private draft offers that do not set an offered timestamp;
- editable team and deadline assignments while offers remain draft or ready;
- a readiness rail with eligible, draft, ready, released, unassigned, and blocking counts;
- blocker categories for missing email, ownership mismatch, and inactive-team references;
- team-by-team prepared counts and explicit assignment conflicts;
- an audited **Mark ready** review action;
- server-side isolation that makes draft and ready offers invisible and unusable to parents, including guessed offer identifiers.

The guarded open/close control has completed preview review. Opening is blocked unless the feature flag, live Stripe review, agreements, active teams, schedule, email configuration, billing protection, and controlled-pilot evidence all pass. Closing remains available as an emergency brake and pauses new or unfinished registration activity without altering completed records.

The invitation-release workflow is implemented and verified in Deploy Preview #32. Its append-only migration `0014` was applied to both `tvvc-registration` and the isolated `tvvc-season-pilot` preview database on August 22, 2026. Recovery branches `tvvc-reg-backup-2026-08-22-pre-invitations` and `tvvc-season-pilot-backup-2026-08-22-pre-invitations` were retained. Preview verification confirmed an empty invitation history with no released offers and no email sends. PR #32 must be merged before these invitation controls are available in production.

The following items remain planned work before this runbook can be performed entirely from the dashboard:

- Resend delivery/bounce/complaint webhook ingestion remains a later enhancement. For launch, `sent` means Resend accepted the API request; the administrator should still monitor the Resend dashboard for downstream delivery events.

## 4. Tryout-Day Team Selection and Offer Preparation

Do not send invitations for the current wave during this stage. Keep family registration closed before the first wave; during the second wave, previously offered younger families may continue using the already-open registration system.

Use this procedure on November 8 for 10U-14U and again on November 15 for 15U-18U.

1. Sign in to `/admin/club-season`.
2. Activate only the 10U-14U teams TVVC will field.
3. Confirm each activated team inherited the correct pricing:
   - 10U-12U: $1,200 total, $300 deposit, and five $180 installments.
   - 13U-14U: $1,500 total, $400 deposit, and five $220 installments.
4. Open `/admin/club-season/offers` and filter to the applicable age group.
5. Assign each offered player to the correct active team.
6. Save the assignments as draft offer batches.
7. Review every team summary for roster count, player names, parent email ownership, price, and response deadline.
8. Resolve all missing assignments, duplicates, ownership mismatches, and ineligible records.
9. Leave unused possible teams inactive.
10. End tryout day with that wave's invitation emails still unsent. On November 8, keep family registration closed until the controlled November 9 opening. On November 15, registration may already be open for the younger wave, but no 15U-18U invitations should be released until their review is complete.

A ready summary should make exceptions obvious, for example:

```text
12 Teal       10 offers ready
12 Coral       9 offers ready
13 Teal       11 offers ready
Unassigned     2 players
Needs review   1 player
```

## 5. Invitation-Day Controlled Release

Use this procedure on November 9 for 10U-14U and again on November 16 for 15U-18U. The registration-open action is required for the first wave; for the second wave, confirm that registration remains open rather than toggling it unnecessarily.

1. Review the launch-readiness console and confirm all blocking checks pass.
2. Confirm Stripe production keys and webhooks are active and pilot access is disabled.
3. Confirm the approved agreement versions, active teams, prices, registration dates, and offer deadlines.
4. For the first wave, use the guarded admin control to open the season database registration lock. For the second wave, confirm the lock remains open; do not close and reopen it unnecessarily.
5. Test the shared registration link with an internal offered-family account.
6. Test the same link with an unrelated account and confirm that no offer is exposed.
7. In **Invitation release**, select one team, preview the authoritative email, and send a test copy to the signed-in administrator.
8. With both registration locks open, type `RELEASE INVITATIONS` and record the reason. Confirm the offers become family-visible and that no email was sent by the release action.
9. Select the released batch, type `SEND INVITATIONS`, and send a small initial team-sized batch.
10. Confirm successful Resend processing and verify that the invitations contain the correct player, team, deadline, price, and link.
11. Send the remaining invitations in manageable team-by-team batches. Use **Retry failed** only for failed attempts; use the coral deliberate-resend panel only when a previously accepted message truly must be sent again.

The workspace derives delivery status from each recipient's latest immutable attempt. A successful retry clears that recipient's current failed state while preserving the failed attempt in history. Closing either registration-access lock pauses initial sends, retries, and deliberate resends immediately.
11. Monitor sent, failed, registration-started, accepted, declined, and expired counts.

The invitation email must include:

- player name and offered team;
- the applicable response deadline: November 12 for the first wave or November 19 for the second wave, unless individually extended;
- the private shared registration link;
- the correct total dues and deposit;
- the January-May automatic-payment schedule on the fifth of each month;
- the December payment break;
- pay-in-full and standard-plan choices;
- instructions to contact TVVC for a custom payment arrangement.

## 6. First-Family Payment Monitoring

Closely supervise the first 5-10 registrations before releasing every remaining invitation.

For each early registration:

- reconcile the Stripe payment with the TVVC ledger;
- verify the registration status and remaining balance;
- confirm the registration email and Stripe receipt link;
- inspect Stripe webhook delivery, Resend results, and Netlify function logs;
- verify that no duplicate webhook or scheduled-job run creates a duplicate payment or email.

If a money, ownership, email, or reconciliation mismatch appears, close registration to new activity and pause the remaining invitation release. Do not alter or delete correctly completed registrations.

After the first cohort reconciles cleanly, send the remaining prepared invitation batches.

## 7. Administrator Safety Rules

- Opening registration must never activate teams or send invitations automatically.
- Sending invitations must never change pricing or team assignments.
- Closing registration must prevent new starts without cancelling completed registrations or accepted offers.
- Inactive teams must remain unavailable for new offers while preserving any existing offer and registration history.
- Rehearsal payments must use Stripe test keys. Never use real payment details to manufacture a live-mode test.
- Every registration-state change and invitation batch must record the administrator, timestamp, reason, and result.

## 8. Completion Standard

This runbook is ready for operational use when the administrator can complete both launch waves entirely through the authenticated admin experience, except for read-only verification in Stripe, Resend, and Netlify. No repository edit, commit, production SQL command, or environment-variable change should be necessary during either tryout weekend.
