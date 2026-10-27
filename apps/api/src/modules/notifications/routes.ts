import { Router } from 'express';
import { z } from 'zod';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { asyncHandler } from '../../lib/async-handler';
import { sendData } from '../../lib/http';
import { optionalQueryBoolean } from '../../lib/query';
import { getDb } from '../../db/client';
import { notifications } from '../../db/schema';
import { authenticate } from '../../middleware/auth';
import { markAllNotificationsRead, markNotificationsRead } from '../../lib/notifications';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: optionalQueryBoolean,
});

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const options = listQuerySchema.parse(req.query);
    const conditions = options.unreadOnly
      ? and(eq(notifications.userId, req.user!.id), eq(notifications.isRead, false))
      : eq(notifications.userId, req.user!.id);

    const [rows, totals, unread] = await Promise.all([
      getDb()
        .select()
        .from(notifications)
        .where(conditions)
        .orderBy(desc(notifications.createdAt))
        .limit(options.limit)
        .offset((options.page - 1) * options.limit),
      getDb().select({ total: count() }).from(notifications).where(conditions),
      getDb()
        .select({ total: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, req.user!.id), eq(notifications.isRead, false))),
    ]);

    return res.status(200).json({
      data: rows,
      meta: {
        page: options.page,
        limit: options.limit,
        total: Number(totals[0]?.total ?? 0),
        unread: unread[0]?.total ?? 0,
      },
    });
  }),
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const [row] = await getDb()
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, req.user!.id), eq(notifications.isRead, false)));
    return sendData(res, { count: row?.total ?? 0 });
  }),
);

notificationsRouter.patch(
  '/read',
  asyncHandler(async (req, res) => {
    const { ids } = markReadSchema.parse(req.body);
    const updated = await markNotificationsRead(req.user!.id, ids);
    return sendData(res, { updated });
  }),
);

notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const updated = await markAllNotificationsRead(req.user!.id);
    return sendData(res, { updated });
  }),
);

notificationsRouter.delete(
  '/:notificationId',
  asyncHandler(async (req, res) => {
    await getDb()
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, req.params.notificationId),
          eq(notifications.userId, req.user!.id),
        ),
      );
    return sendData(res, { message: 'Notification deleted' });
  }),
);
