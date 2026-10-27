import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { created, sendData } from '../../lib/http';
import { authenticate, requireStorePermission } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import { recordActivity } from '../../lib/activity';
import {
  createStoreSchema,
  listStoresQuerySchema,
  storeSettingsSchema,
  updateStoreSchema,
} from './schemas';
import {
  compareStores,
  createStore,
  deleteStore,
  getStoreDetails,
  listStoresWithMetrics,
  updateStore,
} from './service';
import { permissionsFor } from '../access/permissions';
import { z } from 'zod';

export const storesRouter = Router();

storesRouter.use(authenticate);

storesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listStoresQuerySchema.parse(req.query);
    const result = await listStoresWithMetrics(req.user!.id, req.user!.role, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      includeInactive: query.includeInactive,
    });

    return res.status(200).json({
      data: result.stores,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.limit)),
        hasNext: query.page * query.limit < result.total,
        hasPrevious: query.page > 1,
      },
    });
  }),
);

storesRouter.get(
  '/compare',
  asyncHandler(async (req, res) => {
    const data = await compareStores(req.user!.id, req.user!.role);
    return sendData(res, data);
  }),
);

storesRouter.post(
  '/',
  writeLimiter,
  validate(createStoreSchema),
  asyncHandler(async (req, res) => {
    if (!['business_owner', 'super_admin'].includes(req.user!.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only business owners can create stores' },
      });
    }
    const store = await createStore(req.user!.id, req.body);
    return created(res, {
      store,
      role: 'admin',
      permissions: permissionsFor('admin'),
    });
  }),
);

storesRouter.get(
  '/:storeId',
  requireStorePermission('store:read'),
  asyncHandler(async (req, res) => {
    const access = req.storeAccess!;
    const data = await getStoreDetails(access.store.id, access.role);
    return sendData(res, { ...data, role: access.role, isOwner: access.isOwner });
  }),
);

storesRouter.patch(
  '/:storeId',
  writeLimiter,
  requireStorePermission('store:update'),
  validate(updateStoreSchema),
  asyncHandler(async (req, res) => {
    const store = await updateStore(req.storeAccess!.store.id, req.body, req.user!.id);
    return sendData(res, { store });
  }),
);

storesRouter.delete(
  '/:storeId',
  writeLimiter,
  requireStorePermission('store:delete'),
  asyncHandler(async (req, res) => {
    await deleteStore(req.storeAccess!.store.id, req.user!.id);
    return sendData(res, { message: 'Store deleted' });
  }),
);

storesRouter.get(
  '/:storeId/settings',
  requireStorePermission('settings:write'),
  asyncHandler(async (req, res) => {
    const { store } = req.storeAccess!;
    return sendData(res, {
      settings: {
        name: store.name,
        address: store.address,
        city: store.city,
        country: store.country,
        timezone: store.timezone,
        currency: store.currency,
        phone: store.phone,
        email: store.email,
        description: store.description,
        logoUrl: store.logoUrl,
        ...store.settings,
      },
    });
  }),
);

const updateSettingsSchema = updateStoreSchema
  .omit({ name: true })
  .extend({ settings: storeSettingsSchema.optional() });

storesRouter.put(
  '/:storeId/settings',
  writeLimiter,
  requireStorePermission('settings:write'),
  validate(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const store = await updateStore(req.storeAccess!.store.id, req.body, req.user!.id);
    recordActivity({
      userId: req.user!.id,
      storeId: store.id,
      action: 'settings.updated',
      entityType: 'store',
      entityId: store.id,
      ipAddress: req.ip,
    });
    return sendData(res, {
      settings: { ...store.settings, currency: store.currency, timezone: store.timezone },
    });
  }),
);

export const storeIdParamSchema = z.object({
  storeId: z.string().uuid('Invalid store id'),
});
