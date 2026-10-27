/**
 * Money helpers.
 *
 * Monetary values are persisted as PostgreSQL NUMERIC(12,2) and exposed to the
 * API as decimal strings. All arithmetic is performed on integer minor units
 * (cents) to avoid floating point drift.
 */

export function toCents(value: number | string): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) throw new Error(`Invalid monetary value: ${value}`);
  return Math.round(numeric * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function addMoney(...values: Array<number | string>): string {
  return fromCents(values.reduce<number>((total, value) => total + toCents(value), 0));
}

export function multiplyMoney(value: number | string, quantity: number): string {
  return fromCents(toCents(value) * quantity);
}

export function formatMoney(value: number | string, currency = 'EUR', locale = 'en-US'): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
