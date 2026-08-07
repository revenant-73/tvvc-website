import { z } from 'zod';
import {
  buildStandardClubSeasonSchedule,
  type ClubSeasonCharge,
  type ClubSeasonPricingTerms,
} from './club-season-schedule.ts';

export const CLUB_SEASON_AUTOPAY_AUTHORIZATION =
  'I authorize Tualatin Valley Volleyball Club to charge the payment method provided today for the deposit and the scheduled installments shown above. I understand that Stripe will securely store the payment method and that TVVC will initiate the listed charges automatically on the specified dates. If a payment fails, TVVC may retry the charge and contact me to update the payment method; a failed payment does not automatically remove the player from the team or cancel this registration.';

export const clubSeasonCheckoutSchema = z.object({
  offerId: z.string().trim().min(1).max(100),
  paymentOption: z.enum(['pay_in_full', 'standard_plan']),
  termsFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  authorizedName: z.string().trim().max(120).optional(),
  autopayAuthorized: z.boolean().optional().default(false),
}).strict();

export type ClubSeasonPaymentOption = 'pay_in_full' | 'standard_plan';

export type ClubSeasonPaymentTerms = {
  paymentOption: ClubSeasonPaymentOption;
  totalAmount: number;
  dueNowAmount: number;
  currency: 'usd';
  billingDay: number | null;
  charges: Array<ClubSeasonCharge | (Omit<ClubSeasonCharge, 'type'> & { type: 'full_payment' })>;
};

type PaymentTermsInput = {
  paymentOption: ClubSeasonPaymentOption;
  registrationDate: string;
  firstInstallmentDate: string;
  billingDay: number;
  pricing: ClubSeasonPricingTerms;
};

function stableTermsValue(terms: ClubSeasonPaymentTerms): string {
  return JSON.stringify({
    paymentOption: terms.paymentOption,
    totalAmount: terms.totalAmount,
    dueNowAmount: terms.dueNowAmount,
    currency: terms.currency,
    billingDay: terms.billingDay,
    charges: terms.charges.map(({ sequence, type, dueDate, amount }) => ({
      sequence,
      type,
      dueDate,
      amount,
    })),
  });
}

export function buildClubSeasonPaymentTerms({
  paymentOption,
  registrationDate,
  firstInstallmentDate,
  billingDay,
  pricing,
}: PaymentTermsInput): ClubSeasonPaymentTerms {
  if (paymentOption === 'pay_in_full') {
    return {
      paymentOption,
      totalAmount: pricing.totalAmount,
      dueNowAmount: pricing.totalAmount,
      currency: 'usd',
      billingDay: null,
      charges: [{
        sequence: 0,
        type: 'full_payment',
        dueDate: registrationDate,
        amount: pricing.totalAmount,
      }],
    };
  }

  const schedule = buildStandardClubSeasonSchedule({
    registrationDate,
    firstInstallmentDate,
    billingDay,
    terms: pricing,
  });
  return {
    paymentOption,
    totalAmount: schedule.totalAmount,
    dueNowAmount: schedule.depositAmount,
    currency: 'usd',
    billingDay,
    charges: schedule.charges,
  };
}

export async function hashClubSeasonPaymentTerms(terms: ClubSeasonPaymentTerms): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(stableTermsValue(terms))
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashClubSeasonAuthorization(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
