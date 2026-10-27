import { describe, expect, it } from 'vitest';
import {
  addDays,
  addHours,
  dateKeysBetween,
  diffInDays,
  formatDateInTimeZone,
  isValidTimeZone,
  parseDateKey,
  startOfDayInTimeZone,
  startOfDayKeyInTimeZone,
  startOfMonthInTimeZone,
  startOfYearInTimeZone,
  toDateKey,
  zonedTimeToUtc,
} from './time';

describe('timezone helpers', () => {
  it('validates IANA timezone identifiers', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('Asia/Tashkent')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('converts zoned wall-clock time to UTC across DST boundaries', () => {
    expect(zonedTimeToUtc('Europe/Berlin', 2026, 7, 1, 12).toISOString()).toBe(
      '2026-07-01T10:00:00.000Z',
    );
    expect(zonedTimeToUtc('Europe/Berlin', 2026, 1, 15, 12).toISOString()).toBe(
      '2026-01-15T11:00:00.000Z',
    );
    expect(zonedTimeToUtc('Asia/Tashkent', 2026, 6, 1, 9).toISOString()).toBe(
      '2026-06-01T04:00:00.000Z',
    );
  });

  it('finds the start of the local day', () => {
    expect(startOfDayInTimeZone('UTC', new Date('2026-05-10T18:30:00Z')).toISOString()).toBe(
      '2026-05-10T00:00:00.000Z',
    );
    expect(
      startOfDayInTimeZone('Europe/Berlin', new Date('2026-05-10T18:30:00Z')).toISOString(),
    ).toBe('2026-05-09T22:00:00.000Z');
    expect(
      startOfDayInTimeZone('America/New_York', new Date('2026-01-01T06:30:00Z')).toISOString(),
    ).toBe('2026-01-01T05:00:00.000Z');
  });

  it('handles day arithmetic in UTC', () => {
    const base = new Date('2026-03-28T12:00:00Z');
    expect(addDays(base, 2).toISOString()).toBe('2026-03-30T12:00:00.000Z');
    expect(addDays(base, -1).toISOString()).toBe('2026-03-27T12:00:00.000Z');
    expect(addHours(base, 5).toISOString()).toBe('2026-03-28T17:00:00.000Z');
    expect(diffInDays(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-08T00:00:00Z'))).toBe(7);
    expect(diffInDays(new Date('2026-01-08T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))).toBe(1);
  });

  it('formats date keys in the target timezone', () => {
    const instant = new Date('2026-01-01T00:30:00Z');
    expect(toDateKey(instant, 'UTC')).toBe('2026-01-01');
    expect(toDateKey(instant, 'America/New_York')).toBe('2025-12-31');
    expect(toDateKey(instant, 'Asia/Tokyo')).toBe('2026-01-01');
  });

  it('builds inclusive date key ranges and parses them', () => {
    const keys = dateKeysBetween(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-04T00:00:00Z'),
    );
    expect(keys).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);

    // Regression: Europe/Berlin switches back to CET on 2026-10-25. A 24-hour
    // cursor step used to duplicate that key and drop the final day.
    const acrossDst = dateKeysBetween(
      startOfDayInTimeZone('Europe/Berlin', new Date('2026-10-01T12:00:00Z')),
      startOfDayInTimeZone('Europe/Berlin', new Date('2026-10-31T12:00:00Z')),
      'Europe/Berlin',
    );
    expect(acrossDst).toHaveLength(31);
    expect(new Set(acrossDst).size).toBe(31);
    expect(acrossDst.at(-1)).toBe('2026-10-31');

    expect(parseDateKey('2026-08-09')).toEqual({ year: 2026, month: 8, day: 9 });
    expect(parseDateKey('09/08/2026')).toBeNull();
    expect(parseDateKey('2026-13-01')).toEqual({ year: 2026, month: 13, day: 1 });
  });

  it('resolves date keys and month/year boundaries in a timezone', () => {
    expect(startOfDayKeyInTimeZone('2026-06-15', 'Europe/Berlin')?.toISOString()).toBe(
      '2026-06-14T22:00:00.000Z',
    );
    expect(startOfDayKeyInTimeZone('nope', 'Europe/Berlin')).toBeNull();

    const reference = new Date('2026-07-15T12:00:00Z');
    expect(startOfMonthInTimeZone('Europe/Berlin', reference).toISOString()).toBe(
      '2026-06-30T22:00:00.000Z',
    );
    expect(startOfYearInTimeZone('Europe/Berlin', reference).toISOString()).toBe(
      '2025-12-31T23:00:00.000Z',
    );
  });

  it('formats dates with the store locale and timezone', () => {
    const date = new Date('2026-07-04T10:00:00Z');
    expect(formatDateInTimeZone(date, 'Europe/Berlin')).toBe('Jul 4');
    expect(formatDateInTimeZone(date, 'Asia/Tokyo')).toBe('Jul 4');
    expect(formatDateInTimeZone(date, 'America/Los_Angeles')).toBe('Jul 4');
    expect(
      formatDateInTimeZone(date, 'Europe/Berlin', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    ).toBe('07/04/2026');
  });
});
