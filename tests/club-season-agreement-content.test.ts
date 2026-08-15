import assert from 'node:assert/strict';
import test from 'node:test';
import { CLUB_SEASON_AGREEMENT_WORKING_DRAFTS } from '../src/lib/club-season-agreement-content.ts';

test('refund working draft includes the cancellation address and response deadlines', () => {
  const policy = CLUB_SEASON_AGREEMENT_WORKING_DRAFTS['refund-cancellation-policy'].body;

  assert.match(policy, /BUYER'S RIGHT TO CANCEL/);
  assert.match(policy, /27170 NW Dorland Rd, North Plains, OR 97133/);
  assert.match(policy, /loren@tualatinvalleyvb\.com/);
  assert.match(policy, /return all amounts paid within 15 days/i);
  assert.match(policy, /Voluntary withdrawal after the first practice/i);
  assert.match(policy, /review voluntary withdrawals individually/i);
});
