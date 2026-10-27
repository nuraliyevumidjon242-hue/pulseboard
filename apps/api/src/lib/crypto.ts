import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

export const randomToken = (bytes = 48): string => randomBytes(bytes).toString('hex');

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export function buildTransactionId(prefix: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
