const CLUB_TIME_ZONE = 'America/Los_Angeles';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type RegistrationEvent = {
  active: boolean | null;
  startDate: string | null;
  endDate: string | null;
  metadata?: string | null;
};

type RegistrationOpenDate =
  | { status: 'missing'; value: null }
  | { status: 'valid'; value: string }
  | { status: 'invalid'; value: null };

export function getClubDate(now = new Date()): string {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLUB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = dateParts.find((part) => part.type === 'year')?.value;
  const month = dateParts.find((part) => part.type === 'month')?.value;
  const day = dateParts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to determine the current club date.');
  }

  return `${year}-${month}-${day}`;
}

/**
 * Registration stays open through an event's final day. Events without a
 * machine-readable date remain controlled by the explicit active flag.
 */
export function isRegistrationEventEligible(
  event: RegistrationEvent,
  clubDate = getClubDate()
): boolean {
  if (event.active !== true) return false;

  const registrationOpenDate = getRegistrationOpenDate(event.metadata);
  if (registrationOpenDate.status === 'invalid') return false;
  if (registrationOpenDate.status === 'valid' && registrationOpenDate.value > clubDate) return false;

  const finalEventDate = event.endDate || event.startDate;
  if (!finalEventDate) return true;
  if (!ISO_DATE_PATTERN.test(finalEventDate)) return false;

  return finalEventDate >= clubDate;
}

function getRegistrationOpenDate(metadata: string | null | undefined): RegistrationOpenDate {
  if (!metadata) return { status: 'missing', value: null };

  try {
    const parsed = JSON.parse(metadata);
    if (!parsed || typeof parsed !== 'object') return { status: 'missing', value: null };

    const candidate = (parsed as Record<string, unknown>).registrationOpensOn
      ?? (parsed as Record<string, unknown>).registration_opens_on;

    if (candidate === undefined) return { status: 'missing', value: null };
    if (typeof candidate !== 'string') return { status: 'invalid', value: null };

    const value = candidate.trim();
    return ISO_DATE_PATTERN.test(value)
      ? { status: 'valid', value }
      : { status: 'invalid', value: null };
  } catch {
    return { status: 'invalid', value: null };
  }
}
