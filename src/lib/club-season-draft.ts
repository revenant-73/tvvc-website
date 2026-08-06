import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum);
const sizeOptions = ['', 'YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL', 'A3XL'] as const;

export const clubSeasonDraftDataSchema = z.object({
  schemaVersion: z.literal(1),
  family: z.object({
    addressLine1: optionalText(120),
    addressLine2: optionalText(120),
    city: optionalText(80),
    state: optionalText(2),
    postalCode: optionalText(10),
    emergencyContactName: optionalText(100),
    emergencyContactRelationship: optionalText(60),
    emergencyContactPhone: optionalText(30),
    communicationPreference: z.enum(['', 'email', 'sms', 'both']),
    informationConfirmed: z.boolean(),
  }).strict(),
  player: z.object({
    preferredName: optionalText(80),
    jerseySize: z.enum(sizeOptions),
    apparelSize: z.enum(sizeOptions),
    jerseyNumberPreferences: z.array(z.number().int().min(0).max(99)).max(3)
      .refine((numbers) => new Set(numbers).size === numbers.length, {
        message: 'Jersey number preferences must be different.',
      }),
    medicalInfo: optionalText(2000),
    medicalInformationConfirmed: z.boolean(),
    cevaMembershipStatus: z.enum(['', 'not_started', 'in_progress', 'complete']),
    cevaMembershipNumber: optionalText(50),
    medicalReleaseStatus: z.enum(['', 'not_started', 'in_progress', 'complete']),
    seasonConflicts: optionalText(1500),
  }).strict(),
}).strict();

export type ClubSeasonDraftData = z.infer<typeof clubSeasonDraftDataSchema>;

export const saveClubSeasonDraftSchema = z.object({
  offerId: z.string().uuid(),
  version: z.number().int().positive(),
  currentStep: z.number().int().min(1).max(3),
  data: clubSeasonDraftDataSchema,
}).strict();

export const acceptClubSeasonAgreementsSchema = z.object({
  offerId: z.string().uuid(),
  version: z.number().int().positive(),
  acceptedName: z.string().trim().min(2).max(120),
  responses: z.array(z.object({
    agreementVersionId: z.string().trim().min(1),
    response: z.string().trim().min(1).max(80),
  }).strict()).min(1).max(20),
}).strict();

export function parseClubSeasonDraftData(value: string | null | undefined): ClubSeasonDraftData | null {
  if (!value) return null;

  try {
    const parsed = clubSeasonDraftDataSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function validateCompletedClubSeasonDraft(data: ClubSeasonDraftData): string[] {
  const missing: string[] = [];
  const { family, player } = data;

  if (!family.addressLine1) missing.push('Mailing address');
  if (!family.city) missing.push('City');
  if (!/^[A-Za-z]{2}$/.test(family.state)) missing.push('Two-letter state');
  if (!/^\d{5}(?:-\d{4})?$/.test(family.postalCode)) missing.push('Valid ZIP code');
  if (!family.emergencyContactName) missing.push('Emergency contact name');
  if (!family.emergencyContactRelationship) missing.push('Emergency contact relationship');
  if (!family.emergencyContactPhone) missing.push('Emergency contact phone');
  if (!family.communicationPreference) missing.push('Communication preference');
  if (!family.informationConfirmed) missing.push('Family information confirmation');
  if (!player.jerseySize) missing.push('Jersey size');
  if (!player.apparelSize) missing.push('Apparel size');
  if (!player.medicalInformationConfirmed) missing.push('Medical information confirmation');
  if (!player.cevaMembershipStatus) missing.push('CEVA membership status');
  if (player.cevaMembershipStatus === 'complete' && !player.cevaMembershipNumber) {
    missing.push('CEVA membership number');
  }
  if (!player.medicalReleaseStatus) missing.push('Medical-release status');
  return missing;
}
