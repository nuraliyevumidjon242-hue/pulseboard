import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Language, PaymentMethod } from '../types';
import { intlLocale, t } from './i18n';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const LOCALES: Record<Language, string> = {
  en: 'en-US',
  de: 'de-DE',
  uz: 'uz-UZ',
};

/**
 * Uzbek (Latin) formatting is implemented in-house.
 *
 * Not every browser runtime ships Latin Uzbek ICU data. When it is missing,
 * `Intl` silently falls back to a mixed pattern such as "M10 26, Mon" and
 * dot-decimal money. These tables keep the Uzbek interface deterministic and
 * independent of the user's ICU build.
 */
const UZ_MONTHS_SHORT = [
  'yan',
  'fev',
  'mar',
  'apr',
  'may',
  'iyn',
  'iyl',
  'avg',
  'sen',
  'okt',
  'noy',
  'dek',
];
const UZ_MONTHS_LONG = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];
const UZ_WEEKDAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const UZ_WEEKDAYS_LONG = [
  'yakshanba',
  'dushanba',
  'seshanba',
  'chorshanba',
  'payshanba',
  'juma',
  'shanba',
];
const UZ_CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  UZS: "so'm",
  KZT: '₸',
  JPY: '¥',
  AED: 'AED',
};

export function localeFor(language: Language | undefined): string {
  return LOCALES[language ?? 'en'] ?? 'en-US';
}

function isUzbek(locale: string): boolean {
  return locale.toLowerCase().startsWith('uz');
}

/** Space-grouped, comma-decimal number formatting used by Uzbek typography. */
function formatUzbekNumber(value: number, minimumFractionDigits = 0, maximumFractionDigits = 3) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

function formatUzbekCompact(value: number): string {
  const absolute = Math.abs(value);
  const scale = (divisor: number, suffix: string) =>
    `${formatUzbekNumber(value / divisor, 0, 1)} ${suffix}`;
  if (absolute >= 1_000_000_000) return scale(1_000_000_000, 'mlrd');
  if (absolute >= 1_000_000) return scale(1_000_000, 'mln');
  if (absolute >= 1_000) return scale(1_000, 'ming');
  return formatUzbekNumber(value, 0, 1);
}

/**
 * Formats a date using explicit Uzbek names. Numeric pieces are resolved in the
 * requested timezone first, so a store's local day never shifts.
 */
function formatUzbekDate(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: options.hour ? 'numeric' : undefined,
    minute: options.minute ? 'numeric' : undefined,
    hour12: false,
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  const day = Number(part('day'));
  const month = Number(part('month')) - 1;
  const year = part('year');
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));

  const chunks: string[] = [];

  if (options.weekday) {
    const weekday =
      options.weekday === 'long'
        ? (UZ_WEEKDAYS_LONG[weekdayIndex] ?? '')
        : (UZ_WEEKDAYS_SHORT[weekdayIndex] ?? '');
    if (weekday) chunks.push(weekday);
  }

  let datePart = '';
  if (options.month === 'long' || options.month === 'short') {
    const monthName =
      options.month === 'long' ? (UZ_MONTHS_LONG[month] ?? '') : (UZ_MONTHS_SHORT[month] ?? '');
    datePart = `${day}-${monthName}`;
  } else if (options.month === 'numeric') {
    datePart = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}`;
  } else if (options.day) {
    datePart = String(day);
  }

  if (options.month === 'long' && options.year && !options.day) {
    datePart = `${UZ_MONTHS_LONG[month] ?? ''} ${year}`;
  } else if (options.year) {
    datePart = datePart ? `${datePart} ${year}` : year;
  }

  if (datePart) chunks.push(datePart);

  if (options.hour || options.minute) {
    chunks.push(`${part('hour').padStart(2, '0')}:${part('minute').padStart(2, '0')}`);
  }

  return chunks.filter(Boolean).join(', ');
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(
  value: string | number | null | undefined,
  currency = 'EUR',
  options: { compact?: boolean; decimals?: number; locale?: string } = {},
): string {
  const amount = toNumber(value);
  const locale = options.locale ?? intlLocale();
  // Compact notation hides cents, which is only acceptable for amounts that are
  // actually large enough to be abbreviated (e.g. €8.6K). Below €1,000 we keep
  // full precision so totals such as €163.60 never render as €163.6.
  const compact = options.compact === true && Math.abs(amount) >= 1_000;

  if (isUzbek(locale)) {
    const digits = compact ? 0 : (options.decimals ?? 2);
    const number = compact ? formatUzbekCompact(amount) : formatUzbekNumber(amount, digits, digits);
    const symbol = UZ_CURRENCY_SYMBOLS[currency] ?? currency;
    return `${number} ${symbol}`;
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : (options.decimals ?? 2),
    maximumFractionDigits: compact ? 1 : (options.decimals ?? 2),
  });
  const formatted = formatter.format(amount);

  // German ICU only abbreviates at the million, so €8,727.50 would otherwise
  // render as the awkward "8727,5 €". Fall back to full precision when the
  // compact form did not actually shorten the number.
  if (compact) {
    const shortNumber = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
    if (!/\p{L}/u.test(shortNumber)) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: options.decimals ?? 2,
        maximumFractionDigits: options.decimals ?? 2,
      }).format(amount);
    }
  }

  return formatted;
}

export function formatNumber(value: number | string, locale = intlLocale()): string {
  if (isUzbek(locale)) return formatUzbekNumber(toNumber(value), 0, 3);
  return new Intl.NumberFormat(locale).format(toNumber(value));
}

export function formatCompact(value: number | string, locale = intlLocale()): string {
  const amount = toNumber(value);
  if (isUzbek(locale)) return formatUzbekCompact(amount);
  if (locale.toLowerCase().startsWith('de')) {
    // The German ICU compact pattern starts at millions; thousands are easier
    // to scan with the idiomatic "Tsd." suffix on chart axes.
    if (Math.abs(amount) >= 1_000_000) {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount / 1_000_000)} Mio.`;
    }
    if (Math.abs(amount) >= 1_000) {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount / 1_000)} Tsd.`;
    }
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount);
  }
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
  signed = true,
  locale = intlLocale(),
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const formatted = isUzbek(locale)
    ? formatUzbekNumber(value, digits, digits)
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
  return `${signed && value > 0 ? '+' : ''}${formatted}%`;
}

export function formatDate(
  value: string | Date | null | undefined,
  timeZone = 'UTC',
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  locale = intlLocale(),
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  if (isUzbek(locale)) return formatUzbekDate(date, timeZone, options);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone = 'UTC',
  locale = intlLocale(),
): string {
  return formatDate(
    value,
    timeZone,
    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    locale,
  );
}

export function formatTime(
  value: string | Date | null | undefined,
  timeZone = 'UTC',
  locale = intlLocale(),
): string {
  return formatDate(value, timeZone, { hour: '2-digit', minute: '2-digit' }, locale);
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1_000],
  ];
  const locale = intlLocale();

  for (const [unit, ms] of units) {
    if (abs < ms && unit !== 'second') continue;
    const amount = Math.round(diff / ms);
    if (isUzbek(locale)) return formatUzbekRelative(amount, unit);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(amount, unit);
  }
  return t('just now');
}

const UZ_RELATIVE_UNITS: Record<string, string> = {
  year: 'yil',
  month: 'oy',
  week: 'hafta',
  day: 'kun',
  hour: 'soat',
  minute: 'daqiqa',
  second: 'soniya',
};

function formatUzbekRelative(amount: number, unit: Intl.RelativeTimeFormatUnit): string {
  const label = UZ_RELATIVE_UNITS[unit] ?? unit;
  const count = Math.abs(amount);
  if (amount === 0) return 'hozir';
  if (amount < 0) {
    if (unit === 'day' && count === 1) return 'kecha';
    return `${formatUzbekNumber(count)} ${label} oldin`;
  }
  return `${formatUzbekNumber(count)} ${label}dan keyin`;
}

export function greeting(date = new Date(), timeZone = 'UTC'): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(date),
  );
  if (hour < 12) return t('Good morning');
  if (hour < 18) return t('Good afternoon');
  return t('Good evening');
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim().charAt(0) ?? '';
  const last = lastName?.trim().charAt(0) ?? '';
  return `${first}${last}`.toUpperCase() || 'PB';
}

export function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile: 'Mobile pay',
  cheque: 'Cheque',
};

export function paymentLabel(method: string): string {
  return t(PAYMENT_LABELS[method as PaymentMethod] ?? titleCase(method));
}

export function activityLabel(action: string): string {
  const [, ...rest] = action.split('.');
  return t(rest.length > 0 ? titleCase(rest.join(' ')) : titleCase(action));
}

export function percentOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function slugToTitle(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function computeStockTone(current: number, min: number): 'out' | 'low' | 'healthy' {
  if (current <= 0) return 'out';
  if (current <= min) return 'low';
  return 'healthy';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function filenameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
}

export function dateRangeParams(days: number): { from?: string; to?: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - (days - 1));
  const key = (date: Date) => date.toISOString().slice(0, 10);
  return { from: key(from), to: key(to) };
}
