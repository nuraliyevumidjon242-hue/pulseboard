import { getDb } from '../db/client';
import { activityLogs } from '../db/schema';
import { logger } from './logger';

export interface ActivityInput {
  storeId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

/** Fire-and-forget audit trail write; never breaks the calling request. */
export function recordActivity(input: ActivityInput): void {
  void (async () => {
    try {
      await getDb()
        .insert(activityLogs)
        .values({
          storeId: input.storeId ?? null,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          details: input.details ?? null,
          ipAddress: input.ipAddress ?? null,
        });
    } catch (error) {
      logger.warn({ err: error }, 'Failed to persist activity log');
    }
  })();
}
