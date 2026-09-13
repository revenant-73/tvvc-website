const CLUB_TIME_ZONE = 'America/Los_Angeles';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

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

type RegistrationCloseDateTime =
  | { status: 'missing'; value: null }
  | { status: 'valid'; value: string }
  | { status: 'invalid'; value: null };

type RegistrationClock = Date | string | {
  clubDate?: string;
  clubDateTime?: string;
};

export function getClubDate(now = new Date()): string {
  const { year, month, day } = getClubDateParts(now);
  return `${year}-${month}-${day}`;
}

export function getClubDateTime(now = new Date()): string {
  const { year, month, day, hour, minute } = getClubDateParts(now);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function getDefaultRegistrationClosesAtLocal(startDate: string | null | undefined): string | null {
  if (!startDate || !ISO_DATE_PATTERN.test(startDate)) return null;

  const [year, month, day] = startDate.split('-').map(Number);
  const previousDay = new Date(Date.UTC(year, month - 1, day - 1));
  const closeYear = previousDay.getUTCFullYear();
  const closeMonth = String(previousDay.getUTCMonth() + 1).padStart(2, '0');
  const closeDay = String(previousDay.getUTCDate()).padStart(2, '0');

  return `${closeYear}-${closeMonth}-${closeDay}T21:00`;
}

function getClubDateParts(now: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLUB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const year = dateParts.find((part) => part.type === 'year')?.value;
  const month = dateParts.find((part) => part.type === 'month')?.value;
  const day = dateParts.find((part) => part.type === 'day')?.value;
  const hour = dateParts.find((part) => part.type === 'hour')?.value;
  const minute = dateParts.find((part) => part.type === 'minute')?.value;

  if (!year || !month || !day || !hour || !minute) {
    throw new Error('Unable to determine the current club date/time.');
  }

  return { year, month, day, hour, minute };
}

/**
 * Registration stays open through an event's final day. Events without a
 * machine-readable date remain controlled by the explicit active flag. A
 * metadata registration close time can cut off registration earlier.
 */
export function isRegistrationEventEligible(
  event: RegistrationEvent,
  clock: RegistrationClock = new Date()
): boolean {
  if (event.active !== true) return false;

  const { clubDate, clubDateTime } = resolveRegistrationClock(clock);

  const registrationOpenDate = getRegistrationOpenDate(event.metadata);
  if (registrationOpenDate.status === 'invalid') return false;
  if (registrationOpenDate.status === 'valid' && registrationOpenDate.value > clubDate) return false;

  const registrationCloseDateTime = getRegistrationCloseDateTime(event.metadata);
  if (registrationCloseDateTime.status === 'invalid') return false;
  if (registrationCloseDateTime.status === 'valid' && registrationCloseDateTime.value <= clubDateTime) return false;

  const finalEventDate = event.endDate || event.startDate;
  if (!finalEventDate) return true;
  if (!ISO_DATE_PATTERN.test(finalEventDate)) return false;

  return finalEventDate >= clubDate;
}

export function getRegistrationCloseDateTime(metadata: string | null | undefined): RegistrationCloseDateTime {
  const parsed = parseEventMetadata(metadata);
  if (parsed === 'invalid') return { status: 'invalid', value: null };
  if (!parsed) return { status: 'missing', value: null };

  const candidate = parsed.registrationClosesAtLocal
    ?? parsed.registration_closes_at_local;

  if (candidate === undefined || candidate === null || candidate === '') {
    return { status: 'missing', value: null };
  }
  if (typeof candidate !== 'string') return { status: 'invalid', value: null };

  const value = candidate.trim();
  return LOCAL_DATE_TIME_PATTERN.test(value)
    ? { status: 'valid', value }
    : { status: 'invalid', value: null };
}

export function parseEventMetadata(
  metadata: string | null | undefined
): Record<string, unknown> | null | 'invalid' {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return 'invalid';
  }
}

function getRegistrationOpenDate(metadata: string | null | undefined): RegistrationOpenDate {
  const parsed = parseEventMetadata(metadata);
  if (parsed === 'invalid') return { status: 'invalid', value: null };
  if (!parsed) return { status: 'missing', value: null };

  const candidate = parsed.registrationOpensOn
    ?? parsed.registration_opens_on;

  if (candidate === undefined) return { status: 'missing', value: null };
  if (typeof candidate !== 'string') return { status: 'invalid', value: null };

  const value = candidate.trim();
  return ISO_DATE_PATTERN.test(value)
    ? { status: 'valid', value }
    : { status: 'invalid', value: null };
}

function resolveRegistrationClock(clock: RegistrationClock): { clubDate: string; clubDateTime: string } {
  if (typeof clock === 'string') {
    const clubDate = clock.slice(0, 10);
    const clubDateTime = LOCAL_DATE_TIME_PATTERN.test(clock)
      ? clock
      : `${clubDate}T00:00`;
    return { clubDate, clubDateTime };
  }

  if (clock instanceof Date) {
    return {
      clubDate: getClubDate(clock),
      clubDateTime: getClubDateTime(clock),
    };
  }

  const clubDate = clock.clubDate || clock.clubDateTime?.slice(0, 10) || getClubDate();
  const clubDateTime = clock.clubDateTime || `${clubDate}T00:00`;

  return { clubDate, clubDateTime };
}
