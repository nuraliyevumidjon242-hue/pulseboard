import { describe, expect, it } from 'vitest';
import {
  computeStockTone,
  dateRangeParams,
  formatCurrency,
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
