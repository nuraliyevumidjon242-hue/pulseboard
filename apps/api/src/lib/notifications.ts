import { and, eq, inArray, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import { notifications, storeUsers, stores } from '../db/schema';
import { logger } from './logger';
import { emitToUser } from '../realtime/bus';

export interface NotificationInput {
  storeId?: string | null;
  type: 'low_stock' | 'high_sales' | 'system' | 'alert';
  title: string;
  message?: string;
  actionUrl?: string;
}

/** Inserts a notification per recipient and pushes it over WebSocket. */
export async function notifyUsers(userIds: string[], input: NotificationInput): Promise<void> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;

  try {
    const rows = await getDb()
      .insert(notifications)
      .values(
        uniqueIds.map((userId) => ({
          userId,
          storeId: input.storeId ?? null,
          type: input.type,
          title: input.title,
          message: input.message,
          actionUrl: input.actionUrl,
        })),
      )
      .returning();

    for (const row of rows) {
      emitToUser(row.userId, 'notification:new', row);
    }
  } catch (error) {
    logger.warn({ err: error }, 'Failed to create notifications');
  }
}

/** Owner + store admins/managers — the people responsible for stock. */
export async function getStoreAlertRecipients(storeId: string): Promise<string[]> {
  const db = getDb();
  const [store] = await db
    .select({ ownerId: stores.ownerId })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  const managers = await db
    .select({ userId: storeUsers.userId })
    .from(storeUsers)
    .where(
      and(
        eq(storeUsers.storeId, storeId),
        or(eq(storeUsers.role, 'admin'), eq(storeUsers.role, 'manager')),
      ),
    );

  return [...new Set([...(store ? [store.ownerId] : []), ...managers.map((m) => m.userId)])];
}

export async function markNotificationsRead(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const updated = await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)))
    .returning({ id: notifications.id });
  return updated.length;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const updated = await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .returning({ id: notifications.id });
  return updated.length;
}
