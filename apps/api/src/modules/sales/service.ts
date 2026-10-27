import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { getDb, getRawQuery } from '../../db/client';
import {
  inventoryAdjustments,
  products,
  saleItems,
  sales,
  users,
  type SaleItemRow,
  type SaleRow,
  type StoreRow,
} from '../../db/schema';
import { recordActivity } from '../../lib/activity';
import { invalidateStoreCache } from '../../lib/cache';
import { buildTransactionId } from '../../lib/crypto';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { fromCents, formatMoney, percentageChange, toCents } from '../../lib/money';
import { notifyUsers, getStoreAlertRecipients } from '../../lib/notifications';
import { addDays, dateKeysBetween, startOfDayInTimeZone, toDateKey } from '../../lib/time';
import { emitToStore } from '../../realtime/bus';
import type { CreateSaleInput, SaleListQuery } from './schemas';

export interface SaleWithItems extends SaleRow {
  items: SaleItemRow[];
  cashierName: string | null;
}

export interface RangeSummary {
  revenue: string;
  transactions: number;
  itemsSold: number;
  avgTransaction: string;
}

export interface SummaryComparison extends RangeSummary {
  revenueChange: number | null;
  transactionsChange: number | null;
  avgTransactionChange: number | null;
}

export const emptySummary: RangeSummary = {
  revenue: '0.00',
  transactions: 0,
  itemsSold: 0,
  avgTransaction: '0.00',
};

async function summaryForRange(storeId: string, from: Date, to: Date): Promise<RangeSummary> {
  const { rows } = await getRawQuery()<{
    revenue: string;
    transactions: number;
    items_sold: number;
  }>(
    `
      SELECT
        coalesce(sum(s.final_amount), 0)::text AS revenue,
        count(*)::int AS transactions,
        coalesce((
          SELECT sum(si.quantity)
          FROM sale_items si
          JOIN sales s2 ON s2.id = si.sale_id
          WHERE s2.store_id = $1 AND s2.created_at >= $2 AND s2.created_at < $3
        ), 0)::int AS items_sold
      FROM sales s
      WHERE s.store_id = $1 AND s.created_at >= $2 AND s.created_at < $3
    `,
    [storeId, from.toISOString(), to.toISOString()],
  );

  const row = rows[0];
  const transactions = row?.transactions ?? 0;
  // PostgreSQL `coalesce(sum(numeric), 0)::text` yields `"0"` for empty
  // ranges, while the rest of the API always exposes two decimal places.
  const revenue = Number(row?.revenue ?? 0).toFixed(2);
  return {
    revenue,
    transactions,
    itemsSold: row?.items_sold ?? 0,
    avgTransaction: transactions > 0 ? (Number(revenue) / transactions).toFixed(2) : '0.00',
  };
}

export function toSummaryComparison(
  current: RangeSummary,
  previous: RangeSummary,
): SummaryComparison {
  return {
    ...current,
    revenueChange: percentageChange(Number(current.revenue), Number(previous.revenue)),
    transactionsChange: percentageChange(current.transactions, previous.transactions),
    avgTransactionChange: percentageChange(
      Number(current.avgTransaction),
      Number(previous.avgTransaction),
    ),
  };
}

export async function createSale(
  store: StoreRow,
  cashierId: string,
  input: CreateSaleInput,
): Promise<{
  sale: SaleWithItems;
  totals: { totalAmount: string; discount: string; finalAmount: string };
  receipt: {
    storeName: string;
    address: string | null;
    currency: string;
    transactionId: string;
    cashierName: string | null;
    createdAt: Date;
  };
}> {
  const db = getDb();
  const productIds = input.items.map((item) => item.productId);

  if (new Set(productIds).size !== productIds.length) {
    throw badRequest('Duplicate products in sale — combine quantities into one line');
  }

  const productRows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, store.id),
        inArray(products.id, productIds),
        eq(products.isActive, true),
      ),
    );

  const productById = new Map(productRows.map((product) => [product.id, product]));

  const missing = productIds.filter((id) => !productById.has(id));
  if (missing.length > 0) {
    throw badRequest('One or more products are unavailable', { productIds: missing });
  }

  let totalCents = 0;
  const lines = input.items.map((item) => {
    const product = productById.get(item.productId)!;
    if (product.currentStock < item.quantity) {
      throw conflict(
        `Insufficient stock for ${product.name}: ${product.currentStock} available, ${item.quantity} requested`,
        {
          productId: product.id,
          available: product.currentStock,
        },
      );
    }
    const unitCents = toCents(product.price);
    const subtotalCents = unitCents * item.quantity;
    totalCents += subtotalCents;
    return {
      product,
      quantity: item.quantity,
      unitPrice: product.price,
      subtotalCents,
      subtotal: fromCents(subtotalCents),
      unitCost: product.cost,
    };
  });

  const discountCents = toCents(input.discount);
  if (discountCents > totalCents) {
    throw badRequest('Discount cannot exceed the sale total');
  }

  const finalCents = totalCents - discountCents;
  const transactionId = buildTransactionId(store.settings.receiptPrefix || 'TXN');

  const result = await db.transaction(async (tx) => {
    const [sale] = await tx
      .insert(sales)
      .values({
        storeId: store.id,
        cashierId,
        transactionId,
        totalAmount: fromCents(totalCents),
        discount: fromCents(discountCents),
        finalAmount: fromCents(finalCents),
        paymentMethod: input.paymentMethod,
        customerName: input.customerName || null,
        notes: input.notes || null,
      })
      .returning();

    if (!sale) throw new Error('Failed to create sale');

    const insertedItems: SaleItemRow[] = [];
    for (const line of lines) {
      const [item] = await tx
        .insert(saleItems)
        .values({
          saleId: sale.id,
          productId: line.product.id,
          productName: line.product.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
          subtotal: line.subtotal,
        })
        .returning();

      if (!item) throw new Error('Failed to create sale item');
      insertedItems.push(item);

      const [updated] = await tx
        .update(products)
        .set({
          currentStock: sql`${products.currentStock} - ${line.quantity}`,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, line.product.id), gte(products.currentStock, line.quantity)))
        .returning();

      if (!updated) {
        throw conflict(`Stock changed while completing the sale for ${line.product.name}`);
      }

      await tx.insert(inventoryAdjustments).values({
        productId: line.product.id,
        storeId: store.id,
        adjustedBy: cashierId,
        oldQuantity: updated.currentStock + line.quantity,
        newQuantity: updated.currentStock,
        quantityChanged: -line.quantity,
        reason: 'sale',
        notes: `Sale ${transactionId}`,
      });
    }

    return { sale, items: insertedItems };
  });

  const [cashier] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, cashierId))
    .limit(1);

  const cashierName = cashier ? `${cashier.firstName} ${cashier.lastName}` : null;

  const saleWithItems: SaleWithItems = {
    ...result.sale,
    cashierName,
    items: result.items,
  };

  invalidateStoreCache(store.id);
  emitToStore(store.id, 'sale:created', {
    saleId: result.sale.id,
    transactionId,
    finalAmount: result.sale.finalAmount,
    totalAmount: result.sale.totalAmount,
    discount: result.sale.discount,
    paymentMethod: result.sale.paymentMethod,
    itemsCount: result.items.length,
    cashierName,
    createdAt: result.sale.createdAt,
  });

  recordActivity({
    userId: cashierId,
    storeId: store.id,
    action: 'sale.created',
    entityType: 'sale',
    entityId: result.sale.id,
    details: {
      transactionId,
      finalAmount: result.sale.finalAmount,
      paymentMethod: result.sale.paymentMethod,
      items: result.items.length,
    },
  });

  void checkMilestone(store, result.sale.finalAmount);
  void notifyIfLowStock(
    store.id,
    result.items
      .map((item) => item.productId)
      .filter((productId): productId is string => Boolean(productId)),
  );

  return {
    sale: saleWithItems,
    totals: {
      totalAmount: result.sale.totalAmount,
      discount: result.sale.discount,
      finalAmount: result.sale.finalAmount,
    },
    receipt: {
      storeName: store.name,
      address: store.address,
      currency: store.currency,
      transactionId,
      cashierName,
      createdAt: result.sale.createdAt,
    },
  };
}

async function checkMilestone(store: StoreRow, saleAmount: string): Promise<void> {
  const milestone = Number(store.settings.milestoneAmount ?? 0);
  if (milestone <= 0) return;

  const now = new Date();
  const start = startOfDayInTimeZone(store.timezone, now);
  const end = addDays(start, 1);
  const today = await summaryForRange(store.id, start, end);
  const revenue = Number(today.revenue);
  const previousRevenue = revenue - Number(saleAmount);

  if (previousRevenue < milestone && revenue >= milestone) {
    const recipients = await getStoreAlertRecipients(store.id);
    await notifyUsers(recipients, {
      storeId: store.id,
      type: 'high_sales',
      title: `Milestone reached: ${formatMoney(revenue, store.currency)} today`,
      message: `${store.name} just passed its daily target of ${formatMoney(
        milestone,
        store.currency,
      )}. Great work!`,
      actionUrl: '/dashboard',
    });
    emitToStore(store.id, 'milestone:reached', { milestone, revenue });
  }
}

async function notifyIfLowStock(storeId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const rows = await getDb()
    .select()
    .from(products)
    .where(
      and(inArray(products.id, productIds), sql`${products.currentStock} <= ${products.minStock}`),
    );
  if (rows.length === 0) return;

  const recipients = await getStoreAlertRecipients(storeId);
  await notifyUsers(recipients, {
    storeId,
    type: 'low_stock',
    title: `Low stock: ${rows[0]?.name ?? 'product'}${rows.length > 1 ? ` +${rows.length - 1} more` : ''}`,
    message: rows
      .map((product) => `${product.name} has ${product.currentStock} ${product.unit} left.`)
      .join(' '),
    actionUrl: '/inventory?lowStock=true',
  });
}

export async function listSales(
  storeId: string,
  options: SaleListQuery,
  timeZone: string,
): Promise<{ sales: SaleWithItems[]; total: number }> {
  const db = getDb();
  const conditions: SQL[] = [eq(sales.storeId, storeId)];

  if (options.from) {
    const start = startOfDayInTimeZone(timeZone, new Date(`${options.from}T12:00:00Z`));
    conditions.push(gte(sales.createdAt, start));
  }
  if (options.to) {
    const end = addDays(startOfDayInTimeZone(timeZone, new Date(`${options.to}T12:00:00Z`)), 1);
    conditions.push(lt(sales.createdAt, end));
  }
  if (options.paymentMethod) {
    conditions.push(eq(sales.paymentMethod, options.paymentMethod));
  }
  if (options.cashierId) {
    conditions.push(eq(sales.cashierId, options.cashierId));
  }
  if (options.search) {
    const term = `%${options.search}%`;
    const search = or(ilike(sales.transactionId, term), ilike(sales.customerName, term));
    if (search) conditions.push(search);
  }

  const where = and(...conditions);
  const orderBy = options.sortOrder === 'asc' ? asc(sales.createdAt) : desc(sales.createdAt);

  const [rows, totals] = await Promise.all([
    db
      .select({ sale: sales, firstName: users.firstName, lastName: users.lastName })
      .from(sales)
      .leftJoin(users, eq(users.id, sales.cashierId))
      .where(where)
      .orderBy(orderBy)
      .limit(options.limit)
      .offset((options.page - 1) * options.limit),
    db.select({ total: count() }).from(sales).where(where),
  ]);

  const ids = rows.map((row) => row.sale.id);
  const items = ids.length
    ? await db.select().from(saleItems).where(inArray(saleItems.saleId, ids))
    : [];

  const itemsBySale = new Map<string, SaleItemRow[]>();
  for (const item of items) {
    const list = itemsBySale.get(item.saleId) ?? [];
    list.push(item);
    itemsBySale.set(item.saleId, list);
  }

  return {
    sales: rows.map((row) => ({
      ...row.sale,
      cashierName: row.firstName ? `${row.firstName} ${row.lastName ?? ''}`.trim() : null,
      items: itemsBySale.get(row.sale.id) ?? [],
    })),
    total: Number(totals[0]?.total ?? 0),
  };
}

export async function getSale(storeId: string, saleId: string): Promise<SaleWithItems> {
  const db = getDb();
  const [row] = await db
    .select({ sale: sales, firstName: users.firstName, lastName: users.lastName })
    .from(sales)
    .leftJoin(users, eq(users.id, sales.cashierId))
    .where(and(eq(sales.storeId, storeId), eq(sales.id, saleId)))
    .limit(1);

  if (!row) throw notFound('Sale not found');

  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));

  return {
    ...row.sale,
    cashierName: row.firstName ? `${row.firstName} ${row.lastName ?? ''}`.trim() : null,
    items,
  };
}

export interface DailyStat {
  date: string;
  revenue: string;
  transactions: number;
  itemsSold: number;
  avgTransaction: string;
}

export async function dailyStats(
  store: StoreRow,
  days: number,
): Promise<{
  data: DailyStat[];
  totals: SummaryComparison;
  previous: RangeSummary;
  period: { from: string; to: string; days: number };
}> {
  const now = new Date();
  const start = startOfDayInTimeZone(store.timezone, addDays(now, -(days - 1)));
  const end = addDays(startOfDayInTimeZone(store.timezone, now), 1);
  const previousStart = addDays(start, -days);

  const { rows } = await getRawQuery()<{
    date: string;
    revenue: string;
    transactions: number;
    items_sold: number;
  }>(
    `
      SELECT
        to_char(date_trunc('day', s.created_at AT TIME ZONE $1), 'YYYY-MM-DD') AS date,
        coalesce(sum(s.final_amount), 0)::text AS revenue,
        count(*)::int AS transactions,
        coalesce(sum((
          SELECT sum(si.quantity) FROM sale_items si WHERE si.sale_id = s.id
        )), 0)::int AS items_sold
      FROM sales s
      WHERE s.store_id = $2 AND s.created_at >= $3 AND s.created_at < $4
      GROUP BY 1
      ORDER BY 1
    `,
    [store.timezone, store.id, start.toISOString(), end.toISOString()],
  );

  const byDate = new Map(rows.map((row) => [row.date, row]));
  const keys = dateKeysBetween(start, end, store.timezone).slice(0, days);

  const data: DailyStat[] = keys.map((date) => {
    const row = byDate.get(date);
    const revenue = row?.revenue ?? '0.00';
    const transactions = row?.transactions ?? 0;
    return {
      date,
      revenue,
      transactions,
      itemsSold: row?.items_sold ?? 0,
      avgTransaction: transactions > 0 ? (Number(revenue) / transactions).toFixed(2) : '0.00',
    };
  });

  const current = await summaryForRange(store.id, start, end);
  const previous = await summaryForRange(store.id, previousStart, start);
  const totals = toSummaryComparison(current, previous);

  return {
    data,
    totals,
    previous,
    period: {
      from: keys[0] ?? toDateKey(start, store.timezone),
      to: toDateKey(end, store.timezone),
      days,
    },
  };
}

export interface HourlyStat {
  hour: number;
  revenue: string;
  transactions: number;
}

export async function hourlyStats(
  store: StoreRow,
  dateKey?: string,
): Promise<{ date: string; data: HourlyStat[]; total: RangeSummary }> {
  const day = dateKey
    ? startOfDayInTimeZone(store.timezone, new Date(`${dateKey}T12:00:00Z`))
    : startOfDayInTimeZone(store.timezone, new Date());
  if (!day) throw badRequest('Invalid date');

  const end = addDays(day, 1);
  const { rows } = await getRawQuery()<{ hour: number; revenue: string; transactions: number }>(
    `
      SELECT
        extract(hour FROM s.created_at AT TIME ZONE $1)::int AS hour,
        coalesce(sum(s.final_amount), 0)::text AS revenue,
        count(*)::int AS transactions
      FROM sales s
      WHERE s.store_id = $2 AND s.created_at >= $3 AND s.created_at < $4
      GROUP BY 1
      ORDER BY 1
    `,
    [store.timezone, store.id, day.toISOString(), end.toISOString()],
  );

  const byHour = new Map(rows.map((row) => [row.hour, row]));
  const data: HourlyStat[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    revenue: byHour.get(hour)?.revenue ?? '0.00',
    transactions: byHour.get(hour)?.transactions ?? 0,
  }));

  const total = await summaryForRange(store.id, day, end);

  return { date: dateKey ?? toDateKey(day, store.timezone), data, total };
}

export async function paymentBreakdown(
  storeId: string,
  from: Date,
  to: Date,
): Promise<Array<{ method: string; amount: string; count: number; percentage: number }>> {
  const db = getDb();
  const rows = await db
    .select({
      method: sales.paymentMethod,
      amount: sql<string>`coalesce(sum(${sales.finalAmount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(and(eq(sales.storeId, storeId), gte(sales.createdAt, from), lt(sales.createdAt, to)))
    .groupBy(sales.paymentMethod);

  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  return rows
    .map((row) => ({
      method: row.method,
      amount: row.amount,
      count: row.count,
      percentage: total > 0 ? Number(((Number(row.amount) / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => Number(b.amount) - Number(a.amount));
}

export async function recentSales(storeId: string, limit = 8): Promise<SaleWithItems[]> {
  const db = getDb();
  const rows = await db
    .select({ sale: sales, firstName: users.firstName, lastName: users.lastName })
    .from(sales)
    .leftJoin(users, eq(users.id, sales.cashierId))
    .where(eq(sales.storeId, storeId))
    .orderBy(desc(sales.createdAt))
    .limit(limit);

  const ids = rows.map((row) => row.sale.id);
  const items = ids.length
    ? await db.select().from(saleItems).where(inArray(saleItems.saleId, ids))
    : [];
  const itemsBySale = new Map<string, SaleItemRow[]>();
  for (const item of items) {
    const list = itemsBySale.get(item.saleId) ?? [];
    list.push(item);
    itemsBySale.set(item.saleId, list);
  }

  return rows.map((row) => ({
    ...row.sale,
    cashierName: row.firstName ? `${row.firstName} ${row.lastName ?? ''}`.trim() : null,
    items: itemsBySale.get(row.sale.id) ?? [],
  }));
}

export { summaryForRange };
