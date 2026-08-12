export type ClubSeasonPricingTerms = {
  totalAmount: number;
  depositAmount: number;
  installmentAmount: number;
  installmentCount: number;
};

export type ClubSeasonCharge = {
  sequence: number;
  type: 'deposit' | 'installment';
  dueDate: string;
  amount: number;
};

export type StandardClubSeasonSchedule = {
  charges: ClubSeasonCharge[];
  totalAmount: number;
  depositAmount: number;
  installmentTotal: number;
  remainingAfterDeposit: number;
};

type BuildStandardScheduleInput = {
  registrationDate: string;
  firstInstallmentDate: string;
  billingDay: number;
  terms: ClubSeasonPricingTerms;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string, fieldName: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must be a valid calendar date.`);
  }

  return parsed;
}

function formatDateOnly(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getMonthlyDueDate(firstInstallment: Date, monthOffset: number, billingDay: number): string {
  const monthStart = new Date(Date.UTC(
    firstInstallment.getUTCFullYear(),
    firstInstallment.getUTCMonth() + monthOffset,
    1
  ));
  const lastDayOfMonth = new Date(Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth() + 1,
    0
  )).getUTCDate();
  const dueDate = new Date(Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth(),
    Math.min(billingDay, lastDayOfMonth)
  ));

  return formatDateOnly(dueDate);
}

function requirePositiveInteger(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
}

/**
 * Build the immutable charge schedule a parent will review and accept.
 *
 * Dates are handled as calendar dates in UTC so a Pacific-time billing day
 * cannot drift while crossing daylight-saving boundaries. The caller remains
 * responsible for converting a due date into an execution timestamp.
 */
export function buildStandardClubSeasonSchedule({
  registrationDate,
  firstInstallmentDate,
  billingDay,
  terms,
}: BuildStandardScheduleInput): StandardClubSeasonSchedule {
  const registration = parseDateOnly(registrationDate, 'registrationDate');
  const firstInstallment = parseDateOnly(firstInstallmentDate, 'firstInstallmentDate');

  requirePositiveInteger(billingDay, 'billingDay');
  if (billingDay > 31) {
    throw new Error('billingDay must be between 1 and 31.');
  }

  requirePositiveInteger(terms.totalAmount, 'totalAmount');
  requirePositiveInteger(terms.depositAmount, 'depositAmount');
  requirePositiveInteger(terms.installmentAmount, 'installmentAmount');
  requirePositiveInteger(terms.installmentCount, 'installmentCount');

  const installmentTotal = terms.installmentAmount * terms.installmentCount;
  const calculatedTotal = terms.depositAmount + installmentTotal;
  if (calculatedTotal !== terms.totalAmount) {
    throw new Error(
      `Pricing terms do not reconcile: deposit plus installments equals ${calculatedTotal}, expected ${terms.totalAmount}.`
    );
  }

  const firstDueDate = getMonthlyDueDate(firstInstallment, 0, billingDay);
  if (firstDueDate <= registrationDate) {
    throw new Error('The first installment must be due after the registration deposit.');
  }

  const charges: ClubSeasonCharge[] = [
    {
      sequence: 0,
      type: 'deposit',
      dueDate: formatDateOnly(registration),
      amount: terms.depositAmount,
    },
  ];

  for (let index = 0; index < terms.installmentCount; index += 1) {
    charges.push({
      sequence: index + 1,
      type: 'installment',
      dueDate: getMonthlyDueDate(firstInstallment, index, billingDay),
      amount: terms.installmentAmount,
    });
  }

  return {
    charges,
    totalAmount: calculatedTotal,
    depositAmount: terms.depositAmount,
    installmentTotal,
    remainingAfterDeposit: installmentTotal,
  };
}
