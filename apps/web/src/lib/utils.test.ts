import { describe, expect, it } from 'vitest';
import {
  computeStockTone,
  dateRangeParams,
  formatCompact,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  initials,
  paymentLabel,
  percentOf,
  titleCase,
  toNumber,
} from './utils';

describe('formatCurrency', () => {
  it('formats EUR amounts with two decimals', () => {
    expect(formatCurrency('1234.5', 'EUR')).toBe('€1,234.50');
    expect(formatCurrency(0, 'EUR')).toBe('€0.00');
  });

  it('compacts large amounts for KPI tiles', () => {
    expect(formatCurrency('8610.45', 'EUR', { compact: true })).toContain('8.6');
  });

  it('keeps cents when a compact amount is below one thousand', () => {
    expect(formatCurrency('163.6', 'EUR', { compact: true })).toBe('€163.60');
    expect(formatCurrency('999.99', 'EUR', { compact: true })).toBe('€999.99');
  });

  it('handles invalid input without throwing', () => {
    expect(formatCurrency(undefined, 'EUR')).toBe('€0.00');
    expect(toNumber('not-a-number')).toBe(0);
  });
});

describe('formatPercent', () => {
  it('prefixes positive deltas with a plus sign', () => {
    expect(formatPercent(12.34)).toBe('+12.3%');
    expect(formatPercent(-4.2)).toBe('-4.2%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('can render absolute rates without a sign', () => {
    expect(formatPercent(42, 1, false)).toBe('42.0%');
  });

  it('renders an em dash for unknown values', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('localized formatting', () => {
  it('uses space grouping and comma decimals for Uzbek', () => {
    expect(formatCurrency('213.57', 'EUR', { locale: 'uz-UZ' })).toBe('213,57 €');
    expect(formatCurrency('8727.5', 'EUR', { compact: true, locale: 'uz-UZ' })).toBe('8,7 ming €');
    expect(formatNumber(8727.5, 'uz-UZ')).toBe('8\u00A0727,5');
    expect(formatPercent(34.1, 1, false, 'uz-UZ')).toBe('34,1%');
  });

  it('uses Uzbek month and weekday names instead of ICU fallbacks', () => {
    expect(
      formatDate(
        '2026-10-26T12:00:00Z',
        'UTC',
        { weekday: 'long', month: 'long', day: 'numeric' },
        'uz-UZ',
      ),
    ).toBe('dushanba, 26-oktabr');
    expect(
      formatDate('2026-10-26T12:00:00Z', 'UTC', { month: 'short', day: 'numeric' }, 'uz-UZ'),
    ).toBe('26-okt');
    expect(
      formatDate('2026-01-05T12:00:00Z', 'UTC', { month: 'long', year: 'numeric' }, 'uz-UZ'),
    ).toBe('yanvar 2026');
  });

  it('shortens German chart numbers with Tsd. and Mio.', () => {
    expect(formatCompact(8727, 'de-DE')).toBe('8,7 Tsd.');
    expect(formatCompact(1_500_000, 'de-DE')).toBe('1,5 Mio.');
  });

  it('falls back to full precision when German does not abbreviate', () => {
    expect(formatCurrency('8727.5', 'EUR', { compact: true, locale: 'de-DE' })).toBe(
      '8.727,50\u00A0€',
    );
    expect(formatCurrency('1500000', 'EUR', { compact: true, locale: 'de-DE' })).toBe(
      '1,5\u00A0Mio.\u00A0€',
    );
  });
});

describe('inventory helpers', () => {
  it('classifies stock levels', () => {
    expect(computeStockTone(0, 5)).toBe('out');
    expect(computeStockTone(5, 5)).toBe('low');
    expect(computeStockTone(6, 5)).toBe('healthy');
  });

  it('computes percentages safely', () => {
    expect(percentOf(25, 200)).toBe(12.5);
    expect(percentOf(1, 0)).toBe(0);
  });
});

describe('display helpers', () => {
  it('formats names and labels', () => {
    expect(initials('Mara', 'Vogel')).toBe('MV');
    expect(initials(null, null)).toBe('PB');
    expect(titleCase('low_stock')).toBe('Low Stock');
    expect(paymentLabel('mobile')).toBe('Mobile pay');
  });

  it('builds an inclusive date range', () => {
    const range = dateRangeParams(7);
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const from = new Date(`${range.from}T00:00:00Z`);
    const to = new Date(`${range.to}T00:00:00Z`);
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(6);
  });
});
