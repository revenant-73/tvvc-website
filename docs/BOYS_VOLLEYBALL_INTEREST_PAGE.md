# Boys Volleyball Interest Page

## Purpose

`/boys-volleyball` is a public interest page for families who may want boys volleyball opportunities at TVVC for the 2026-2027 season. It is meant to measure demand, age groups, experience levels, availability, and communication preferences before any program decision is made.

## Separation From Registration And Payments

This page is intentionally separate from club-season registration, tryouts registration, offers, invitations, parent portal ownership, Stripe Checkout, payment plans, deposits, waivers, and roster placement workflows.

The form is an interest form only. A submission does not guarantee a boys team, roster spot, team placement, schedule, or pricing. Do not add medical data, emergency contacts, birthdates, waivers, or payment fields to this page.

## Netlify Forms Setup

The page uses a build-detected plain HTML Netlify Form:

- Form name: `boys-volleyball-interest`
- Method: `POST`
- Detection attributes: `data-netlify="true"` and `netlify-honeypot="bot-field"`
- Custom success route: `action="/boys-volleyball/thanks"`
- Hidden form field: `form-name=boys-volleyball-interest`
- Hidden subject field: `New TVVC Boys Volleyball Interest Form`
- Visible reply-to email field: `name="email"`

After deployment, configure notifications in Netlify:

1. Open the `tvvc-website` site in Netlify.
2. Go to Forms.
3. Confirm `boys-volleyball-interest` appears after the first deployed build with the form markup.
4. Add email notifications for the TVVC contact address that should receive interest submissions.
5. Submit one low-risk test entry from the live page and confirm the browser redirects to `/boys-volleyball/thanks`.
6. Confirm the notification includes the family email as the reply-to address.

## Submission Export

Submissions can be reviewed and exported from Netlify Forms:

1. Netlify site dashboard.
2. Forms.
3. `boys-volleyball-interest`.
4. Export CSV for offline review or program planning.

Keep exported submission files out of the repository unless the data has been anonymized.

## Future Escalation Path

If boys volleyball becomes a real registration program, do not mutate this interest form into a payment or roster workflow. Create a separate implementation plan that covers program approval, schedule, pricing, eligibility, waivers, capacity, admin review, payment behavior, family communication, and privacy boundaries.

Before touching any club-season registration, invitation, payment-plan, billing, or finance code, read `docs/CODEX_TVVC_PAYMENT_PROJECT_HANDOFF.md` and re-check the current production state.
