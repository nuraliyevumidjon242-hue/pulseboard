import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { sendData } from '../../lib/http';
import { getDb } from '../../db/client';
import { dashboardPreferences } from '../../db/schema';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ensurePreferences } from '../auth/service';

const widgetSchema = z.object({
  id: z.string().min(1).max(50),
  visible: z.boolean(),
  order: z.number().int().min(0).max(100),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['en', 'de', 'uz']).optional(),
  widgetsOrder: z.array(widgetSchema).max(50).optional(),
  visibleMetrics: z.array(z.string().max(50)).max(50).optional(),
  autoRefreshInterval: z
    .union([z.literal(0), z.literal(15), z.literal(30), z.literal(60), z.literal(300)])
    .optional(),
  notificationsEnabled: z.boolean().optional(),
});

export const preferencesRouter = Router();
preferencesRouter.use(authenticate);

preferencesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    await ensurePreferences(req.user!.id);
    const [preferences] = await getDb()
      .select()
      .from(dashboardPreferences)
      .where(eq(dashboardPreferences.userId, req.user!.id))
      .limit(1);
    return sendData(res, { preferences });
  }),
);

preferencesRouter.put(
  '/',
  validate(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    await ensurePreferences(req.user!.id);
    const [preferences] = await getDb()
      .update(dashboardPreferences)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(dashboardPreferences.userId, req.user!.id))
      .returning();
    return sendData(res, { preferences });
  }),
);
