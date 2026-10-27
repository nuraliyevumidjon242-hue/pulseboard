import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';
import { getErrorFields } from './api';
import { t } from './i18n';

/** Translates validation messages produced by Zod using the active language. */
function translateErrorTree(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message) {
    record.message = t(record.message);
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') translateErrorTree(value);
  }
}

/** Zod resolver that keeps every validation message in the active language. */
export function localizedZodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  const resolver = zodResolver(schema) as Resolver<T>;
  return async (values, context, options) => {
    const result = await resolver(values, context, options);
    translateErrorTree(result.errors);
    return result;
  };
}

/** Flattens the server's field validation errors into a single message per field. */
export function firstFieldErrors(error: unknown): Record<string, string> {
  const fields = getErrorFields(error);
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, t(messages[0] ?? 'Invalid value')]),
  );
}
