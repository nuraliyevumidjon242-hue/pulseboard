import { and, eq, isNull } from 'drizzle-orm';
import { env } from '../../config/env';
import { getDb } from '../../db/client';
import {
  dashboardPreferences,
  passwordResetTokens,
  refreshTokens,
  storeUsers,
  stores,
  users,
  type UserRow,
} from '../../db/schema';
import { recordActivity } from '../../lib/activity';
import { randomToken, sha256 } from '../../lib/crypto';
import { conflict, forbidden, notFound, unauthorized } from '../../lib/errors';
import { signAccessToken, accessTokenTtlSeconds } from '../../lib/jwt';
import { sendPasswordResetEmail } from '../../lib/mailer';
import { hashPassword, verifyPassword } from '../../lib/password';
import { listUserStores } from '../stores/store-access';
import type { LoginInput, RegisterInput, UpdateProfileInput } from './types';

export interface RequestMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresAt: Date;
  remember: boolean;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: Date;
}

export const toPublicUser = (user: UserRow): PublicUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  avatarUrl: user.avatarUrl,
  phone: user.phone,
  createdAt: user.createdAt,
});

const defaultStoreSettings = (currency: string) => ({
  milestoneAmount: currency === 'UZS' ? 1_000_000 : 1000,
  lowStockEmails: true,
  dataRetentionDays: 0,
  receiptPrefix: 'TXN',
});

export async function ensurePreferences(userId: string): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ id: dashboardPreferences.id })
    .from(dashboardPreferences)
    .where(eq(dashboardPreferences.userId, userId))
    .limit(1);

  if (!existing) {
    await db.insert(dashboardPreferences).values({ userId }).onConflictDoNothing();
  }
}

export async function issueTokens(
  user: { id: string; role: string },
  remember: boolean,
  meta: RequestMeta,
): Promise<TokenPair> {
  const refreshToken = randomToken(48);
  const days = remember ? env.REFRESH_TOKEN_TTL_DAYS : 1;
  const refreshExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await getDb()
    .insert(refreshTokens)
    .values({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt: refreshExpiresAt,
    });

  return {
    accessToken: signAccessToken(user.id, user.role),
    refreshToken,
    expiresIn: accessTokenTtlSeconds(),
    refreshExpiresAt,
    remember,
  };
}

export async function registerUser(
  input: RegisterInput,
  meta: RequestMeta,
): Promise<{ user: PublicUser; tokens: TokenPair; storeId: string }> {
  const db = getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing) throw conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const currency = input.currency ?? 'EUR';
  const timezone = input.timezone ?? 'Europe/Berlin';

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'business_owner',
      })
      .returning();

    if (!user) throw new Error('Failed to create user');

    const [store] = await tx
      .insert(stores)
      .values({
        ownerId: user.id,
        name: input.storeName ?? `${input.firstName}'s Store`,
        currency,
        timezone,
        settings: defaultStoreSettings(currency),
      })
      .returning();

    if (!store) throw new Error('Failed to create store');

    await tx.insert(storeUsers).values({ storeId: store.id, userId: user.id, role: 'admin' });
    await tx.insert(dashboardPreferences).values({ userId: user.id });

    return { user, store };
  });

  const tokens = await issueTokens(result.user, true, meta);

  recordActivity({
    userId: result.user.id,
    storeId: result.store.id,
    action: 'auth.register',
    entityType: 'user',
    entityId: result.user.id,
    ipAddress: meta.ipAddress,
  });

  return { user: toPublicUser(result.user), tokens, storeId: result.store.id };
}

export async function loginUser(
  input: LoginInput,
  meta: RequestMeta,
): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  // Constant-time-ish comparison path: always run bcrypt when a hash exists.
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !valid) throw unauthorized('Invalid email or password');
  if (!user.isActive) throw forbidden('Account is deactivated');

  const tokens = await issueTokens(user, input.rememberMe ?? false, meta);

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  recordActivity({
    userId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    ipAddress: meta.ipAddress,
  });

  return { user: toPublicUser(user), tokens };
}

export async function rotateRefreshToken(
  rawToken: string,
  meta: RequestMeta,
): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const db = getDb();
  const tokenHash = sha256(rawToken);

  const [session] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!session) throw unauthorized('Invalid refresh token');

  if (session.revokedAt) {
    // Token reuse indicates theft — invalidate every session for this user.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, session.userId), isNull(refreshTokens.revokedAt)));
    throw unauthorized('Refresh token has been revoked. Please sign in again.');
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, session.id));
    throw unauthorized('Refresh token has expired. Please sign in again.');
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) throw unauthorized('Account no longer exists');
  if (!user.isActive) throw forbidden('Account is deactivated');

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, session.id));

  const remember = session.expiresAt.getTime() - session.createdAt.getTime() > 2 * 86_400_000;
  const tokens = await issueTokens(user, remember, meta);

  return { user: toPublicUser(user), tokens };
}

export async function revokeRefreshToken(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await getDb()
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, sha256(rawToken)), isNull(refreshTokens.revokedAt)));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await getDb()
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

export async function requestPasswordReset(
  email: string,
  meta: RequestMeta,
): Promise<{ devToken?: string }> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Always return success to avoid account enumeration.
  if (!user) return {};

  const token = randomToken(32);
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  recordActivity({
    userId: user.id,
    action: 'auth.password_reset_requested',
    entityType: 'user',
    entityId: user.id,
    ipAddress: meta.ipAddress,
  });

  return env.NODE_ENV === 'production' ? {} : { devToken: token };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const db = getDb();
  const tokenHash = sha256(token);

  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw unauthorized('Password reset link is invalid or has expired');
  }

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record.id));
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, record.userId), isNull(refreshTokens.revokedAt)));
  });

  recordActivity({
    userId: record.userId,
    action: 'auth.password_reset',
    entityType: 'user',
    entityId: record.userId,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound('User not found');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw unauthorized('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

  recordActivity({
    userId,
    action: 'auth.password_changed',
    entityType: 'user',
    entityId: userId,
  });
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const db = getDb();
  const [user] = await db
    .update(users)
    .set({
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!user) throw notFound('User not found');
  return toPublicUser(user);
}

export async function getMe(userId: string): Promise<{
  user: PublicUser;
  stores: Awaited<ReturnType<typeof listUserStores>>;
  preferences: typeof dashboardPreferences.$inferSelect;
}> {
  const db = getDb();
  await ensurePreferences(userId);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound('User not found');

  const storeList = await listUserStores(user.id, user.role);
  const [preferences] = await db
    .select()
    .from(dashboardPreferences)
    .where(eq(dashboardPreferences.userId, userId))
    .limit(1);

  if (!preferences) throw new Error('Preferences missing after ensure');

  return { user: toPublicUser(user), stores: storeList, preferences };
}
