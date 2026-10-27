/**
 * Timezone-aware date helpers.
 *
 * Stores configure an IANA timezone. Analytics group data by the store's local
 * day/hour, so range boundaries must be computed in that timezone rather than
 * on the server's clock.
 */

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInTimeZone(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** UTC offset (ms) of a timezone at the given instant. */
function offsetMs(date: Date, timeZone: string): number {
  const p = partsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converts wall-clock components in a timezone to a UTC Date. */
export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let timestamp = guess - offsetMs(new Date(guess), timeZone);
  // Second pass handles DST transitions around the target wall clock.
  timestamp = guess - offsetMs(new Date(timestamp), timeZone);
  return new Date(timestamp);
}

export function startOfDayInTimeZone(timeZone: string, date = new Date()): Date {
  const p = partsInTimeZone(date, timeZone);
  return zonedTimeToUtc(timeZone, p.year, p.month, p.day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

export function toDateKey(date: Date, timeZone = 'UTC'): string {
  const p = partsInTimeZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Inclusive list of YYYY-MM-DD keys between two dates.
 *
 * Iteration happens on calendar days in UTC space, not by adding 24 hours to
 * an instant: a 24-hour step drifts across DST transitions (a local day can
 * be 23 or 25 hours), which used to duplicate or skip keys around the
 * Europe/Berlin clock change.
 */
export function dateKeysBetween(from: Date, to: Date, timeZone = 'UTC'): string[] {
  const start = parseDateKey(toDateKey(from, timeZone));
  const end = parseDateKey(toDateKey(to, timeZone));
  if (!start || !end) return [];

  const keys: string[] = [];
  let cursor = Date.UTC(start.year, start.month - 1, start.day);
  const last = Date.UTC(end.year, end.month - 1, end.day);

  for (let i = 0; i < 400 && cursor <= last; i += 1) {
    const date = new Date(cursor);
    keys.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
        date.getUTCDate(),
      ).padStart(2, '0')}`,
    );
    cursor += 86_400_000;
  }

  return keys;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function startOfDayKeyInTimeZone(key: string, timeZone: string): Date | null {
  const parsed = parseDateKey(key);
  if (!parsed) return null;
  return zonedTimeToUtc(timeZone, parsed.year, parsed.month, parsed.day);
}

export function startOfMonthInTimeZone(timeZone: string, date = new Date()): Date {
  const p = partsInTimeZone(date, timeZone);
  return zonedTimeToUtc(timeZone, p.year, p.month, 1);
}

export function startOfYearInTimeZone(timeZone: string, date = new Date()): Date {
  const p = partsInTimeZone(date, timeZone);
  return zonedTimeToUtc(timeZone, p.year, 1, 1);
}

export function diffInDays(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

/** Formats a UTC date as a human readable label in the given timezone. */
export function formatDateInTimeZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale = 'en-US',
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

export const toIsoString = (date: Date): string => date.toISOString();
