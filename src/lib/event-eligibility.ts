const CLUB_TIME_ZONE = 'America/Los_Angeles';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type RegistrationEvent = {
  active: boolean | null;
  startDate: string | null;
  endDate: string | null;
};

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

  const finalEventDate = event.endDate || event.startDate;
  if (!finalEventDate) return true;
  if (!ISO_DATE_PATTERN.test(finalEventDate)) return false;

  return finalEventDate >= clubDate;
}
