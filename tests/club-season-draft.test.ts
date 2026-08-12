import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clubSeasonDraftDataSchema,
  validateCompletedClubSeasonDraft,
} from '../src/lib/club-season-draft.ts';

const completeDraft = {
  schemaVersion: 1 as const,
  family: {
    addressLine1: '123 Volleyball Way',
    addressLine2: '',
    city: 'Hillsboro',
    state: 'OR',
    postalCode: '97123',
    emergencyContactName: 'Parent Alpha',
    emergencyContactRelationship: 'Parent',
    emergencyContactPhone: '503-555-0101',
    communicationPreference: 'both' as const,
    informationConfirmed: true,
  },
  player: {
    preferredName: 'Avery',
    jerseySize: 'AM' as const,
    apparelSize: 'AM' as const,
    jerseyNumberPreferences: [7, 12, 21],
    medicalInfo: 'None',
    medicalInformationConfirmed: true,
    cevaMembershipStatus: 'complete' as const,
    cevaMembershipNumber: 'CEVA-12345',
    medicalReleaseStatus: 'complete' as const,
    seasonConflicts: '',
  },
};

test('accepts a complete bounded club season draft', () => {
  const parsed = clubSeasonDraftDataSchema.parse(completeDraft);
  assert.deepEqual(validateCompletedClubSeasonDraft(parsed), []);
});

test('allows an incomplete draft to autosave but reports completion requirements', () => {
  const incomplete = structuredClone(completeDraft);
  incomplete.family.addressLine1 = '';
  incomplete.family.informationConfirmed = false;
  incomplete.player.jerseySize = '';
  incomplete.player.medicalInformationConfirmed = false;

  const parsed = clubSeasonDraftDataSchema.parse(incomplete);
  assert.deepEqual(validateCompletedClubSeasonDraft(parsed), [
    'Mailing address',
    'Family information confirmation',
    'Jersey size',
    'Medical information confirmation',
  ]);
});

test('rejects duplicate jersey numbers and unexpected fields', () => {
  const duplicateNumbers = structuredClone(completeDraft);
  duplicateNumbers.player.jerseyNumberPreferences = [7, 7];
  assert.equal(clubSeasonDraftDataSchema.safeParse(duplicateNumbers).success, false);

  const unexpected = { ...completeDraft, teamId: 'attacker-controlled-team' };
  assert.equal(clubSeasonDraftDataSchema.safeParse(unexpected).success, false);
});
