import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Language, PaymentMethod } from '../types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const LOCALES: Record<Language, string> = {
  en: 'en-US',
  de: 'de-DE',
  uz: 'uz-UZ',
};

export function localeFor(language: Language | undefined): string {
  return LOCALES[language ?? 'en'] ?? 'en-US';
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
  // Compact notation hides cents, which is only acceptable for amounts that are
  // actually large enough to be abbreviated (e.g. €8.6K). Below €1,000 we keep
  // full precision so totals such as €163.60 never render as €163.6.
  const compact = options.compact === true && Math.abs(amount) >= 1_000;
  const formatter = new Intl.NumberFormat(options.locale ?? 'en-US', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : (options.decimals ?? 2),
    maximumFractionDigits: compact ? 1 : (options.decimals ?? 2),
  });
  return formatter.format(amount);
}

export function formatNumber(value: number | string, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(toNumber(value));
}

export function formatCompact(value: number | string, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

export function formatPercent(value: number | null | undefined, digits = 1, signed = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${signed && value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

export function formatDate(
  value: string | Date | null | undefined,
  timeZone = 'UTC',
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  locale = 'en-US',
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone = 'UTC',
  locale = 'en-US',
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
  locale = 'en-US',
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
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return 'just now';
}

export function greeting(date = new Date(), timeZone = 'UTC'): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(date),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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
  return PAYMENT_LABELS[method as PaymentMethod] ?? titleCase(method);
}

export function activityLabel(action: string): string {
  const [, ...rest] = action.split('.');
  return rest.length > 0 ? titleCase(rest.join(' ')) : titleCase(action);
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
