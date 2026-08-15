import assert from 'node:assert/strict';
import test from 'node:test';
import { CLUB_SEASON_AGREEMENT_WORKING_DRAFTS } from '../src/lib/club-season-agreement-content.ts';

test('season commitment states the complete dues, uniform, travel, and membership terms', () => {
  const commitment = CLUB_SEASON_AGREEMENT_WORKING_DRAFTS['season-commitment'].body;

  assert.match(commitment, /two jerseys, two practice T-shirts, one sweatshirt, and one bag tag/i);
  assert.match(commitment, /12U and 18U.*additional March tournament/i);
  assert.match(commitment, /CEVA\/USA Volleyball membership.*purchase separately/i);
  assert.match(commitment, /transportation, lodging, meals, admission, parking, spectator fees/i);
  assert.match(commitment, /approved on a team-by-team basis/i);
  assert.match(commitment, /absorbs standard Stripe card-processing fees/i);
  assert.match(commitment, /local and regional competition/i);
});

test('refund working draft includes the cancellation address and response deadlines', () => {
  const policy = CLUB_SEASON_AGREEMENT_WORKING_DRAFTS['refund-cancellation-policy'].body;

  assert.match(policy, /BUYER'S RIGHT TO CANCEL/);
  assert.match(policy, /27170 NW Dorland Rd, North Plains, OR 97133/);
  assert.match(policy, /loren@tualatinvalleyvb\.com/);
  assert.match(policy, /return all amounts paid within 15 days/i);
  assert.match(policy, /Voluntary withdrawal after the first practice/i);
  assert.match(policy, /review voluntary withdrawals individually/i);
});
