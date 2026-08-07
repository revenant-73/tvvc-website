export function clubDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function reminderDate(dueDate: string): string {
  return dueDate.slice(5) === '01-05' ? `${dueDate.slice(0, 4)}-01-02` : addDays(dueDate, -5);
}

export function retryDate(dueDate: string, nextAttemptNumber: number): string | null {
  if (nextAttemptNumber === 2) return addDays(dueDate, 3);
  if (nextAttemptNumber === 3) return addDays(dueDate, 7);
  return null;
}
