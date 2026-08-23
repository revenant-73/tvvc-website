# TVVC Season Registration & Club Operations System
## Product Specification, Audit Brief, and Upgrade Recommendation for Codex

**Version:** 1.0  
**Prepared:** August 23, 2026  
**Purpose:** Review the existing TVVC registration system, identify gaps, and recommend targeted upgrades without rebuilding functionality that already works.

---

# 1. Codex Mission

You are reviewing an **existing TVVC season registration system**, not designing a greenfield application.

Your job is to:

1. Inspect the repository and understand the current architecture, data model, routes, UI, integrations, authentication, payments, and completed workflows.
2. Map the current system against the target product specification below.
3. Identify what is:
   - **Implemented and solid**
   - **Implemented but incomplete**
   - **Implemented but architecturally risky**
   - **Missing**
   - **Duplicated**
   - **Out of scope / should remain deferred**
4. Recommend the **smallest coherent set of upgrades** that improves the product.
5. Preserve functioning features and existing user data.
6. Prefer incremental migrations over rewrites.
7. Do **not** begin a large refactor merely because existing names, tables, components, or patterns differ from this document.

## Required first deliverable

**Do not immediately start changing code.**

First produce:

### A. Current-State Architecture Summary
- framework/runtime
- database and ORM
- authentication
- payment provider
- email/notification provider
- hosting/deployment assumptions
- main domain entities
- major routes/pages
- existing admin tools
- existing parent/family tools
- current registration workflow
- current non-season event/product registration workflow
- current payment workflow
- current roster/team workflow

### B. Gap Matrix

Use this structure:

| Capability | Current Status | Existing Implementation | Gap/Risk | Recommendation | Priority |
|---|---|---|---|---|---|
| Household accounts | Complete / Partial / Missing | ... | ... | ... | P0-P3 |

### C. Upgrade Plan
Organize recommended work into:
- **P0 — correctness/security/data integrity**
- **P1 — essential season registration**
- **P2 — major administrative efficiency**
- **P3 — useful future enhancements**
- **Defer — unnecessary for TVVC right now**

Only after completing this review should implementation begin.

---

# 2. Product Goal

TVVC needs a system that makes this pipeline simple:

**Family → Athlete → Registration → Tryout → Offer → Acceptance → Payment → Team Roster**

TVVC also needs the same core account, athlete, registration, payment, receipt, and administrative foundation to support **non-season offerings**:

**Family → Athlete → Event/Product → Registration or Waitlist → Payment → Attendance/Roster/Receipt**

Non-season offerings include:
- camps
- clinics
- tryout-prep clinics
- outdoor events/tournaments
- private training blocks
- one-off events
- merchandise, add-ons, or other products TVVC may sell outside the club-season offer workflow

The primary product objective is not to imitate a large commercial sports-management suite.

The objective is to give TVVC a clean, reliable system for:

- maintaining household and athlete records
- registering athletes for seasons and programs
- registering athletes for non-season camps, clinics, outdoor events, training blocks, and other standalone products
- enforcing or explaining eligibility
- collecting waivers and required information
- managing event capacity and waitlists
- managing tryouts and player status
- making team offers
- accepting roster spots
- collecting and tracking payments
- handling payment plans and financial assistance
- forming rosters
- identifying unfinished administrative work
- exporting clean data when another organization requires it

Every important item should exist in **one canonical place** and flow through the system rather than being repeatedly copied.

---

# 3. Product Principles

## 3.1 One athlete, one record

A returning athlete should not become a new database record every season.

The athlete record persists.

Seasons, registrations, tryouts, offers, payments, and roster memberships reference that athlete.

## 3.2 Household-centered family experience

The account belongs primarily to the household/guardian.

One household may contain:
- multiple guardians
- multiple athletes
- shared contact information
- different relationships between adults and athletes

A parent should be able to register multiple children without re-entering family information.

## 3.3 Registration is not the athlete

Do not put season-specific answers directly onto the permanent athlete record unless they truly belong there.

Examples:

**Permanent / reusable**
- legal name
- preferred name
- date of birth
- guardian relationships
- emergency contacts
- primary phone
- school
- graduation year
- general position preference

**Registration-specific**
- desired program
- current season position interest
- shirt/jersey sizing when requested
- medical acknowledgements
- travel acknowledgements
- waiver signatures
- custom program questions

## 3.4 Status should be explicit

Administrators should never have to infer whether a player:
- registered
- checked in
- received an offer
- accepted
- paid
- completed documents
- was rostered

Use explicit status fields and clear UI status indicators.

## 3.5 No destructive magic

Automations should help, but important actions must be visible and auditable.

Examples:
- accepting an offer may create a pending roster membership
- payment confirmation may activate a registration
- cancelling a registration may create a refund workflow

The system should record these transitions.

## 3.6 Mobile-first for families

A family should be able to complete registration comfortably from a phone.

## 3.7 Fast admin workflows

Director/admin workflows may be optimized for desktop/tablet and should support:
- filters
- search
- bulk actions
- inline status visibility
- exports
- saved views where useful

## 3.8 Do not rebuild tools TVVC already uses well

This application should own TVVC's **registration and administrative source of truth**.

Full team chat, social feeds, and complex season scheduling are not core requirements unless the existing application already provides them well.

---

# 4. Recommended Product Boundary

## Core system ownership

The TVVC application should own:

- accounts
- households
- athlete records
- seasons/programs
- non-season events/products
- eligibility
- registration
- capacity and waitlists
- required forms
- waivers
- tryout registration/check-in
- player decision pipeline
- offers
- acceptance/decline
- financial commitments
- payment tracking
- payment plans
- financial aid/credits
- rosters
- transactional notifications
- reports/exports
- audit history

## Optional integration boundary

Other tools may continue to own:

- team social communication
- ongoing parent/player discussion
- detailed team calendars
- tournament management
- competition standings
- public website content

Avoid adding these just to claim the product is "all in one."

## Non-season registration boundary

The TVVC application should treat camps, clinics, outdoor events, training blocks, one-off events, and standalone products as first-class registration offerings, not as disconnected side forms.

Non-season registrations should reuse:
- household/account identity
- persistent athlete profiles
- guardian contact information
- versioned waiver/agreement infrastructure where applicable
- Stripe customer and payment references
- receipts and parent order history
- admin registration, roster/attendance, finance, refund, and export tools

Non-season registrations do **not** need to inherit every club-season concept.

Examples that should remain club-season-specific unless explicitly needed:
- team offers
- offer deadlines
- accepted roster spots
- installment dues schedules
- roster activation after deposit

The goal is shared infrastructure with distinct workflows, not one giant registration blob wearing a fake mustache.

---

# 5. Users and Roles

Implement or confirm role-based access.

## 5.1 Club Director / Super Admin

Can:
- manage all seasons/programs
- view all athlete/household information
- configure registration
- manage eligibility
- manage tryouts
- send offers
- create/modify rosters
- view financial information
- approve aid
- issue credits/refunds
- export records
- manage users/roles
- view audit history

## 5.2 Club Admin

Configurable subset of director permissions.

Typical permissions:
- registrations
- rosters
- forms
- tryouts
- communication
- payments

Sensitive financial controls may remain director-only.

## 5.3 Coach / Evaluator

Can access only information necessary for assigned teams/programs.

Possible permissions:
- tryout attendee list
- athlete name/preferred name
- grad year
- position
- evaluation notes/tags
- roster recommendations
- assigned team roster

Should **not** automatically receive:
- household financial details
- financial aid details
- payment card information
- unnecessary medical/private family information

## 5.4 Guardian

Can:
- manage own household
- create/update athlete profiles
- register athletes
- complete forms
- sign waivers
- view offers
- accept/decline offers
- select payment options
- make payments
- see balances
- view receipts/credits/refunds
- view roster/team assignment when released

## 5.5 Athlete account

Not required for MVP.

If later supported:
- parent/guardian linkage is mandatory for minors
- direct communication rules must account for athlete safety requirements
- no athlete should independently control financial or legal-waiver actions

---

# 6. Core Domain Model

**Important:** These are semantic entities, not mandated table names.

If the current schema already represents them cleanly, preserve it.

## Identity and household

### User
Authentication identity.

Suggested fields:
- id
- email
- authentication provider id
- status
- last_login_at
- created_at
- updated_at

### Household
Family account container.

Suggested fields:
- id
- display_name
- primary_guardian_id
- billing_contact_id
- status
- created_at
- updated_at

### Guardian Profile
Adult member connected to one or more athletes.

Suggested fields:
- id
- user_id if login-enabled
- household_id
- first_name
- last_name
- email
- phone
- relationship metadata
- address fields as needed

### Athlete
Persistent player identity.

Suggested fields:
- id
- household_id
- legal_first_name
- legal_last_name
- preferred_name
- date_of_birth
- graduation_year
- school
- primary_position
- secondary_position
- gender/program eligibility fields only when actually required
- status
- created_at
- updated_at

### GuardianAthleteRelationship
Use if relationships cannot be represented cleanly through household membership alone.

Examples:
- parent
- guardian
- stepparent
- authorized adult

---

# 7. Seasons and Programs

## Season

Example:
`2027 Club Season`

Fields may include:
- id
- name
- year
- status: DRAFT / PUBLISHED / ACTIVE / CLOSED / ARCHIVED
- registration_open_at
- registration_close_at
- timezone
- default waiver set
- created_at

## Program

A season may contain multiple programs.

Examples:
- 12U
- 14U Tryouts
- 15U
- 16U
- summer camp
- hitting clinic

Recommended fields:
- id
- season_id
- program_type
- name
- description
- min/max capacity
- waitlist_enabled
- price
- deposit
- registration_open_at
- registration_close_at
- eligibility_rule_set_id
- payment_plan_configuration
- status

Recommended `program_type` values:
- CLUB_SEASON
- TRYOUT
- CAMP
- CLINIC
- EVENT
- OTHER

Do not create separate software architecture for every program type unless behavior genuinely differs.

---

# 8. Configurable Eligibility

Eligibility should be **data-driven**, not hard-coded into application code.

Youth sport age rules can change.

Support an eligibility rule set per season/program.

Possible rules:
- birthdate from/to
- graduation year
- grade
- manually approved exception
- program-specific restriction
- capacity availability

The UI should:

1. Determine programs for which the athlete is eligible.
2. Clearly explain why an athlete is or is not eligible.
3. Allow an authorized admin override.
4. Require a reason for overrides.
5. Record override in the audit log.

Avoid scattering age calculations throughout UI components.

Create one canonical eligibility service/function.

---

# 9. Registration

## 9.1 Registration flow

Recommended family flow:

1. Sign in/create household account
2. Select athlete
3. Confirm/update athlete information
4. Show eligible programs
5. Select program
6. Complete program-specific questions
7. Complete required documents/waivers
8. Review costs
9. Select payment option if payment is required at this stage
10. Submit
11. Display confirmation and outstanding requirements

## 9.2 Registration statuses

Recommended canonical states:

- DRAFT
- SUBMITTED
- CONFIRMED
- WAITLISTED
- CANCELLED
- WITHDRAWN

Do not overload payment status, tryout status, and roster status into the registration status.

## 9.3 Dynamic forms

Admins should be able to configure questions without code changes.

Field types:
- short text
- long text
- number
- date
- select
- multiselect
- checkbox
- yes/no
- file upload only if genuinely required

Features:
- required/optional
- conditional display
- helper text
- program-specific fields
- season-specific fields
- versioning

Do not use dynamic forms for permanent athlete fields that deserve structured first-class database fields.

## 9.4 Duplicate detection

Before creating an athlete, check for likely duplicates using signals such as:
- exact DOB + similar name
- same household + similar name
- guardian email + DOB

Do not auto-merge uncertain records.

Provide an admin merge workflow if duplicates already exist.

---

# 10. Waivers and Documents

Waivers must be versioned.

Recommended entities:

### WaiverDefinition
- id
- title
- body/version snapshot
- version
- active_from
- active_to
- signature_required
- programs/seasons to which it applies

### WaiverSignature
- waiver_definition_id
- athlete_id
- signing_guardian_id
- signed_at
- displayed_version/hash
- typed signature or equivalent acknowledgement
- optional request metadata appropriate to the current architecture

Important behavior:

- Never silently treat a signature on an old waiver version as agreement to materially changed terms.
- Preserve the exact version accepted.
- Allow reusable season-wide waivers so families are not repeatedly signing the same document.
- Admin can see missing documents by player.

Potential waiver categories:
- liability/release
- emergency medical authorization
- media/photo
- conduct expectations
- financial policy
- travel/transport acknowledgment when relevant

---

# 11. Tryout Workflow

The system should support tryouts without forcing TVVC into a rigid scouting model.

## 11.1 Tryout registration

Tryout program registration should feed directly into:
- check-in list
- evaluation list
- candidate pipeline

No duplicate spreadsheet should be required.

## 11.2 Check-in

Mobile/tablet-friendly.

Features:
- search
- alphabetical list
- checked-in toggle
- late arrival
- withdrawn/no-show
- optional printable or assignable tryout identifier if TVVC ever wants one
- instant attendee count

## 11.3 Evaluation

Evaluation fields should be **configurable**.

Do not hard-code a large 1-5 skill rubric.

Support:
- free notes
- standout/attention flag
- position observed
- team recommendation
- evaluator identity
- timestamp
- configurable tags
- optional quantitative measurements if TVVC chooses to use them

Multiple evaluators should be able to provide independent input.

Do not overwrite one evaluator's notes with another's.

## 11.4 Candidate journey

Represent the player journey separately from registration.

Suggested states:

- TRYOUT_REGISTERED
- CHECKED_IN
- EVALUATED
- DECISION_PENDING
- OFFERED
- ACCEPTED
- DECLINED
- NOT_OFFERED
- WAITLISTED
- ROSTERED
- WITHDRAWN

Some of these may be derived rather than stored.

Codex should choose the cleanest design that avoids contradictory states.

---

# 12. Team Offers

Team offer management is a high-priority workflow.

## Offer entity

Suggested fields:
- id
- athlete_id
- team_id
- season_id
- offer_status
- sent_at
- expires_at
- viewed_at
- accepted_at
- declined_at
- withdrawn_at
- financial_terms_snapshot
- message_template_version
- created_by

## Offer states
- DRAFT
- SENT
- VIEWED
- ACCEPTED
- DECLINED
- EXPIRED
- WITHDRAWN

## Requirements

Admin can:
- select one or many athletes
- assign proposed team
- preview offers
- send offers
- see pending responses
- resend/remind
- withdraw incorrect offers before acceptance
- define optional expiration deadline

Family can:
- view team and season information
- see financial commitment
- accept
- decline
- complete required next steps

Guardrail:
- prevent accidental duplicate active offers for conflicting teams unless explicitly allowed

---

# 13. Offer Acceptance → Registration → Roster

This transition should be deliberate and predictable.

Recommended model:

**Offer accepted**
→ confirm season registration or create it if the system uses tryout-only registration first  
→ create financial obligation  
→ create `PENDING` roster membership  
→ collect required deposit/payment/waivers  
→ move membership to `ACTIVE` when configured activation requirements are satisfied

This gives TVVC flexibility.

Possible team membership statuses:
- PENDING
- ACTIVE
- WITHDRAWN
- RELEASED
- COMPLETED

Do not use roster membership alone to indicate whether financial obligations are satisfied.

---

# 14. Team and Roster Management

## Team

Fields:
- season
- name
- age/division
- head coach
- assistants
- target roster size
- max roster size
- status

## Roster screen

Must show at a glance:
- athlete
- position
- grad year
- offer status
- acceptance status
- registration completeness
- waiver completeness
- payment status
- roster status

Support:
- search/filter
- drag/drop only if it materially improves usability
- manual assignment
- bulk assignment
- move between teams
- prevent duplicate active team membership where inappropriate
- roster count/capacity
- export

An athlete profile should show season history rather than overwriting last year's team.

---

# 15. Payments and Financial Obligations

The application should separate:
- what the family owes
- how they intend to pay
- individual payment transactions

Do not treat a successful Stripe/etc. charge as the entire financial model.

## Recommended financial concepts

### Invoice / Financial Obligation
Total amount owed for a registration or other charge.

### Payment Plan
Rules for dividing the balance.

### Installment
A scheduled amount/due date.

### Payment Transaction
Actual processor transaction.

### Credit
Money/value applied against an obligation.

### Refund
Money returned.

### Discount
Rule reducing price.

### Financial Aid Award
Approved assistance.

### Donation
Voluntary contribution separate from program price.

If existing architecture combines some of these cleanly, do not split them merely to match terminology.

---

# 16. Payment Options

Support configuration such as:

- pay in full
- deposit + scheduled installments
- custom admin-approved plan
- no-charge registration
- balance due after offer acceptance

Potential payment methods depend on current provider.

If using a third-party payment processor:
- never store raw card numbers
- use provider tokenization
- use idempotent webhook processing
- persist external transaction IDs
- handle webhook retries
- reconcile local and provider status safely

## Payment status

Recommended obligation states:
- OPEN
- PARTIALLY_PAID
- PAID
- PAST_DUE
- VOID
- REFUNDED
- PARTIALLY_REFUNDED

Installment states:
- SCHEDULED
- DUE
- PROCESSING
- PAID
- FAILED
- WAIVED
- CANCELLED

---

# 17. Automated Payment Reminders

Recommended default automation:

- upcoming payment reminder approximately 3 days before due date
- failed payment notice
- past-due notice
- receipt after successful payment
- admin alert or dashboard task after repeated failure

Make cadence configurable.

Every notification should be logged.

Do not send duplicate reminders because of repeated job execution.

---

# 18. Financial Aid

TVVC should have first-class financial assistance rather than hidden manual discounts.

## Financial Aid Application

Potential fields:
- athlete/household
- season/program
- requested assistance
- optional explanation/questions configured by TVVC
- status
- submitted_at

## Aid states
- DRAFT
- SUBMITTED
- UNDER_REVIEW
- APPROVED
- PARTIALLY_APPROVED
- DENIED
- WITHDRAWN

## Financial Aid Award
- fixed dollar or percentage award
- approved_by
- approved_at
- season/program
- funding source
- internal note
- family-visible note

The system should report:
- budget allocated
- aid awarded
- aid used
- remaining aid budget

Aid information is sensitive and should not be visible to coaches by default.

---

# 19. Pay-It-Forward / Donations

Recommended feature:

At checkout or payment:
- allow an optional donation
- preset amounts + custom amount
- clearly label it as optional
- associate it with a configured fund/campaign

Potential campaign:
- TVVC Pay-It-Forward / player assistance fund

Report:
- donations collected
- donations by campaign
- aid awards funded
- current fund balance if TVVC wants accounting at this level

Keep donations separate from registration revenue in data and reports.

---

# 20. Discounts

Support:
- fixed amount
- percentage
- promo code
- sibling/household discount
- admin-applied adjustment
- expiration date
- max uses
- program restrictions

Every discount should retain:
- rule/source
- amount
- who applied it if manual

Avoid untraceable direct edits to a family's balance.

---

# 21. Credits, Cancellations, and Refunds

Admin needs a clean workflow for:
- cancel registration
- withdraw athlete
- issue full refund
- issue partial refund
- issue account credit
- apply existing credit to another registration
- waive remaining obligation

Recommended addition:
### Batch cancellation/refund
Useful when an entire clinic/event is cancelled.

The system should:
1. identify affected registrations
2. calculate refundable amounts
3. preview before processing
4. execute safely
5. record each refund/credit
6. notify families
7. produce a summary report

Never perform irreversible bulk financial actions without a confirmation/preview step.

---

# 22. Capacity and Waitlists

Programs may define:
- no capacity
- hard capacity
- capacity + waitlist

For non-season camps, clinics, outdoor events, training blocks, and other standalone products, waitlists should be configurable per event/product.

Recommended event/product fields:
- capacity
- spots filled
- pending reserved spots
- waitlist_enabled
- waitlist_capacity if TVVC wants a maximum waitlist size
- waitlist_policy such as first-come-first-served or manual admin selection
- waitlist_open_at and waitlist_close_at if different from registration dates

When full:
- prevent normal confirmation
- if waitlist is disabled, show the offering as full and block selection
- if waitlist is enabled, offer a clear "Join waitlist" path
- preserve queue/order information if TVVC chooses first-come-first-served behavior

Admin can:
- turn waitlist on or off per event/product
- view waitlist
- see waitlist counts from event lists and dashboards
- promote athlete
- send a waitlist invitation with an expiration deadline
- skip/remove an entry with a required reason
- override capacity with permission
- close waitlist

Family can:
- join the waitlist without being charged unless payment is explicitly required
- see a confirmation that they are waitlisted, not registered
- receive an invitation when a spot becomes available
- complete normal Stripe Checkout before the spot is confirmed

Promotion should not silently charge a saved payment method unless family consent and payment rules explicitly allow it.

Recommended waitlist entities:
- waitlist entry linked to event/product, athlete, household/guardian, source request, and queue timestamp
- waitlist invitation linked to entry, expiration, status, and admin actor
- waitlist audit events for join, remove, promote, expire, decline, and checkout completion

Recommended waitlist states:
- WAITLISTED
- INVITED
- INVITATION_EXPIRED
- REGISTERED
- DECLINED
- REMOVED

If a family joins multiple waitlists in one session, each athlete/event waitlist position should remain independently trackable.

---

# 23. Transactional Communication

This system should support **operational** communication tied to system state.

Examples:
- registration confirmation
- incomplete registration
- tryout reminder
- offer sent
- offer deadline reminder
- offer accepted
- payment due
- payment failed
- payment receipt
- missing waiver
- roster/team assignment
- refund processed

## Targeted admin messaging

Useful dynamic audiences:
- everyone in a program
- all tryout registrants
- checked-in athletes
- pending offers
- accepted offers
- unpaid/past due
- missing documents
- specific team
- waitlisted families

Audience membership should be generated from current data, not copied into static mailing lists.

## Templates

Support:
- subject
- body
- variables
- preview
- test message
- versioning where appropriate

Example variables:
- guardian first name
- athlete preferred name
- program
- team
- balance
- due date
- offer deadline

Log each sent message.

---

# 24. Admin Dashboard

The dashboard should answer:

**What needs my attention today?**

Recommended sections:

## Registration
- registrations by program
- new registrations
- capacity warnings
- waitlist counts

## Tryouts
- registered
- checked in
- no-show
- decisions pending

## Offers
- draft
- sent
- viewed
- pending
- accepted
- declined
- expiring soon

## Rosters
- roster size by team
- open spots
- incomplete players

## Financial
- expected season revenue
- collected
- outstanding
- past due
- upcoming installments
- failed payments
- credits
- refunds
- aid awarded

## Compliance/tasks
- missing waivers
- incomplete registrations
- unresolved duplicates
- admin overrides

Every summary card should lead to the filtered underlying records.

Avoid dashboard numbers that cannot be reconciled to actual records.

---

# 25. Athlete 360° Profile

One athlete page should provide the useful history.

Sections:
- identity/profile
- household/guardians
- current season status
- registrations
- tryout participation
- evaluation notes if permitted
- offers
- team memberships
- payments/balance summary
- waivers/documents
- previous seasons
- admin notes
- audit history

Avoid duplicating the same field in multiple sections.

---

# 26. Household 360° Profile

One household page should show:
- guardians
- athletes
- current registrations
- balances
- payment plans
- credits
- receipts
- financial aid status for authorized roles
- recent communications
- account flags/notes

This is especially useful when siblings participate.

---

# 27. Search, Filters, and Bulk Actions

Global/admin search should find:
- athlete
- guardian
- email
- team
- program

Common filters:
- season
- program
- age group
- team
- registration status
- offer status
- roster status
- payment status
- waiver status
- tryout status

High-value bulk actions:
- send message
- send/remind offers
- assign team
- mark/check in
- export
- apply configured status action
- batch cancel/refund with safeguards

Bulk actions must respect permissions.

---

# 28. Reports and Exports

Provide human-readable dashboards plus clean exports.

## Core exports

### Registration export
Selectable columns.

### Team roster
Possible fields:
- legal name
- preferred name
- DOB
- grad year
- position
- guardian contact as permitted
- jersey information if collected

### Financial export
- charges
- payments
- discounts
- aid
- credits
- refunds
- outstanding balance

### Tryout export
- registered
- attendance
- decision
- team offer outcome

### Compliance export
- missing waivers/forms

## Export profiles

Allow reusable export configurations.

Example:
`CEVA Roster Export`

Do not build direct third-party API integration until the manual export process is clearly insufficient and the external API is stable/available.

---

# 29. Audit Log

Critical changes should create immutable or append-only audit events.

Track:
- registration status change
- eligibility override
- athlete merge
- team assignment
- offer created/sent/withdrawn
- offer accepted/declined
- payment adjustment
- financial aid decision
- credit
- refund
- waiver signature
- user/role changes
- bulk action

Audit event fields:
- actor
- event type
- entity
- before/after or meaningful change payload
- timestamp
- source: UI / API / SYSTEM / WEBHOOK
- optional reason

Admin UI should make audit history readable.

---

# 30. Internal Notes and Flags

Admin notes should be separate from family-visible notes.

Features:
- note author
- timestamp
- visibility
- optional category
- pinned flag

Suggested categories:
- registration
- roster
- payment
- administrative
- follow-up

Avoid collecting sensitive information that TVVC does not actually need.

---

# 31. Notifications and Task Center

A lightweight task/attention center can reduce missed work.

Generate actionable items such as:
- 3 offers expire soon
- 4 registrations missing waivers
- 2 failed installments
- 1 financial aid application pending
- 5 tryout candidates have no decision
- team roster exceeds configured capacity

Tasks can be derived dynamically instead of stored when appropriate.

---

# 32. Configuration / Admin Settings

Avoid hard-coded TVVC values where reasonable.

Configurable:
- seasons
- programs
- fees
- deposit
- payment schedules
- registration dates
- capacities
- eligibility rules
- waiver sets
- email templates
- financial aid budget
- donation campaigns
- discount rules
- team sizes
- offer expiration behavior
- notification cadence

Use sensible defaults so configuration does not become its own administrative burden.

---

# 33. Privacy and Security

This application handles information about minors.

Treat security as a P0 concern.

Requirements:
- enforce authorization server-side
- role-based access
- household users can only access their household
- no sensitive data exposure through predictable IDs
- protect admin routes
- validate all write operations
- rate-limit authentication-sensitive endpoints as appropriate
- secure session handling
- do not log secrets/payment data
- do not store raw payment cards
- principle of least privilege
- environment secrets outside source control
- safe file upload rules if uploads exist
- database backups
- tested restore strategy
- audit sensitive administrative actions

If using row-level security, confirm it is actually enforced and tested.

Do not rely on hidden UI elements as authorization.

---

# 34. Data Integrity Rules

At minimum, enforce or validate:

- one canonical athlete record
- registration belongs to correct athlete/program/season
- active team membership belongs to same season
- accepted offer cannot reference deleted/inactive team
- payment totals reconcile to obligations
- refunds cannot exceed refundable amount without explicit authorized override
- credits cannot be applied twice
- waiver signature references exact waiver version
- household cannot access unrelated athlete
- duplicate webhook events do not duplicate financial transactions
- bulk actions are transactional or recoverable

Use database constraints where appropriate rather than relying entirely on UI code.

---

# 35. Accessibility and UX

Minimum expectations:
- responsive UI
- keyboard-accessible admin interactions
- semantic labels
- sufficient contrast
- obvious form validation
- focus errors after failed submit
- clear loading states
- no ambiguous icon-only destructive actions
- confirmation for destructive/bulk actions
- phone-friendly registration
- saved progress for long registration when practical

Family UI should use plain language.

Prefer:
`Payment due September 15 — $175`

over:
`Installment transaction pending`

---

# 36. Performance

The system is not expected to operate at national-platform scale, but it should feel immediate.

Targets/recommendations:
- avoid N+1 database queries
- paginate/filter large admin lists
- index frequent search/status columns
- avoid loading all historical seasons by default
- cache only where it simplifies rather than complicates correctness
- background jobs for email/bulk actions if existing architecture supports reliable queues

Correctness is more important than premature optimization.

---

# 37. Reliability for Payments and Email

External integrations fail.

The system should expect:
- payment webhook retry
- duplicate webhook
- email provider temporary failure
- partial bulk action failure
- browser closing after payment but before redirect
- network interruption during registration

Design for safe retry and reconciliation.

Important financial state must come from verified provider events, not solely from a successful browser redirect.

---

# 38. Recommended Screens

## Family
1. Sign in/create account
2. Household dashboard
3. Guardian profile
4. Athlete profile
5. Available programs
6. Registration wizard
7. Registration confirmation
8. Offer page
9. Payment/payment-plan page
10. Documents/waivers
11. Receipts/financial history

## Admin
1. Dashboard
2. Seasons
3. Programs
4. Registration configuration
5. Registrations
6. Households
7. Athletes
8. Tryout check-in
9. Tryout evaluation/decision board
10. Offers
11. Teams
12. Roster board
13. Payments
14. Failed/past-due payments
15. Financial aid
16. Discounts/credits/refunds
17. Donations
18. Forms/waivers
19. Communications/templates
20. Reports/exports
21. Users/roles
22. Audit log
23. Settings

Do not create a screen simply because it appears on this list if existing navigation combines functions more cleanly.

---

# 39. Recommended Decision Board

A high-value TVVC-specific admin view would combine tryout and roster decisions.

Columns or filtered states might include:

**Registered → Attended → Decision Needed → Offered → Accepted → Rostered**

Alternate destinations:
- Waitlist
- Not Offered
- Declined
- Withdrawn

Each athlete card could show:
- preferred name
- age group
- grad year
- position
- evaluator flag
- current recommendation
- existing offer status

Use drag/drop only if it remains accessible and every move has a clear domain action.

---

# 40. Recommended Season Readiness View

Before season launch, admin should be able to answer:

For each team:
- roster target
- accepted players
- active players
- missing agreements
- unpaid deposit
- payment plan selected
- missing contact information
- incomplete requirements

Suggested status:

`10/11 rostered — 1 offer pending — 2 missing waivers — 1 deposit due`

This is more useful than merely displaying a roster list.

---

# 41. Source-Inspired Features Worth Preserving

Current commercial systems reinforce several patterns that are valuable for TVVC.

## From Sprocket Sports
Useful concepts include:
- configurable registration
- payment plans and custom plans
- financial aid tracking
- capacity limits/waitlists
- credits/refunds
- point-of-sale donations
- roster exports
- registration/financial dashboards
- tryout and team rostering workflows
- configurable player measures/evaluations
- invoicing for add-ons
- alerts for pending tasks

## From OTTO SPORT
Useful concepts include:
- household-oriented registration
- customizable forms
- flexible payment plans
- registration data automatically feeding team operations
- roster synchronization
- targeted messaging based on live data
- automatic payment reminders
- custom dashboards
- registration reports
- financial analytics
- role-based permissions and explicit protection of member/minor data

These should be treated as product inspiration, not requirements to clone either service.

---

# 42. TVVC Recommended Priorities

## P0 — Protect data and money

Codex should prioritize immediately if missing:
- authorization audit
- payment webhook idempotency
- transaction reconciliation
- database constraints
- backup/restore confidence
- audit trail for financial/admin changes
- separation of household access
- duplicate financial-action prevention

## P1 — Complete the season and non-season registration pipelines

Highest-value product capabilities:
1. household + persistent athlete profiles
2. season/program configuration
3. reusable registration
4. configurable eligibility
5. versioned waivers
6. tryout registration/check-in
7. explicit candidate status
8. team offers
9. acceptance/decline
10. payment/deposit/payment plans
11. roster activation
12. clear family dashboard
13. clear admin dashboard
14. fully integrated non-season registration for camps, clinics, outdoor events, training blocks, and standalone products
15. per-event waitlist enablement for non-season offerings that may sell out

## P2 — Reduce TVVC administrative work

Add or strengthen:
- financial aid workflow
- donations
- discounts
- credits/refunds
- failed-payment handling
- targeted email
- batch operations
- waitlists/capacity
- waitlist promotion/invitation workflow
- custom exports
- athlete/household history
- readiness dashboard
- task/attention center

## P3 — Valuable after core system is excellent

Consider:
- coach/evaluator mobile UX
- more sophisticated player evaluation
- merchandise/add-on invoicing
- saved dashboard views
- configurable report builder
- direct external-system integrations
- optional athlete logins
- automated invitation to TVVC's team communication platform after roster activation

---

# 43. Features to Defer Unless Already Implemented Well

Do not expand scope toward these during the current registration project:

- full social/chat platform
- public social feed
- full tournament management
- scorekeeping
- standings
- bracket engine
- referee management
- complex court scheduling
- website CMS replacement
- marketing automation suite
- college recruiting platform
- player-development analytics platform
- native mobile apps merely for parity with commercial vendors
- generative-AI features without a clear administrative use case

A focused TVVC system should beat a giant platform at TVVC's actual workflow, not at feature count.

---

# 44. Suggested Integration with Team Communication

Once a player is fully rostered, the system may:
- mark the athlete `READY_FOR_TEAM_COMMS`
- expose/export guardian/player contact information needed for onboarding
- provide the correct team communication invitation/link
- record `TEAM_COMMS_INVITE_SENT_AT`

Do not rebuild ongoing team chat unless there is a demonstrated need.

---

# 45. Acceptance Scenarios

Codex should use these as end-to-end tests.

## Scenario A — Returning athlete

1. Parent signs in.
2. Existing household and athlete appear.
3. Parent selects new season.
4. Athlete data is prefilled.
5. Eligible program is shown.
6. Parent updates changed information only.
7. Required current waiver is signed.
8. Registration is submitted.
9. No duplicate athlete record is created.

**Pass condition:** new season registration references the same athlete.

---

## Scenario B — Two siblings

1. One guardian signs in.
2. Household shows two athletes.
3. Guardian registers each for different programs.
4. Shared guardian information is not re-entered.
5. Each athlete has independent registration and payment status.
6. Household dashboard shows combined obligations clearly.

---

## Scenario C — Ineligible athlete

1. Family selects athlete.
2. System evaluates program rules.
3. Ineligible program is hidden or disabled with explanation.
4. Admin may override.
5. Override requires reason.
6. Audit log records actor/reason.

---

## Scenario D — Tryout to offer

1. Athlete registers for tryouts.
2. Athlete appears automatically on check-in screen.
3. Evaluator adds note/recommendation.
4. Director assigns athlete to proposed team.
5. Offer is sent.
6. Family views and accepts.
7. Financial obligation is created.
8. Pending roster membership appears.

No manual re-entry between steps.

---

## Scenario E — Deposit activates player

1. Athlete accepts offer.
2. Required waiver is complete.
3. Deposit is paid.
4. Provider webhook confirms payment.
5. Local payment record is created once.
6. Registration/roster rules are evaluated.
7. Player becomes active on roster.
8. Parent sees receipt and roster status.

Refreshing browser or duplicate webhook must not duplicate payment.

---

## Scenario F — Installment fails

1. Scheduled installment attempts.
2. Provider reports failure.
3. Installment becomes FAILED.
4. Obligation reflects balance.
5. Family receives one failure notification.
6. Admin dashboard shows actionable alert.
7. Retry/payment update can resolve it.

---

## Scenario G — Financial aid

1. Family submits aid application.
2. Only authorized admin can view it.
3. Admin approves $X.
4. Financial obligation adjusts through explicit award entry.
5. Family sees new balance.
6. Coach does not see aid information.
7. Aid budget report updates.

---

## Scenario H — Cancelled clinic/event

1. Admin selects program.
2. Chooses batch cancellation.
3. System previews registrations and refundable amount.
4. Admin confirms.
5. Refund/credit records are processed safely.
6. Registrations become cancelled.
7. Families receive notification.
8. Summary report reconciles totals.

---

## Scenario I — Wrong team offer

1. Admin sends offer to wrong team.
2. Before acceptance, authorized admin withdraws it.
3. Family no longer has an actionable acceptance.
4. Withdrawal is audited.
5. Correct offer can be sent.
6. No duplicate financial obligation is created.

---

## Scenario J — Household isolation

1. Guardian A signs in.
2. Attempts direct URL/API access to Guardian B's athlete.
3. Server rejects request.
4. No private data is returned.

This must be tested at API/server level.

---

## Scenario K — Non-season event waitlist

1. Admin creates or edits a camp/clinic/event with capacity enabled.
2. Admin turns waitlist on for that offering.
3. Family selects the full offering.
4. System explains that the offering is full and offers a waitlist action rather than normal checkout.
5. Family joins the waitlist for the correct athlete.
6. Admin sees the waitlist entry with queue time, athlete, guardian, and contact information.
7. Admin invites the waitlisted athlete after a spot opens.
8. Family completes normal checkout before the invitation expires.
9. Registration becomes paid/confirmed and the waitlist entry is marked registered.
10. Capacity counts reconcile correctly.

**Pass condition:** joining the waitlist does not create a paid registration or overfill the event; promotion requires a deliberate family checkout or explicitly authorized no-charge admin action.

---

# 46. Testing Requirements

At minimum:

## Unit tests
- eligibility calculation
- pricing/discount calculation
- payment balance calculation
- roster activation rules
- status transition validation
- financial aid adjustment
- refund limits
- non-season capacity calculation
- waitlist state transitions

## Integration tests
- registration creation
- non-season event/product registration creation
- non-season waitlist join and promotion
- offer acceptance
- payment webhook
- duplicate webhook
- household authorization
- admin authorization
- waiver signature/version
- team assignment

## End-to-end tests
At least the critical scenarios above:
- returning family registration
- non-season event registration
- non-season waitlist promotion to paid registration
- tryout → offer → acceptance → payment → roster
- failed payment
- refund/cancellation

Never use production payment credentials in tests.

---

# 47. Migration Rules for Existing TVVC Data

If schema changes are recommended:

1. Inventory existing rows.
2. Identify duplicates/orphans.
3. Create reversible migrations.
4. Backfill new fields.
5. Validate record counts.
6. Validate financial totals before/after.
7. Preserve historical registrations.
8. Preserve provider transaction IDs.
9. Do not delete legacy fields until new behavior has run successfully.
10. Create a rollback plan for high-risk migrations.

For athlete deduplication:
- generate candidate matches
- require admin review for uncertain matches
- preserve foreign-key history when merging

---

# 48. Technical Recommendation Philosophy

Codex should work with the architecture already present.

Do not introduce:
- a new framework
- a second ORM
- a second auth system
- a second payment provider
- an event bus
- microservices
- GraphQL
- Redux/global state libraries
- a queueing system

unless there is a concrete problem that the existing stack cannot solve cleanly.

Prefer:
- simple relational data
- explicit transactions
- typed validation
- server-side authorization
- reusable domain services
- predictable state transitions
- idempotent external integrations
- focused UI components

---

# 49. Domain Services Worth Centralizing

If logic is currently scattered, consider central services/modules for:

### EligibilityService
Determines available programs.

### RegistrationService
Creates/submits/cancels registrations.

### OfferService
Creates/sends/accepts/declines/withdraws offers.

### RosterService
Manages team membership and activation.

### BillingService
Calculates obligation/balance and applies adjustments.

### PaymentReconciliationService
Processes provider events idempotently.

### WaiverService
Determines required/current waivers.

### NotificationService
Sends/logs transactional communication.

These are responsibilities, not mandatory class names.

Avoid giant all-purpose "ClubService" modules.

---

# 50. Suggested Event/Transition Model

The application does not need an event-sourcing architecture.

However, after important actions, use explicit domain events or transactional hooks if that matches the current stack.

Examples:
- RegistrationSubmitted
- TryoutCheckedIn
- OfferSent
- OfferAccepted
- PaymentSucceeded
- PaymentFailed
- RosterActivated
- WaiverSigned
- RefundCompleted

Use these to trigger:
- notifications
- audit logs
- derived status updates

Do not let UI components directly coordinate five unrelated database changes.

---

# 51. Error Handling

Family-facing errors:
- explain what happened
- preserve entered data
- provide next action
- never expose stack traces/provider internals

Admin-facing errors:
- identify affected athlete/registration
- give actionable remediation
- retain correlation/event IDs for debugging where useful

Financial errors:
- never claim money was collected until confirmed
- show `processing` if status is genuinely unresolved
- support reconciliation

---

# 52. Observability

For production:
- structured server logs
- error tracking
- payment webhook logs without sensitive payment data
- email delivery/failure logs
- audit events
- health check if appropriate

Critical operations should be traceable by:
- user/entity
- transaction ID
- provider event ID
- timestamp

---

# 53. Codex Required Final Review Output

After auditing the repo, return a report with these exact sections:

## 1. Existing System Summary
What TVVC already has.

## 2. What Is Already Strong
Do not rebuild these.

## 3. Critical Risks
Security, data integrity, payment, authorization, migration issues.

## 4. Missing Core Capabilities
Only functions that materially improve the registration/roster pipeline.

## 5. Partial Capabilities
What exists but needs completion.

## 6. Recommended Architecture Changes
Only justified changes.

## 7. Database Changes
Tables/columns/indexes/constraints/migrations.

## 8. UI/UX Changes
Pages/components/workflows.

## 9. Automation/Notification Changes
Background jobs, provider events, reminders.

## 10. Testing Gaps

## 11. Prioritized Implementation Backlog
For every item include:
- priority
- value
- complexity: S/M/L
- risk
- dependencies
- files/modules likely affected

## 12. Proposed Implementation Sequence
Small, testable increments.

## 13. Explicitly Deferred Features
Prevent scope creep.

## 14. Questions / Assumptions
Only questions that genuinely block implementation.

---

# 54. Recommended Implementation Sequence

The final sequence must respond to what actually exists, but use this default ordering:

### Step 1 — Audit and stabilize
- auth/authorization
- database integrity
- payment integration
- backups
- existing tests

### Step 2 — Canonical identity
- household
- guardians
- athletes
- deduplication

### Step 3 — Registration foundation
- seasons
- programs
- eligibility
- dynamic questions
- waivers

### Step 4 — Tryout pipeline
- registration
- check-in
- evaluations
- decision status

### Step 5 — Offers and rostering
- offers
- acceptance
- team membership
- readiness status

### Step 6 — Financial completeness
- obligations
- deposits
- payment plans
- reminders
- reconciliation

### Step 7 — Administrative finance
- aid
- donations
- discounts
- credits
- refunds

### Step 8 — Admin efficiency
- dashboard
- filters
- bulk actions
- exports
- task center

### Step 9 — Polish
- mobile UX
- accessibility
- performance
- observability

Do not execute later steps simply because they appear here if the current product already handles them successfully.

---

# 55. Definition of Success

The system is successful when:

### A family can:
- create one account
- manage multiple athletes
- see only programs relevant to them
- register without redundant data entry
- understand what remains incomplete
- receive a team offer
- accept it
- pay or choose an approved payment plan
- see a receipt and balance
- know when their athlete is officially rostered

### TVVC can:
- see every athlete in one reliable system
- know exactly where each player is in the season pipeline
- run tryout check-in without a duplicate roster
- send correct team offers
- identify pending responses
- see roster capacity
- see who has not completed forms
- track collected/outstanding money
- manage aid, credits, and refunds
- target communications from live data
- export accurate rosters
- understand who changed important records and when

### Technically:
- duplicate actions are safe
- authorization is enforced on the server
- payments reconcile
- historical seasons remain intact
- critical state changes are auditable
- tests protect the highest-risk workflows

---

# 56. Product North Star

Do not measure success by how many Sprocket Sports or OTTO SPORT features TVVC can reproduce.

Measure success by this:

> **Can one small volleyball club move a family from initial registration to an accurate, paid, compliant team roster with almost no duplicate data entry and very little administrative chasing?**

If the answer is yes, the product is doing its job.

---

# 57. Source Notes

This target specification was informed by a review of current Sprocket Sports and OTTO SPORT product materials on August 23, 2026.

Commercial-platform concepts used as inspiration include:

**Sprocket Sports**
- registration and payments
- payment plans
- financial aid
- capacity/waitlists
- refunds and credits
- donations
- exports
- dashboards
- tryouts/team rostering
- configurable player measurables
- invoicing
- alerts

**OTTO SPORT**
- customizable registration
- household/member model
- flexible payments
- automatic registration-to-roster data flow
- targeted communication
- payment reminders
- dashboards/reporting
- role-based permissions
- privacy controls

This document intentionally recommends a narrower product than either commercial suite.
