import { and, asc, count, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { products, sales, storeUsers, stores } from '../../db/schema';
import { forbidden, notFound } from '../../lib/errors';
import { startOfDayInTimeZone, addDays } from '../../lib/time';
import { recordActivity } from '../../lib/activity';
import { invalidateStoreCache } from '../../lib/cache';
import { permissionsFor, type StoreRole } from '../access/permissions';
import type { CreateStoreInput, UpdateStoreInput } from './schemas';
import { listUserStores, type UserStoreSummary } from './store-access';

export interface StoreMetrics {
  todayRevenue: string;
  todayTransactions: number;
  monthRevenue: string;
  lowStockCount: number;
}

export interface StoreWithMetrics extends UserStoreSummary {
  metrics: StoreMetrics;
  memberCount: number;
}

const emptyMetrics: StoreMetrics = {
  todayRevenue: '0.00',
  todayTransactions: 0,
  monthRevenue: '0.00',
  lowStockCount: 0,
};

async function metricsForStores(
  storeIds: string[],
  timeZones: Record<string, string>,
): Promise<Record<string, StoreMetrics>> {
  if (storeIds.length === 0) return {};
  const db = getDb();
  const now = new Date();
  const result: Record<string, StoreMetrics> = {};
  for (const id of storeIds) result[id] = { ...emptyMetrics };

  // Because each store has its own timezone we aggregate per store range.
  const todayRows = await db
    .select({
      storeId: sales.storeId,
      revenue: sql<string>`coalesce(sum(${sales.finalAmount}), 0)::text`,
      transactions: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(
      and(
        inArray(sales.storeId, storeIds),
        or(
          ...storeIds.map((id) =>
            and(
              eq(sales.storeId, id),
              gte(sales.createdAt, startOfDayInTimeZone(timeZones[id] ?? 'UTC', now)),
              lt(sales.createdAt, addDays(startOfDayInTimeZone(timeZones[id] ?? 'UTC', now), 1)),
            ),
          ),
        ),
      ),
    )
    .groupBy(sales.storeId);

  const monthRows = await db
    .select({
      storeId: sales.storeId,
      revenue: sql<string>`coalesce(sum(${sales.finalAmount}), 0)::text`,
    })
    .from(sales)
    .where(
      and(
        inArray(sales.storeId, storeIds),
        or(
          ...storeIds.map((id) =>
            and(
              eq(sales.storeId, id),
              gte(sales.createdAt, startOfDayInTimeZone(timeZones[id] ?? 'UTC', addDays(now, -29))),
            ),
          ),
        ),
      ),
    )
    .groupBy(sales.storeId);

  const lowStockRows = await db
    .select({ storeId: products.storeId, total: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        inArray(products.storeId, storeIds),
        eq(products.isActive, true),
        sql`${products.currentStock} <= ${products.minStock}`,
      ),
    )
    .groupBy(products.storeId);

  for (const row of todayRows) {
    const metrics = result[row.storeId];
    if (metrics) {
      metrics.todayRevenue = row.revenue;
      metrics.todayTransactions = row.transactions;
    }
  }
  for (const row of monthRows) {
    const metrics = result[row.storeId];
    if (metrics) metrics.monthRevenue = row.revenue;
  }
  for (const row of lowStockRows) {
    const metrics = result[row.storeId];
    if (metrics) metrics.lowStockCount = row.total;
  }

  return result;
}

export async function listStoresWithMetrics(
  userId: string,
  globalRole: string,
  options: { search?: string; page: number; limit: number; includeInactive?: boolean },
): Promise<{ stores: StoreWithMetrics[]; total: number }> {
  let accessible = await listUserStores(userId, globalRole);

  if (options.search) {
    const term = options.search.toLowerCase();
    accessible = accessible.filter(
      (store) =>
        store.name.toLowerCase().includes(term) || (store.city ?? '').toLowerCase().includes(term),
    );
  }

  if (!options.includeInactive) {
    accessible = accessible.filter((store) => store.isActive);
  }

  const total = accessible.length;
  const pageItems = accessible.slice(
    (options.page - 1) * options.limit,
    options.page * options.limit,
  );

  const timeZones = Object.fromEntries(accessible.map((store) => [store.id, store.timezone]));
  const metrics = await metricsForStores(
    pageItems.map((store) => store.id),
    timeZones,
  );

  const memberCounts = await getDb()
    .select({ storeId: storeUsers.storeId, total: sql<number>`count(*)::int` })
    .from(storeUsers)
    .where(
      inArray(
        storeUsers.storeId,
        pageItems.map((store) => store.id),
      ),
    )
    .groupBy(storeUsers.storeId);

  const memberCountByStore = Object.fromEntries(
    memberCounts.map((row) => [row.storeId, row.total]),
  );

  return {
    stores: pageItems.map((store) => ({
      ...store,
      metrics: metrics[store.id] ?? { ...emptyMetrics },
      memberCount: memberCountByStore[store.id] ?? 1,
    })),
    total,
  };
}

export async function createStore(
  ownerId: string,
  input: CreateStoreInput,
): Promise<typeof stores.$inferSelect> {
  const db = getDb();

  const [store] = await db
    .insert(stores)
    .values({
      ownerId,
      name: input.name,
      address: input.address,
      city: input.city,
      country: input.country,
      timezone: input.timezone,
      currency: input.currency,
      logoUrl: input.logoUrl || null,
      phone: input.phone,
      email: input.email || null,
      description: input.description,
      settings: {
        milestoneAmount:
          input.settings?.milestoneAmount ?? (input.currency === 'UZS' ? 1_000_000 : 1000),
        lowStockEmails: input.settings?.lowStockEmails ?? true,
        dataRetentionDays: input.settings?.dataRetentionDays ?? 0,
        receiptPrefix: input.settings?.receiptPrefix ?? 'TXN',
      },
    })
    .returning();

  if (!store) throw new Error('Failed to create store');

  await db.insert(storeUsers).values({ storeId: store.id, userId: ownerId, role: 'admin' });

  recordActivity({
    userId: ownerId,
    storeId: store.id,
    action: 'store.created',
    entityType: 'store',
    entityId: store.id,
    details: { name: store.name },
  });

  return store;
}

export async function getStoreDetails(
  storeId: string,
  role: StoreRole,
): Promise<{
  store: typeof stores.$inferSelect;
  metrics: StoreMetrics;
  memberCount: number;
  permissions: string[];
}> {
  const db = getDb();
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) throw notFound('Store not found');

  const metrics = await metricsForStores([storeId], { [storeId]: store.timezone });
  const [members] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(storeUsers)
    .where(eq(storeUsers.storeId, storeId));

  return {
    store,
    metrics: metrics[storeId] ?? { ...emptyMetrics },
    memberCount: members?.total ?? 0,
    permissions: permissionsFor(role),
  };
}

export async function updateStore(
  storeId: string,
  input: UpdateStoreInput,
  actorId: string,
): Promise<typeof stores.$inferSelect> {
  const db = getDb();
  const [existing] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!existing) throw notFound('Store not found');

  const [store] = await db
    .update(stores)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.settings !== undefined
        ? { settings: { ...existing.settings, ...input.settings } }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId))
    .returning();

  if (!store) throw notFound('Store not found');

  invalidateStoreCache(storeId);
  recordActivity({
    userId: actorId,
    storeId,
    action: 'store.updated',
    entityType: 'store',
    entityId: storeId,
    details: { fields: Object.keys(input) },
  });

  return store;
}

export async function deleteStore(storeId: string, actorId: string): Promise<void> {
  const db = getDb();
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) throw notFound('Store not found');
  if (store.ownerId !== actorId) throw forbidden('Only the store owner can delete this store');

  await db.delete(stores).where(eq(stores.id, storeId));
  recordActivity({
    userId: actorId,
    action: 'store.deleted',
    entityType: 'store',
    entityId: storeId,
    details: { name: store.name },
  });
}

export interface StoreComparison {
  storeId: string;
  name: string;
  city: string | null;
  currency: string;
  revenueToday: string;
  revenue30d: string;
  transactions30d: number;
  avgTransaction30d: string;
  lowStockCount: number;
}

export async function compareStores(
  userId: string,
  globalRole: string,
): Promise<StoreComparison[]> {
  const accessible = (await listUserStores(userId, globalRole)).filter((store) => store.isActive);
  if (accessible.length === 0) return [];

  const db = getDb();
  const ids = accessible.map((store) => store.id);
  const now = new Date();
  const timeZones = Object.fromEntries(accessible.map((store) => [store.id, store.timezone]));
  const todayMetrics = await metricsForStores(ids, timeZones);

  const rows = await db
    .select({
      storeId: sales.storeId,
      revenue: sql<string>`coalesce(sum(${sales.finalAmount}), 0)::text`,
      transactions: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(
      and(
        inArray(sales.storeId, ids),
        gte(sales.createdAt, startOfDayInTimeZone('UTC', addDays(now, -30))),
      ),
    )
    .groupBy(sales.storeId);

  const rowByStore = Object.fromEntries(rows.map((row) => [row.storeId, row]));

  return accessible.map((store) => {
    const row = rowByStore[store.id];
    const revenue = row?.revenue ?? '0.00';
    const transactions = row?.transactions ?? 0;
    const metrics = todayMetrics[store.id] ?? emptyMetrics;
    return {
      storeId: store.id,
      name: store.name,
      city: store.city,
      currency: store.currency,
      revenueToday: metrics.todayRevenue,
      revenue30d: revenue,
      transactions30d: transactions,
      avgTransaction30d: transactions > 0 ? (Number(revenue) / transactions).toFixed(2) : '0.00',
      lowStockCount: metrics.lowStockCount,
    };
  });
}

export async function getStoreOrThrow(storeId: string): Promise<typeof stores.$inferSelect> {
  const [store] = await getDb().select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) throw notFound('Store not found');
  return store;
}

export const storeMemberCount = async (storeId: string): Promise<number> => {
  const [row] = await getDb()
    .select({ total: count() })
    .from(storeUsers)
    .where(eq(storeUsers.storeId, storeId));
  return Number(row?.total ?? 0);
};

export const searchStores = async (term: string): Promise<Array<typeof stores.$inferSelect>> =>
  getDb()
    .select()
    .from(stores)
    .where(or(ilike(stores.name, `%${term}%`), ilike(stores.city, `%${term}%`)))
    .orderBy(asc(stores.name))
    .limit(20);
