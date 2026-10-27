import { and, eq, or } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { storeUsers, stores } from '../../db/schema';
import type { StoreRole } from '../access/permissions';

export interface UserStoreSummary {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  isActive: boolean;
  role: StoreRole;
  isOwner: boolean;
}

export async function listUserStores(
  userId: string,
  globalRole: string,
): Promise<UserStoreSummary[]> {
  const db = getDb();

  if (globalRole === 'super_admin') {
    const rows = await db.select().from(stores).orderBy(stores.createdAt);
    return rows.map((store) => ({
      id: store.id,
      name: store.name,
      city: store.city,
      country: store.country,
      currency: store.currency,
      timezone: store.timezone,
      logoUrl: store.logoUrl,
      isActive: store.isActive,
      role: 'admin' as StoreRole,
      isOwner: store.ownerId === userId,
    }));
  }

  const rows = await db
    .select({
      store: stores,
      membershipRole: storeUsers.role,
    })
    .from(stores)
    .leftJoin(storeUsers, and(eq(storeUsers.storeId, stores.id), eq(storeUsers.userId, userId)))
    .where(or(eq(stores.ownerId, userId), eq(storeUsers.userId, userId)))
    .orderBy(stores.createdAt);

  return rows.map(({ store, membershipRole }) => {
    const isOwner = store.ownerId === userId;
    return {
      id: store.id,
      name: store.name,
      city: store.city,
      country: store.country,
      currency: store.currency,
      timezone: store.timezone,
      logoUrl: store.logoUrl,
      isActive: store.isActive,
      role: (isOwner ? 'admin' : (membershipRole ?? 'viewer')) as StoreRole,
      isOwner,
    };
  });
}
