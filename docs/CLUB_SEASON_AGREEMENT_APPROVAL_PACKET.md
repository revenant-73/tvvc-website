# TVVC Club-Season Agreement Approval Packet

**Season:** 2026–2027 club season

**Prepared:** August 15, 2026

**Status:** Approved and published to production

**Runtime source:** `src/lib/club-season-agreement-content.ts`

**Initial content review:** Loren Anderson reviewed the season commitment, refund/cancellation policy, and media release on August 15, 2026. Formal authorization to publish was confirmed separately afterward.

**Production publication:** On August 15, 2026, production V1 versions of the season commitment, refund/cancellation policy, and media release were published with the immutable approval reference `TVVC approval confirmed by Loren Anderson — 2026-08-15`. The production readiness gate confirmed all three versions. The season database registration switch and Netlify feature flag remained off.

## Purpose

This packet is the final business, board, and legal review checkpoint before TVVC publishes parent-facing club-season agreements. Publishing is deliberately separate from enabling registration. A published version is immutable and must not be published until its wording and approval reference are final.

## Agreement set

### 1. Club season participation commitment

The working draft covers:

- acceptance of the offered team, current schedule, dues, and selected payment option;
- the requirement that payment at registration succeed before the roster spot is final;
- good-faith attendance, punctuality, preparation, and prompt absence communication;
- current contact, emergency, and relevant medical information;
- TVVC, facility, event, governing-body, conduct, and safety requirements;
- coaching discretion over roles, positions, lineups, and playing time;
- direct communication with TVVC for withdrawals, payment changes, and refunds; and
- confirmation that the signer has authority to accept for the player and family.

**Assessment:** Clear and reasonable. The confirmed dues, uniform, CEVA, processing-fee, tournament, and travel disclosures are now included in the working draft.

### 2. Refund and cancellation policy

The working draft covers:

- a conspicuous three-business-day cancellation right;
- the full mailing address and cancellation email;
- return of all amounts paid after a timely cancellation;
- TVVC cancellation or material reduction of the offered season;
- death or season-ending medical inability;
- closure, relocation, unfinished facilities, or material service changes;
- a defined weekly proration method;
- deposit treatment for voluntary withdrawal before the first practice;
- individual review, rather than a blanket outcome, for voluntary withdrawal after the first practice;
- circumstances that do not automatically guarantee a refund;
- treatment of scholarships, fundraising, sponsorships, and non-cash credits;
- the written request process and normal response target; and
- approved card-refund timing and destination.

The current cancellation address is:

> Tualatin Valley Volleyball Club<br>
> 27170 NW Dorland Rd<br>
> North Plains, OR 97133

The current cancellation email is `loren@tualatinvalleyvb.com`.

**Legal-review note:** Current ORS 646A.030–646A.042 defines a health spa broadly enough to include businesses whose primary purpose is selling physical-exercise instruction or training. ORS 646A.034 contains written-contract, service-description, rules, duration, cancellation, proration, and conspicuous three-business-day notice requirements. The Oregon Department of Justice summarizes similar protections for fitness services. Counsel should confirm whether TVVC falls within that statutory definition and whether the draft satisfies every applicable contract-delivery and formatting requirement. This packet does not make that legal determination.

**Assessment:** The policy is intentionally family-reasonable and preserves the agreed case-by-case treatment after the first practice. Board approval and Oregon legal review remain required before publication.

### 3. Player media release

The working draft:

- requires an explicit `granted` or `declined` choice;
- states that declining does not affect eligibility, team assignment, playing time, or access;
- defines the TVVC-controlled uses covered by permission;
- excludes stock-media sales and unrelated third-party advertising;
- explains that TVVC cannot control recordings by event organizers, spectators, media, or facilities; and
- allows permission to be withdrawn for future TVVC use by written request.

The administrator offer workspace provides a direct filter for registrations whose media-release response is declined.

**Assessment:** Ready for organizational review. It should remain an optional choice, not a condition of team participation.

## Confirmed business disclosures

These terms were confirmed by TVVC on August 15, 2026, and are included in the parent-facing season commitment.

### Club dues include

The $1,200 12U dues and $1,500 13U–18U dues include:

- coaching;
- scheduled practice-facility costs;
- club administration;
- team or shared equipment;
- all tournaments on the published team schedule;
- the additional March tournament that will be added for 12U and 18U;
- two jerseys;
- two practice T-shirts;
- one sweatshirt;
- one bag tag; and
- standard Stripe card-processing fees, which TVVC absorbs rather than passing to families.

### Club dues exclude

The following remain the family’s responsibility:

- required CEVA/USA Volleyball membership and registration fees;
- player and family transportation;
- lodging and meals;
- optional apparel;
- replacement uniform pieces;
- admission, parking, or spectator fees;
- optional or team-selected events beyond the published schedule; and
- costs associated with an additional competition beyond the published schedule and the included 12U/18U March tournament, if approved team by team after TVVC communicates the competition and added cost.

### Travel expectations

Confirmed parent-facing wording:

> TVVC focuses on local and regional competition and works to limit unnecessary travel and overnight stays. Tournament locations and schedules are controlled by event organizers and may change. Families are responsible for player transportation and any family travel costs unless TVVC states otherwise in writing.

### CEVA/USA Volleyball responsibility

Confirmed parent-facing wording:

> Club dues do not include the player’s required CEVA/USA Volleyball membership. The family is responsible for purchasing and maintaining the correct membership and completing required governing-body forms by the deadline communicated by TVVC.

### Uniform disclosure

The included uniform package is two jerseys, two practice T-shirts, one sweatshirt, and one bag tag. Optional apparel and replacement uniform pieces are purchased separately by families.

## Approval record

Before publishing, record:

- approving body or authorized person;
- approval date;
- meeting minutes, resolution, counsel memo, or other approval reference;
- agreement keys and exact version numbers approved;
- confirmation that the runtime wording matches the reviewed wording;
- confirmation of the address and email shown above;
- confirmation of dues inclusions and exclusions;
- confirmation of travel, uniform, and CEVA disclosures; and
- any required follow-up date for annual review.

Suggested approval-reference format:

`TVVC Board approval — YYYY-MM-DD — minutes/resolution/reference`

## Publishing procedure

1. Resolve every business disclosure in this packet.
2. Obtain board and appropriate Oregon legal review of the refund/cancellation policy.
3. Make any approved wording changes in the agreement working drafts.
4. Run unit tests and a production build.
5. Deploy the reviewed drafts while registration remains disabled.
6. Open `/admin/club-season` and compare each draft with the approved copy.
7. Enter the approval reference.
8. Publish the season commitment, refund/cancellation policy, and media-release choice one at a time.
9. Confirm the published version number and content hash after each publication.
10. Perform an offered-parent rehearsal and verify that the complete wording and response control are visible before payment.

Publishing does not enable registration, switch Stripe to live mode, or send an offer. Those remain separate launch actions.
