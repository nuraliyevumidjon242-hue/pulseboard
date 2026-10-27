import { describe, expect, it } from 'vitest';
import { optionalQueryBoolean, queryBoolean } from './query';

describe('queryBoolean', () => {
  it('accepts the common truthy spellings', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', 'on']) {
      expect(queryBoolean.parse(value)).toBe(true);
    }
  });

  it('accepts the common falsy spellings instead of treating them as truthy', () => {
    for (const value of ['false', 'FALSE', '0', 'no', 'off']) {
      expect(queryBoolean.parse(value)).toBe(false);
    }
  });

  it('passes real booleans through', () => {
    expect(queryBoolean.parse(true)).toBe(true);
    expect(queryBoolean.parse(false)).toBe(false);
  });

  it('rejects ambiguous values', () => {
    expect(queryBoolean.safeParse('maybe').success).toBe(false);
    expect(queryBoolean.safeParse('').success).toBe(false);
  });

  it('defaults optional filters to false', () => {
    expect(optionalQueryBoolean.parse(undefined)).toBe(false);
    expect(optionalQueryBoolean.parse('true')).toBe(true);
  });
});
