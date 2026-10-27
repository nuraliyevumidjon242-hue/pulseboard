import { z } from 'zod';

const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off']);

/**
 * Parses the usual query-string spellings of a boolean. Plain `z.coerce.boolean()`
 * would treat the string "false" as truthy, which silently flips filters.
 */
export const queryBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (TRUTHY.has(normalized)) return true;
    if (FALSY.has(normalized)) return false;
  }
  return value;
}, z.boolean());

export const optionalQueryBoolean = queryBoolean.optional().default(false);
