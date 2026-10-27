import { z } from 'zod';

const money = z.coerce
  .number()
  .min(0)
  .max(1_000_000_000)
  .refine((value) => Math.round(value * 100) === Number((value * 100).toFixed(6)), {
    message: 'Maximum 2 decimal places',
  })
  .default(0);

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product id'),
        quantity: z.coerce.number().int().min(1).max(100_000),
      }),
    )
    .min(1, 'At least one item is required')
    .max(100, 'A sale cannot contain more than 100 line items'),
  paymentMethod: z.enum(['cash', 'card', 'mobile', 'cheque']),
  discount: money,
  customerName: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const saleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  paymentMethod: z.enum(['cash', 'card', 'mobile', 'cheque']).optional(),
  search: z.string().trim().max(100).optional(),
  cashierId: z.string().uuid().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dailyStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const hourlyStatsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleListQuery = z.infer<typeof saleListQuerySchema>;
