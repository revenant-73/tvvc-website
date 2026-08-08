export const CLUB_SEASON_AGREEMENT_WORKING_DRAFTS = {
  'season-commitment': {
    title: 'Club season participation commitment',
    summary: 'Attendance, communication, conduct, and the responsibilities that come with accepting a team spot',
    body: `By accepting this team spot, I confirm that my family has reviewed the offered team, the season schedule currently available, the club dues, and the selected payment option. I understand that the roster spot is not final until the required payment at registration is successfully completed.

Our family will make a good-faith effort to attend scheduled practices, tournaments, and team activities; arrive prepared and on time; and communicate promptly with the coach or TVVC when an absence or conflict cannot be avoided. We will keep our contact, emergency, and relevant medical information current.

The player and family agree to follow TVVC, facility, event, and governing-body conduct and safety requirements. We understand that team roles, positions, lineups, and playing time are coaching decisions and are not guaranteed by acceptance of a roster spot or payment of club dues.

If circumstances change, our family will contact TVVC directly rather than relying on a message to a coach or simply stopping attendance. Payment changes, withdrawals, and refund requests are handled under the separately presented automatic-payment authorization and refund and cancellation policy.

I confirm that I am the player's parent or legal guardian, or otherwise have authority to accept this commitment for the player and family.`,
  },
  'refund-cancellation-policy': {
    title: 'Refund and cancellation policy',
    summary: 'How cancellation requests, withdrawals, medical inability, credits, and approved refunds are handled',
    body: `Three-business-day cancellation period. A parent or legal guardian may cancel the season registration in writing before midnight of the third business day after accepting the spot. TVVC will refund all amounts paid. This right is not reduced by calling the initial payment a deposit.

If TVVC cannot provide the offered season. If TVVC cancels the team before its first practice, TVVC will refund all club dues paid. If TVVC ends the team after the season begins or materially reduces the promised season, TVVC will provide a reasonable prorated refund for the portion TVVC cannot provide.

Season-ending medical inability. If a player becomes physically unable to participate in a substantial portion of the remaining season, the parent may submit a written request for medical cancellation. TVVC may request confirmation from a licensed healthcare provider. Once approved, future automatic charges will stop and prepaid club dues will be refunded on a prorated basis for the full weeks remaining in the season.

Voluntary withdrawal before the first practice. After the three-business-day cancellation period but before the team's first practice, TVVC will cancel future installments and refund amounts paid above the deposit. The deposit is nonrefundable because the accepted spot causes TVVC to make roster and season commitments.

Voluntary withdrawal after the first practice. Once the team has begun practicing, TVVC will review voluntary withdrawals individually. There is no automatic refund and no automatic requirement that every remaining installment be collected. TVVC may consider the timing and reason for withdrawal, the player's participation to date, costs already committed or paid on the player's behalf, the effect on the team and roster, and other relevant circumstances. TVVC may approve no financial adjustment, cancel some or all future installments, issue a partial refund, or establish another written resolution. The decision and any revised balance will be provided in writing.

Reasons that do not guarantee a refund. Playing time, position, team assignment, coaching preference, ordinary practice or tournament schedule changes, missed activities, conflicts with another activity, voluntary transfer to another club, or suspension or dismissal for violation of TVVC policies do not automatically entitle a family to a refund. TVVC will review the complete circumstances under the case-by-case process above.

Credits and fundraising. Scholarships, fundraising proceeds, sponsorships, and other non-cash credits reduce the player's balance but do not create a cash refund unless TVVC agrees otherwise in writing or applicable law requires it.

How to request cancellation or a refund. Submit the request in writing to loren@tualatinvalleyvb.com with the player's name, team, requested effective date, and reason. Telling a coach, missing activities, replacing a card, or disputing a charge does not by itself cancel the registration or automatic-payment authorization. TVVC will acknowledge the request and normally provide a decision within 10 business days.

Approved refunds. Approved card refunds are returned to the original payment method. TVVC does not deduct an administrative fee from an approved refund. After TVVC issues the refund, the card issuer may take approximately 5–10 business days to display it. This policy does not limit any cancellation or refund rights required by applicable law.`,
  },
  'media-release': {
    title: 'Player media release',
    summary: 'Choose whether TVVC may use identifiable photos or video of the player',
    body: `Please choose “granted” or “declined” for this player. Declining does not affect roster eligibility, team assignment, playing time, or access to TVVC programs.

If granted, I authorize Tualatin Valley Volleyball Club to photograph or record the player during club practices, competitions, events, and activities and to use the player's image, video, voice, first name, team, and volleyball-related accomplishments in TVVC-controlled team communications, printed materials, website content, social media, fundraising, and club promotion without compensation.

TVVC will not intentionally sell the player's image as stock media or authorize unrelated third-party advertising. Event organizers, spectators, news media, and facilities may create recordings outside TVVC's control; this choice governs TVVC's own use.

Permission may be withdrawn for future TVVC use by sending a written request to loren@tualatinvalleyvb.com. TVVC will make reasonable efforts to stop new use after processing the request, but withdrawal may not remove material already printed, published, shared, archived, or incorporated into an existing production.`,
  },
} as const;

export type ClubSeasonWorkingDraftKey = keyof typeof CLUB_SEASON_AGREEMENT_WORKING_DRAFTS;
