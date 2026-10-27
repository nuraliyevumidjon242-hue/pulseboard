import { getErrorFields } from './api';

/** Flattens the server's field validation errors into a single message per field. */
export function firstFieldErrors(error: unknown): Record<string, string> {
  const fields = getErrorFields(error);
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages[0] ?? 'Invalid value']),
  );
}
