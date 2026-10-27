import { describe, expect, it } from 'vitest';
import {
  addMoney,
  formatMoney,
  fromCents,
  multiplyMoney,
  percentageChange,
  toCents,
} from './money';

describe('money helpers', () => {
  it('converts between decimal strings and integer cents', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents(0.1)).toBe(10);
    expect(toCents('0')).toBe(0);
    expect(fromCents(1999)).toBe('19.99');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(0)).toBe('0.00');
  });

  it('rejects non-finite monetary values', () => {
    expect(() => toCents('not money')).toThrow('Invalid monetary value');
    expect(() => toCents(Number.NaN)).toThrow('Invalid monetary value');
  });

  it('adds and multiplies without floating point drift', () => {
    expect(addMoney('0.10', '0.20')).toBe('0.30');
    expect(addMoney('10.50', 5.5, '0.01')).toBe('16.01');
    expect(multiplyMoney('19.99', 3)).toBe('59.97');
    expect(multiplyMoney(0.07, 3)).toBe('0.21');
  });

  it('formats currency with the requested locale', () => {
    expect(formatMoney('1234.5', 'EUR', 'en-US')).toMatch(/€1,234\.50/);
    expect(formatMoney(0, 'USD', 'en-US')).toMatch(/\$0\.00/);
    expect(formatMoney('abc', 'EUR', 'en-US')).toMatch(/€0\.00/);
  });

  it('computes percentage changes and handles division by zero', () => {
    expect(percentageChange(120, 100)).toBe(20);
    expect(percentageChange(80, 100)).toBe(-20);
    expect(percentageChange(0, 0)).toBe(0);
    expect(percentageChange(50, 0)).toBeNull();
    expect(percentageChange(123.456, 100)).toBe(23.5);
  });
});
