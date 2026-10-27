import { z } from 'zod';

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export const revenueQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  from: dateKey.optional(),
  to: dateKey.optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const productPerformanceQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(3).max(50).default(10),
  sortBy: z.enum(['revenue', 'quantity', 'profit']).default('revenue'),
});

export const customerAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
});

export const peakHoursQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const exportRequestSchema = z.object({
  format: z.enum(['pdf', 'csv']),
  type: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
});
