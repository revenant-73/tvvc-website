import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createPlanRevisionSchema = z.object({
  action: z.literal('propose'),
  paymentPlanId: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(3).max(240),
  adminNote: z.string().trim().max(1000).optional(),
  charges: z.array(z.object({
    dueDate: z.string().regex(datePattern),
    amount: z.number().int().positive().max(2_000_000),
  }).strict()).min(1).max(18),
}).strict();

export const cancelPlanRevisionSchema = z.object({
  action: z.literal('cancel'),
  revisionId: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(3).max(240),
}).strict();

export const parentPlanRevisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('authorize'),
    revisionId: z.string().trim().min(1).max(100),
    authorizedName: z.string().trim().min(2).max(120),
    autopayAuthorized: z.literal(true),
    termsFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  z.object({
    action: z.literal('decline'),
    revisionId: z.string().trim().min(1).max(100),
  }).strict(),
]);

export type RevisionCharge = { sequence: number; type: 'installment'; dueDate: string; amount: number };

export function normalizeRevisionCharges(
  charges: Array<{ dueDate: string; amount: number }>,
  today: string,
  remainingBalance: number
): RevisionCharge[] {
  if (!Number.isInteger(remainingBalance) || remainingBalance <= 0) {
    throw new Error('NO_REMAINING_BALANCE');
  }
  const normalized = charges.map((charge, index) => ({
    sequence: index + 1,
    type: 'installment' as const,
    dueDate: charge.dueDate,
    amount: charge.amount,
  }));
  const dateSet = new Set(normalized.map((charge) => charge.dueDate));
  if (dateSet.size !== normalized.length) throw new Error('DUPLICATE_DUE_DATE');
  if (normalized.some((charge) => charge.dueDate <= today)) throw new Error('DUE_DATE_NOT_FUTURE');
  for (let index = 1; index < normalized.length; index++) {
    if (normalized[index].dueDate <= normalized[index - 1].dueDate) throw new Error('DUE_DATES_NOT_ASCENDING');
  }
  const total = normalized.reduce((sum, charge) => sum + charge.amount, 0);
  if (total !== remainingBalance) throw new Error('REVISION_TOTAL_MISMATCH');
  return normalized;
}

export function revisionSnapshot(input: {
  seasonTotal: number;
  paidAmount: number;
  remainingBalance: number;
  supersedesVersion: number;
  charges: RevisionCharge[];
}) {
  return {
    kind: 'plan_revision',
    currency: 'usd',
    seasonTotal: input.seasonTotal,
    paidAmountAtProposal: input.paidAmount,
    remainingBalance: input.remainingBalance,
    supersedesVersion: input.supersedesVersion,
    charges: input.charges,
  };
}

export async function hashRevisionTerms(snapshot: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshot)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function revisionAuthorizationText(charges: RevisionCharge[], remainingBalance: number): string {
  const schedule = charges.map((charge) => `${charge.dueDate}: $${(charge.amount / 100).toFixed(2)}`).join('; ');
  return `I authorize Tualatin Valley Volleyball Club to charge my saved payment method for the revised remaining balance of $${(remainingBalance / 100).toFixed(2)} according to this schedule: ${schedule}. I understand that Stripe securely stores the payment method, that TVVC will initiate these charges automatically, and that a failed payment does not automatically remove the player from the team or cancel the registration.`;
}
