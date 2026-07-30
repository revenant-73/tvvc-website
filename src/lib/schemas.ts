import { z } from 'zod';

export const parentInfoSchema = z.object({
  name: z.string().min(1, 'Parent name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  emergencyPhone: z.string().min(1, 'Emergency phone is required'),
  secondaryParentName: z.string().optional().nullable(),
  secondaryParentEmail: z.string().email('Invalid secondary email').optional().nullable().or(z.literal('')),
  secondaryParentPhone: z.string().optional().nullable(),
});

export const athleteSchema = z.object({
  profileId: z.coerce.number().int().positive().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  preferredName: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  grade: z.string().min(1, 'Grade is required'),
  school: z.string().optional().nullable(),
  gradYear: z.string().optional().nullable(),
  division: z.string().optional().nullable(),
  tshirtSize: z.string().optional().nullable(),
  jerseySize: z.string().optional().nullable(),
  experience: z.string().optional().nullable(),
  positions: z.string().optional().nullable(),
  medicalInfo: z.string().min(1, 'Medical info is required'),
  photoReleaseAgreed: z.boolean().default(false),
  waiverAgreed: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the liability waiver' }),
  }),
  selectedEvents: z.array(z.string()).min(1, 'Select at least one event'),
  metadata: z.record(z.any()).optional().nullable(),
});

export const registrationSchema = z.object({
  parentInfo: parentInfoSchema,
  athletes: z.array(athleteSchema).min(1, 'At least one athlete is required'),
  metadata: z.record(z.any()).optional().nullable(),
});

const portalText = (field: string, max: number) =>
  z.string().trim().min(1, `${field} is required`).max(max, `${field} is too long`);

export const portalAthleteSchema = z.object({
  firstName: portalText('First name', 80),
  lastName: portalText('Last name', 80),
  grade: portalText('Grade', 20),
  tshirtSize: z.string().trim().max(30, 'T-shirt size is too long').optional().default(''),
  medicalInfo: z.string().trim().max(2000, 'Medical information is too long').optional().default(''),
});

export const portalAthleteUpdateSchema = portalAthleteSchema.extend({
  id: z.coerce.number().int().positive('Invalid athlete ID'),
});

const profileId = z.coerce.number().int().positive('Invalid player profile ID');

export const portalPlayerLifecycleSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('archive'),
    profileId,
  }),
  z.object({
    action: z.literal('restore'),
    profileId,
  }),
  z.object({
    action: z.literal('merge'),
    sourceProfileId: profileId,
    targetProfileId: profileId,
  }),
]);

export const portalProfileSchema = z.object({
  name: z.string().trim().max(120, 'Display name is too long'),
  emergencyPhone: z.string().trim().max(40, 'Phone number is too long').optional().default(''),
});

export type ParentInfo = z.infer<typeof parentInfoSchema>;
export type Athlete = z.infer<typeof athleteSchema>;
export type Registration = z.infer<typeof registrationSchema>;
