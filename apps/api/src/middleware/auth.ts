import { and, eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../db/client';
import { storeUsers, stores, users } from '../db/schema';
import { asyncHandler } from '../lib/async-handler';
import { forbidden, notFound, unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';
import {
  can,
  type GlobalRole,
  type Permission,
  type StoreRole,
} from '../modules/access/permissions';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) throw unauthorized('Missing bearer token');

  const payload = verifyAccessToken(token);
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!user) throw unauthorized('Account no longer exists');
  if (!user.isActive) throw forbidden('Account is deactivated');

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
});

export const requireRole =
  (...roles: GlobalRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role as GlobalRole)) {
      next(forbidden());
      return;
    }
    next();
  };

/**
 * Resolves :storeId, verifies membership and attaches the effective store role.
 * Requires `authenticate` to run first.
 */
export const requireStorePermission = (permission: Permission) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw unauthorized();
    const storeId = req.params.storeId;
    if (!storeId || !UUID_PATTERN.test(storeId)) throw notFound('Store not found');

    const db = getDb();
    const [store] = await db
      .select()
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.isActive, true)))
      .limit(1);

    if (!store) throw notFound('Store not found');

    const isOwner = store.ownerId === req.user.id;
    const isSuperAdmin = req.user.role === 'super_admin';

    // The membership role is authoritative for non-owners. Global roles only
    // describe the user's job title; they must not silently escalate access to
    // a store the person was invited to with fewer rights.
    let role: StoreRole = 'viewer';

    if (isOwner || isSuperAdmin) {
      role = 'admin';
    } else {
      const [membership] = await db
        .select({ role: storeUsers.role })
        .from(storeUsers)
        .where(and(eq(storeUsers.storeId, storeId), eq(storeUsers.userId, req.user.id)))
        .limit(1);

      if (!membership) {
        throw forbidden('You do not have access to this store');
      }

      role = membership.role as StoreRole;
    }

    if (isOwner || isSuperAdmin || can(role, permission)) {
      req.storeAccess = { store, role, isOwner };
      next();
      return;
    }

    throw forbidden(`Your role (${role}) cannot perform this action`);
  });

export const requireSuperAdmin = requireRole('super_admin');
