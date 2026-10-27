import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { sendData } from '../../lib/http';
import { authenticate, requireStorePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  customerAnalyticsQuerySchema,
  dashboardQuerySchema,
  exportRequestSchema,
  peakHoursQuerySchema,
  productPerformanceQuerySchema,
  revenueQuerySchema,
} from './schemas';
import {
  buildExport,
  getCustomerAnalytics,
  getDashboard,
  getPeakHours,
  getProductPerformance,
  getRevenue,
} from './service';

export const analyticsRouter = Router({ mergeParams: true });
analyticsRouter.use(authenticate);

analyticsRouter.get(
  '/dashboard',
  requireStorePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const { days } = dashboardQuerySchema.parse(req.query);
    const data = await getDashboard(req.storeAccess!.store, days);
    return sendData(res, data);
  }),
);

analyticsRouter.get(
  '/revenue',
  requireStorePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const options = revenueQuerySchema.parse(req.query);
    const data = await getRevenue(req.storeAccess!.store, options);
    return sendData(res, data);
  }),
);

analyticsRouter.get(
  '/products',
  requireStorePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const options = productPerformanceQuerySchema.parse(req.query);
    const data = await getProductPerformance(req.storeAccess!.store, options);
    return sendData(res, data);
  }),
);

analyticsRouter.get(
  '/customers',
  requireStorePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const { days } = customerAnalyticsQuerySchema.parse(req.query);
    const data = await getCustomerAnalytics(req.storeAccess!.store, days);
    return sendData(res, data);
  }),
);

analyticsRouter.get(
  '/peak-hours',
  requireStorePermission('analytics:read'),
  asyncHandler(async (req, res) => {
    const { days } = peakHoursQuerySchema.parse(req.query);
    const data = await getPeakHours(req.storeAccess!.store, days);
    return sendData(res, data);
  }),
);

analyticsRouter.post(
  '/export',
  requireStorePermission('analytics:export'),
  validate(exportRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await buildExport(req.storeAccess!.store, req.body.format, req.body.type);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    return res.send(result.buffer);
  }),
);

analyticsRouter.get(
  '/export',
  requireStorePermission('analytics:export'),
  asyncHandler(async (req, res) => {
    const options = exportRequestSchema.parse({
      format: req.query.format ?? 'pdf',
      type: req.query.type ?? 'monthly',
    });
    const result = await buildExport(req.storeAccess!.store, options.format, options.type);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }),
);
