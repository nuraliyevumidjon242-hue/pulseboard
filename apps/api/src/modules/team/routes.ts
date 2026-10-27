import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { sendData } from '../../lib/http';
import { authenticate, requireStorePermission } from '../../middleware/auth';
import { authLimiter, writeLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import {
  acceptInvitationSchema,
  activityQuerySchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from './schemas';
import {
  acceptInvitation,
  inviteMember,
  listActivity,
  listInvitations,
  listTeam,
  removeMember,
  updateMemberRole,
} from './service';
import { setRefreshCookie } from '../auth/cookies';

export const teamRouter = Router({ mergeParams: true });
teamRouter.use(authenticate);

teamRouter.get(
  '/',
  requireStorePermission('team:read'),
  asyncHandler(async (req, res) => {
    const members = await listTeam(req.storeAccess!.store);
    return res.status(200).json({ data: members, meta: { total: members.length } });
  }),
);

teamRouter.get(
  '/invitations',
  requireStorePermission('team:read'),
  asyncHandler(async (req, res) => {
    const invitations = await listInvitations(req.storeAccess!.store.id);
    return res.status(200).json({ data: invitations, meta: { total: invitations.length } });
  }),
);

teamRouter.post(
  '/invite',
  writeLimiter,
  requireStorePermission('team:manage'),
  validate(inviteMemberSchema),
  asyncHandler(async (req, res) => {
    const result = await inviteMember(req.storeAccess!.store, req.user!.id, req.body);
    return sendData(
      res,
      {
        ...result,
        message:
          result.status === 'added' ? 'Member added to the store' : 'Invitation sent successfully',
      },
      201,
    );
  }),
);

teamRouter.put(
  '/:userId/role',
  writeLimiter,
  requireStorePermission('team:manage'),
  validate(updateMemberRoleSchema),
  asyncHandler(async (req, res) => {
    await updateMemberRole(req.storeAccess!.store, req.params.userId, req.body.role, req.user!.id);
    return sendData(res, { message: 'Role updated' });
  }),
);

teamRouter.delete(
  '/:userId',
  writeLimiter,
  requireStorePermission('team:manage'),
  asyncHandler(async (req, res) => {
    await removeMember(req.storeAccess!.store, req.params.userId, req.user!.id);
    return sendData(res, { message: 'Member removed' });
  }),
);

/* ───────────────────────── Activity log ───────────────────────── */

export const activityRouter = Router({ mergeParams: true });
activityRouter.use(authenticate);

activityRouter.get(
  '/',
  requireStorePermission('activity:read'),
  asyncHandler(async (req, res) => {
    const options = activityQuerySchema.parse(req.query);
    const result = await listActivity(req.storeAccess!.store.id, options);
    const totalPages = Math.max(1, Math.ceil(result.total / options.limit));
    return res.status(200).json({
      data: result.entries,
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

/* ───────────────────────── Invitation acceptance (public) ───────────────────────── */

export const invitationsRouter = Router();

invitationsRouter.post(
  '/accept',
  authLimiter,
  validate(acceptInvitationSchema),
  asyncHandler(async (req, res) => {
    const result = await acceptInvitation(req.body, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });
    setRefreshCookie(res, result.tokens.refreshToken, true);
    return sendData(res, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
      storeId: result.storeId,
      storeName: result.storeName,
      role: result.role,
    });
  }),
);
