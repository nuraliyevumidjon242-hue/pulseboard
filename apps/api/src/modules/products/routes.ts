import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { created, sendData } from '../../lib/http';
import { authenticate, requireStorePermission } from '../../middleware/auth';
import { writeLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import {
  adjustStockSchema,
  adjustmentListQuerySchema,
  createProductSchema,
  productListQuerySchema,
  updateProductSchema,
} from './schemas';
import {
  adjustStock,
  archiveProduct,
  createProduct,
  exportProductsCsv,
  findByBarcode,
  getProduct,
  importProductsCsv,
  inventorySummary,
  listAdjustments,
  listCategories,
  listLowStock,
  listProducts,
  productImportTemplate,
  updateProduct,
} from './service';
import multer from 'multer';
import { badRequest } from '../../lib/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const productsRouter = Router({ mergeParams: true });
productsRouter.use(authenticate);

productsRouter.get(
  '/',
  requireStorePermission('products:read'),
  asyncHandler(async (req, res) => {
    const options = productListQuerySchema.parse(req.query);
    const result = await listProducts(req.storeAccess!.store.id, options);
    const totalPages = Math.max(1, Math.ceil(result.total / options.limit));
    return res.status(200).json({
      data: result.products,
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

productsRouter.get(
  '/categories',
  requireStorePermission('products:read'),
  asyncHandler(async (req, res) => {
    const categories = await listCategories(req.storeAccess!.store.id);
    return sendData(res, categories);
  }),
);

productsRouter.get(
  '/barcode/:barcode',
  requireStorePermission('products:read'),
  asyncHandler(async (req, res) => {
    const product = await findByBarcode(req.storeAccess!.store.id, req.params.barcode);
    return sendData(res, { product });
  }),
);

productsRouter.get(
  '/:productId',
  requireStorePermission('products:read'),
  asyncHandler(async (req, res) => {
    const product = await getProduct(req.storeAccess!.store.id, req.params.productId);
    return sendData(res, { product });
  }),
);

productsRouter.post(
  '/',
  writeLimiter,
  requireStorePermission('products:write'),
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const product = await createProduct(req.storeAccess!.store.id, req.body, req.user!.id);
    return created(res, { product });
  }),
);

productsRouter.patch(
  '/:productId',
  writeLimiter,
  requireStorePermission('products:write'),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const product = await updateProduct(
      req.storeAccess!.store.id,
      req.params.productId,
      req.body,
      req.user!.id,
    );
    return sendData(res, { product });
  }),
);

productsRouter.delete(
  '/:productId',
  writeLimiter,
  requireStorePermission('products:write'),
  asyncHandler(async (req, res) => {
    await archiveProduct(req.storeAccess!.store.id, req.params.productId, req.user!.id);
    return sendData(res, { message: 'Product archived' });
  }),
);

/* ───────────────────────────── Inventory ───────────────────────────── */

export const inventoryRouter = Router({ mergeParams: true });
inventoryRouter.use(authenticate);

inventoryRouter.get(
  '/low-stock',
  requireStorePermission('products:read'),
  asyncHandler(async (req, res) => {
    const items = await listLowStock(req.storeAccess!.store.id);
    return res.status(200).json({ data: items, meta: { count: items.length } });
  }),
);

inventoryRouter.get(
  '/summary',
  requireStorePermission('products:read'),
  asyncHandler(async (req, res) => {
    const summary = await inventorySummary(req.storeAccess!.store.id);
    return sendData(res, summary);
  }),
);

inventoryRouter.get(
  '/adjustments',
  requireStorePermission('inventory:write'),
  asyncHandler(async (req, res) => {
    const options = adjustmentListQuerySchema.parse(req.query);
    const result = await listAdjustments(req.storeAccess!.store.id, options);
    const totalPages = Math.max(1, Math.ceil(result.total / options.limit));
    return res.status(200).json({
      data: result.adjustments,
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

inventoryRouter.post(
  '/adjust',
  writeLimiter,
  requireStorePermission('inventory:write'),
  validate(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const result = await adjustStock(
      req.storeAccess!.store.id,
      req.body.productId,
      req.body,
      req.user!.id,
    );
    return sendData(res, result);
  }),
);

inventoryRouter.get(
  '/export',
  requireStorePermission('analytics:export'),
  asyncHandler(async (req, res) => {
    const csv = await exportProductsCsv(req.storeAccess!.store.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    return res.send(csv);
  }),
);

inventoryRouter.get(
  '/template',
  requireStorePermission('inventory:write'),
  asyncHandler(async (_req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
    return res.send(productImportTemplate());
  }),
);

inventoryRouter.post(
  '/import',
  writeLimiter,
  requireStorePermission('inventory:write'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const csv =
      req.file?.buffer.toString('utf8') ?? (typeof req.body.csv === 'string' ? req.body.csv : '');
    if (!csv.trim()) throw badRequest('Upload a CSV file in the "file" field');
    const result = await importProductsCsv(req.storeAccess!.store.id, csv, req.user!.id);
    return sendData(res, result);
  }),
);
