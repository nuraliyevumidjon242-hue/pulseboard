import { z } from 'zod';
import { optionalQueryBoolean } from '../../lib/query';
import { isValidTimeZone } from '../../lib/time';

const timezoneSchema = z
  .string()
  .max(64)
  .refine((value) => isValidTimeZone(value), 'Invalid IANA timezone');

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code');

export const storeSettingsSchema = z.object({
  milestoneAmount: z.number().min(0).max(1_000_000_000).optional(),
  lowStockEmails: z.boolean().optional(),
  dataRetentionDays: z.number().int().min(0).max(3650).optional(),
  receiptPrefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9-]+$/, 'Prefix may only contain uppercase letters, numbers and dashes')
    .optional(),
});

const storeFields = {
  name: z.string().trim().min(2).max(255),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  timezone: timezoneSchema,
  currency: currencySchema,
  logoUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional(),
  settings: storeSettingsSchema.optional(),
};

export const createStoreSchema = z.object(storeFields).extend({
  timezone: timezoneSchema.default('Europe/Berlin'),
  currency: currencySchema.default('EUR'),
});

// No creation defaults here: a PATCH for one field must not reset timezone or currency.
export const updateStoreSchema = z.object(storeFields).partial();

export const listStoresQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  includeInactive: optionalQueryBoolean,
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
