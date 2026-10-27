import { z } from 'zod';
import { optionalQueryBoolean } from '../../lib/query';

const money = z.coerce
  .number()
  .min(0, 'Value cannot be negative')
  .max(1_000_000_000, 'Value is too large')
  .refine((value) => Math.round(value * 100) === Number((value * 100).toFixed(6)), {
    message: 'Maximum 2 decimal places',
  });

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional()
  .or(z.literal(''));

const productFields = {
  sku: z.string().trim().min(1, 'SKU is required').max(100),
  name: z.string().trim().min(1, 'Name is required').max(255),
  category: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  price: money,
  cost: money.optional(),
  currentStock: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0),
  maxStock: z.coerce.number().int().min(0),
  unit: z.string().trim().max(20),
  barcode: z.string().trim().max(100).optional(),
  imageUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  expiryDate: dateKey,
};

export const createProductSchema = z.object(productFields).extend({
  currentStock: productFields.currentStock.default(0),
  minStock: productFields.minStock.default(10),
  maxStock: productFields.maxStock.default(1000),
  unit: productFields.unit.default('pcs'),
});

// Built from the un-defaulted fields: `.partial()` would otherwise apply the
// creation defaults and silently reset stock/unit on every PATCH.
export const updateProductSchema = z
  .object(productFields)
  .partial()
  .refine(
    (value) =>
      value.minStock === undefined ||
      value.maxStock === undefined ||
      value.maxStock >= value.minStock,
    { message: 'maxStock must be greater than or equal to minStock', path: ['maxStock'] },
  );

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  lowStockOnly: optionalQueryBoolean,
  includeInactive: optionalQueryBoolean,
  sortBy: z.enum(['name', 'price', 'stock', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const adjustStockSchema = z.object({
  productId: z.string().uuid('Invalid product id'),
  quantityChange: z.coerce
    .number()
    .int()
    .refine((value) => value !== 0, 'Change cannot be zero'),
  reason: z.enum(['purchase', 'loss', 'damage', 'correction', 'return']),
  notes: z.string().trim().max(500).optional(),
});

export const adjustmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().uuid().optional(),
  reason: z.enum(['purchase', 'sale', 'loss', 'damage', 'correction', 'return']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
