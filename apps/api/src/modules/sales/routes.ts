import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { created, sendData } from '../../lib/http';
import { authenticate, requireStorePermission } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import {
  createSaleSchema,
  dailyStatsQuerySchema,
  hourlyStatsQuerySchema,
  saleListQuerySchema,
} from './schemas';
import {
  createSale,
  dailyStats,
  getSale,
  hourlyStats,
  listSales,
  paymentBreakdown,
  recentSales,
} from './service';
import { addDays, startOfDayInTimeZone } from '../../lib/time';

export const salesRouter = Router({ mergeParams: true });
salesRouter.use(authenticate);

salesRouter.post(
  '/',
  writeLimiter,
  requireStorePermission('sales:write'),
  validate(createSaleSchema),
  asyncHandler(async (req, res) => {
    const access = req.storeAccess!;
    const result = await createSale(access.store, req.user!.id, req.body);
    return created(res, result);
  }),
);

salesRouter.get(
  '/',
  requireStorePermission('sales:read'),
  asyncHandler(async (req, res) => {
    const options = saleListQuerySchema.parse(req.query);
    const store = req.storeAccess!.store;
    const result = await listSales(store.id, options, store.timezone);
    const totalPages = Math.max(1, Math.ceil(result.total / options.limit));

    return res.status(200).json({
      data: result.sales,
      meta: {
        page: options.page,
        limit: options.limit,
        total: result.total,
        totalPages,
        hasNext: options.page < totalPages,
        hasPrevious: options.page > 1,
      },
    });
  }),
);

salesRouter.get(
  '/stats/daily',
  requireStorePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const { days } = dailyStatsQuerySchema.parse(req.query);
    const data = await dailyStats(req.storeAccess!.store, days);
    return sendData(res, data);
  }),
);

salesRouter.get(
  '/stats/hourly',
  requireStorePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const { date } = hourlyStatsQuerySchema.parse(req.query);
    const data = await hourlyStats(req.storeAccess!.store, date);
    return sendData(res, data);
  }),
);

salesRouter.get(
  '/stats/payments',
  requireStorePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const store = req.storeAccess!.store;
    const from = startOfDayInTimeZone(store.timezone, addDays(new Date(), -29));
    const to = addDays(startOfDayInTimeZone(store.timezone, new Date()), 1);
    const data = await paymentBreakdown(store.id, from, to);
    return sendData(res, data);
  }),
);

salesRouter.get(
  '/recent',
  requireStorePermission('sales:read'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit ?? 8) || 8));
    const data = await recentSales(req.storeAccess!.store.id, limit);
    return sendData(res, data);
  }),
);

salesRouter.get(
  '/:saleId',
  requireStorePermission('sales:read'),
  asyncHandler(async (req, res) => {
    const sale = await getSale(req.storeAccess!.store.id, req.params.saleId);
    return sendData(res, { sale });
  }),
);
