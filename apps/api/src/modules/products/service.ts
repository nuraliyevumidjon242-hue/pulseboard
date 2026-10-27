import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { inventoryAdjustments, products, stores, users, type ProductRow } from '../../db/schema';
import { recordActivity } from '../../lib/activity';
import { invalidateStoreCache } from '../../lib/cache';
import { parseCsvObjects, toCsv } from '../../lib/csv';
import { badRequest, notFound } from '../../lib/errors';
import { sendLowStockEmail } from '../../lib/mailer';
import { notifyUsers, getStoreAlertRecipients } from '../../lib/notifications';
import { emitToStore } from '../../realtime/bus';
import { z } from 'zod';
import { createProductSchema, updateProductSchema } from './schemas';

type CreateInput = z.infer<typeof createProductSchema>;
type UpdateInput = z.infer<typeof updateProductSchema>;

export interface ProductListOptions {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
  includeInactive?: boolean;
  sortBy: 'name' | 'price' | 'stock' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

const sortColumns = {
  name: products.name,
  price: products.price,
  stock: products.currentStock,
  createdAt: products.createdAt,
} as const;

export async function listProducts(
  storeId: string,
  options: ProductListOptions,
): Promise<{ products: ProductRow[]; total: number }> {
  const db = getDb();
  const conditions: SQL[] = [eq(products.storeId, storeId)];

  if (!options.includeInactive) conditions.push(eq(products.isActive, true));
  if (options.search) {
    const term = `%${options.search}%`;
    const search = or(
      ilike(products.name, term),
      ilike(products.sku, term),
      ilike(products.barcode, term),
    );
    if (search) conditions.push(search);
  }
  if (options.category) conditions.push(eq(products.category, options.category));
  if (options.lowStockOnly) conditions.push(sql`${products.currentStock} <= ${products.minStock}`);

  const where = and(...conditions);
  const direction = options.sortOrder === 'asc' ? asc : desc;
  const column = sortColumns[options.sortBy];

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(direction(column))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
  ]);

  return { products: rows, total: totals[0]?.total ?? 0 };
}

export async function listCategories(storeId: string): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isActive, true)));
  return rows
    .map((row) => row.category)
    .filter((category): category is string => Boolean(category))
    .sort((a, b) => a.localeCompare(b));
}

export async function getProduct(storeId: string, productId: string): Promise<ProductRow> {
  const [product] = await getDb()
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.id, productId)))
    .limit(1);
  if (!product) throw notFound('Product not found');
  return product;
}

export async function createProduct(
  storeId: string,
  input: CreateInput,
  actorId: string,
): Promise<ProductRow> {
  if (input.maxStock < input.minStock) {
    throw badRequest('maxStock must be greater than or equal to minStock');
  }

  const [product] = await getDb()
    .insert(products)
    .values({
      storeId,
      sku: input.sku,
      name: input.name,
      category: input.category || null,
      description: input.description || null,
      price: input.price.toFixed(2),
      cost: input.cost !== undefined ? input.cost.toFixed(2) : null,
      currentStock: input.currentStock,
      minStock: input.minStock,
      maxStock: input.maxStock,
      unit: input.unit,
      barcode: input.barcode || null,
      imageUrl: input.imageUrl || null,
      expiryDate: input.expiryDate || null,
    })
    .returning();

  if (!product) throw new Error('Failed to create product');

  invalidateStoreCache(storeId);
  recordActivity({
    userId: actorId,
    storeId,
    action: 'product.created',
    entityType: 'product',
    entityId: product.id,
    details: { name: product.name, sku: product.sku },
  });

  if (product.currentStock <= product.minStock) {
    await maybeNotifyLowStock(storeId, [product]);
  }

  return product;
}

export async function updateProduct(
  storeId: string,
  productId: string,
  input: UpdateInput,
  actorId: string,
): Promise<ProductRow> {
  await getProduct(storeId, productId);

  const [product] = await getDb()
    .update(products)
    .set({
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category || null } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.price !== undefined ? { price: input.price.toFixed(2) } : {}),
      ...(input.cost !== undefined ? { cost: input.cost.toFixed(2) } : {}),
      ...(input.currentStock !== undefined ? { currentStock: input.currentStock } : {}),
      ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
      ...(input.maxStock !== undefined ? { maxStock: input.maxStock } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.barcode !== undefined ? { barcode: input.barcode || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(input.expiryDate !== undefined ? { expiryDate: input.expiryDate || null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(products.storeId, storeId), eq(products.id, productId)))
    .returning();

  if (!product) throw notFound('Product not found');

  invalidateStoreCache(storeId);
  recordActivity({
    userId: actorId,
    storeId,
    action: 'product.updated',
    entityType: 'product',
    entityId: productId,
    details: { fields: Object.keys(input) },
  });

  return product;
}

export async function archiveProduct(
  storeId: string,
  productId: string,
  actorId: string,
): Promise<void> {
  await getProduct(storeId, productId);
  await getDb()
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(products.storeId, storeId), eq(products.id, productId)));

  invalidateStoreCache(storeId);
  recordActivity({
    userId: actorId,
    storeId,
    action: 'product.archived',
    entityType: 'product',
    entityId: productId,
  });
}

export async function adjustStock(
  storeId: string,
  productId: string,
  input: { quantityChange: number; reason: string; notes?: string },
  actorId: string,
): Promise<{ product: ProductRow; newStock: number; adjustmentId: string }> {
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.id, productId)))
      .for('update')
      .limit(1);

    if (!existing) throw notFound('Product not found');

    const newStock = existing.currentStock + input.quantityChange;
    if (newStock < 0) {
      throw badRequest(`Insufficient stock: product currently has ${existing.currentStock} units`);
    }

    const [updated] = await tx
      .update(products)
      .set({ currentStock: newStock, updatedAt: new Date() })
      .where(eq(products.id, productId))
      .returning();

    if (!updated) throw new Error('Failed to update stock');

    const [adjustment] = await tx
      .insert(inventoryAdjustments)
      .values({
        productId,
        storeId,
        adjustedBy: actorId,
        oldQuantity: existing.currentStock,
        newQuantity: newStock,
        quantityChanged: input.quantityChange,
        reason: input.reason as 'purchase' | 'loss' | 'damage' | 'correction' | 'return',
        notes: input.notes || null,
      })
      .returning();

    if (!adjustment) throw new Error('Failed to record adjustment');

    return { product: updated, oldStock: existing.currentStock, adjustmentId: adjustment.id };
  });

  invalidateStoreCache(storeId);
  emitToStore(storeId, 'inventory:updated', {
    productId,
    currentStock: result.product.currentStock,
    previousStock: result.oldStock,
    reason: input.reason,
  });

  recordActivity({
    userId: actorId,
    storeId,
    action: 'inventory.adjusted',
    entityType: 'product',
    entityId: productId,
    details: { quantityChange: input.quantityChange, reason: input.reason },
  });

  if (result.product.currentStock <= result.product.minStock) {
    await maybeNotifyLowStock(storeId, [result.product]);
  }

  return {
    product: result.product,
    newStock: result.product.currentStock,
    adjustmentId: result.adjustmentId,
  };
}

export async function listAdjustments(
  storeId: string,
  options: {
    page: number;
    limit: number;
    productId?: string;
    reason?: string;
  },
): Promise<{
  adjustments: Array<typeof inventoryAdjustments.$inferSelect & { productName: string | null }>;
  total: number;
}> {
  const conditions: SQL[] = [eq(inventoryAdjustments.storeId, storeId)];
  if (options.productId) conditions.push(eq(inventoryAdjustments.productId, options.productId));
  if (options.reason) {
    conditions.push(
      eq(
        inventoryAdjustments.reason,
        options.reason as (typeof inventoryAdjustments.reason.enumValues)[number],
      ),
    );
  }
  const where = and(...conditions);
  const db = getDb();

  const [rows, totals] = await Promise.all([
    db
      .select({ adjustment: inventoryAdjustments, productName: products.name })
      .from(inventoryAdjustments)
      .leftJoin(products, eq(products.id, inventoryAdjustments.productId))
      .where(where)
      .orderBy(desc(inventoryAdjustments.createdAt))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(inventoryAdjustments)
      .where(where),
  ]);

  return {
    adjustments: rows.map((row) => ({ ...row.adjustment, productName: row.productName })),
    total: totals[0]?.total ?? 0,
  };
}

export async function listLowStock(storeId: string): Promise<ProductRow[]> {
  return getDb()
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.isActive, true),
        sql`${products.currentStock} <= ${products.minStock}`,
      ),
    )
    .orderBy(asc(products.currentStock));
}

export async function inventorySummary(storeId: string): Promise<{
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValue: string;
  potentialRevenue: string;
}> {
  const [row] = await getDb()
    .select({
      totalProducts: sql<number>`count(*)::int`,
      activeProducts: sql<number>`count(*) filter (where ${products.isActive})::int`,
      lowStockCount: sql<number>`count(*) filter (where ${products.currentStock} <= ${products.minStock} and ${products.isActive})::int`,
      outOfStockCount: sql<number>`count(*) filter (where ${products.currentStock} = 0 and ${products.isActive})::int`,
      inventoryValue: sql<string>`coalesce(sum(${products.currentStock} * coalesce(${products.cost}, 0)), 0)::text`,
      potentialRevenue: sql<string>`coalesce(sum(${products.currentStock} * ${products.price}), 0)::text`,
    })
    .from(products)
    .where(eq(products.storeId, storeId));

  return (
    row ?? {
      totalProducts: 0,
      activeProducts: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      inventoryValue: '0',
      potentialRevenue: '0',
    }
  );
}

export async function maybeNotifyLowStock(storeId: string, list: ProductRow[]): Promise<void> {
  if (list.length === 0) return;
  const db = getDb();
  const [store] = await db
    .select({ name: stores.name, settings: stores.settings, ownerEmail: users.email })
    .from(stores)
    .innerJoin(users, eq(users.id, stores.ownerId))
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!store) return;

  const recipients = await getStoreAlertRecipients(storeId);
  if (recipients.length === 0) return;

  await notifyUsers(recipients, {
    storeId,
    type: 'low_stock',
    title: `Low stock: ${list[0]?.name ?? 'product'}${list.length > 1 ? ` +${list.length - 1} more` : ''}`,
    message: list
      .map(
        (product) =>
          `${product.name} has ${product.currentStock} ${product.unit} left (min ${product.minStock}).`,
      )
      .join(' '),
    actionUrl: '/inventory?lowStock=true',
  });

  if (store.settings.lowStockEmails && store.ownerEmail) {
    void sendLowStockEmail(
      store.ownerEmail,
      store.name,
      list.map((product) => ({
        name: product.name,
        currentStock: product.currentStock,
        minStock: product.minStock,
      })),
    );
  }
}

/* ─────────────────────────── CSV import / export ─────────────────────────── */

export interface ImportResult {
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export async function importProductsCsv(
  storeId: string,
  csvText: string,
  actorId: string,
): Promise<ImportResult> {
  const records = parseCsvObjects(csvText);
  if (records.length === 0) throw badRequest('CSV file is empty or missing a header row');
  if (records.length > 5000) throw badRequest('CSV import is limited to 5000 rows per file');

  const db = getDb();
  const errors: ImportResult['errors'] = [];
  let imported = 0;
  let updated = 0;

  const existing = await db
    .select({ sku: products.sku })
    .from(products)
    .where(eq(products.storeId, storeId));
  const existingSkus = new Set(existing.map((row) => row.sku.toLowerCase()));

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    try {
      const candidate = {
        sku: record.sku ?? record['product code'] ?? '',
        name: record.name ?? record.title ?? '',
        category: record.category || undefined,
        description: record.description || undefined,
        price: record.price,
        cost: record.cost || undefined,
        currentStock: record.stock || record.current_stock || record.quantity || '0',
        minStock: record.min_stock || record.minstock || '10',
        maxStock: record.max_stock || record.maxstock || '1000',
        unit: record.unit || 'pcs',
        barcode: record.barcode || undefined,
        expiryDate: record.expiry_date || record.expirydate || undefined,
      };

      const parsed = createProductSchema.safeParse(candidate);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        errors.push({ row: rowNumber, message: `${first?.path.join('.')}: ${first?.message}` });
        continue;
      }

      const values = parsed.data;
      const isUpdate = existingSkus.has(values.sku.toLowerCase());

      if (isUpdate) {
        await db
          .update(products)
          .set({
            name: values.name,
            category: values.category || null,
            description: values.description || null,
            price: values.price.toFixed(2),
            cost: values.cost !== undefined ? values.cost.toFixed(2) : null,
            currentStock: values.currentStock,
            minStock: values.minStock,
            maxStock: values.maxStock,
            unit: values.unit,
            barcode: values.barcode || null,
            expiryDate: values.expiryDate || null,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(and(eq(products.storeId, storeId), eq(products.sku, values.sku)));
        updated += 1;
      } else {
        await db.insert(products).values({
          storeId,
          sku: values.sku,
          name: values.name,
          category: values.category || null,
          description: values.description || null,
          price: values.price.toFixed(2),
          cost: values.cost !== undefined ? values.cost.toFixed(2) : null,
          currentStock: values.currentStock,
          minStock: values.minStock,
          maxStock: values.maxStock,
          unit: values.unit,
          barcode: values.barcode || null,
          expiryDate: values.expiryDate || null,
        });
        existingSkus.add(values.sku.toLowerCase());
        imported += 1;
      }
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Unexpected error',
      });
    }
  }

  invalidateStoreCache(storeId);
  recordActivity({
    userId: actorId,
    storeId,
    action: 'inventory.imported',
    entityType: 'product',
    details: { imported, updated, failed: errors.length },
  });

  return { imported, updated, failed: errors.length, errors: errors.slice(0, 50) };
}

export async function exportProductsCsv(storeId: string): Promise<string> {
  const rows = await getDb()
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isActive, true)))
    .orderBy(asc(products.name));

  return toCsv(
    rows.map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category ?? '',
      price: product.price,
      cost: product.cost ?? '',
      stock: product.currentStock,
      min_stock: product.minStock,
      max_stock: product.maxStock,
      unit: product.unit,
      barcode: product.barcode ?? '',
      expiry_date: product.expiryDate ?? '',
    })),
    [
      'sku',
      'name',
      'category',
      'price',
      'cost',
      'stock',
      'min_stock',
      'max_stock',
      'unit',
      'barcode',
      'expiry_date',
    ],
  );
}

export const productImportTemplate = (): string =>
  toCsv(
    [
      {
        sku: 'COF-001',
        name: 'Espresso Beans 1kg',
        category: 'Coffee',
        price: '18.90',
        cost: '11.20',
        stock: '40',
        min_stock: '10',
        max_stock: '200',
        unit: 'pcs',
        barcode: '4001234567890',
        expiry_date: '2027-01-31',
      },
    ],
    [
      'sku',
      'name',
      'category',
      'price',
      'cost',
      'stock',
      'min_stock',
      'max_stock',
      'unit',
      'barcode',
      'expiry_date',
    ],
  );

export async function findByBarcode(storeId: string, barcode: string): Promise<ProductRow | null> {
  const [product] = await getDb()
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.barcode, barcode),
        eq(products.isActive, true),
      ),
    )
    .limit(1);
  return product ?? null;
}

export async function productsForSale(storeId: string, ids: string[]): Promise<ProductRow[]> {
  return getDb()
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), inArray(products.id, ids)));
}
