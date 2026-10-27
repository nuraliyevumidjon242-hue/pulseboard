import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { env } from '../../config/env';
import { getDb } from '../../db/client';
import {
  activityLogs,
  dashboardPreferences,
  invitations,
  refreshTokens,
  storeUsers,
  stores,
  users,
  type StoreRow,
  type UserRow,
} from '../../db/schema';
import { recordActivity } from '../../lib/activity';
import { randomToken, sha256 } from '../../lib/crypto';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../lib/errors';
import { sendInvitationEmail } from '../../lib/mailer';
import { hashPassword, verifyPassword } from '../../lib/password';
import { notifyUsers } from '../../lib/notifications';
import {
  issueTokens,
  toPublicUser,
  type PublicUser,
  type RequestMeta,
  type TokenPair,
} from '../auth/service';

export interface TeamMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  isOwner: boolean;
  assignedAt: Date;
  lastLoginAt: Date | null;
}

export async function listTeam(store: StoreRow): Promise<TeamMember[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: storeUsers.role,
      avatarUrl: users.avatarUrl,
      assignedAt: storeUsers.assignedAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(storeUsers)
    .innerJoin(users, eq(users.id, storeUsers.userId))
    .where(eq(storeUsers.storeId, store.id))
    .orderBy(storeUsers.assignedAt);

  return rows.map((row) => ({
    ...row,
    isOwner: row.userId === store.ownerId,
  }));
}

export async function inviteMember(
  store: StoreRow,
  actorId: string,
  input: { email: string; role: 'admin' | 'manager' | 'cashier' | 'viewer' },
): Promise<{
  status: 'added' | 'invited';
  userId?: string;
  invitationId?: string;
  devToken?: string;
}> {
  const db = getDb();

  const [existingUser] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  if (existingUser) {
    if (existingUser.id === store.ownerId) {
      throw conflict('This person is already the store owner');
    }
    const [membership] = await db
      .select({ id: storeUsers.id })
      .from(storeUsers)
      .where(and(eq(storeUsers.storeId, store.id), eq(storeUsers.userId, existingUser.id)))
      .limit(1);

    if (membership) throw conflict('This person is already a member of this store');

    await db.insert(storeUsers).values({
      storeId: store.id,
      userId: existingUser.id,
      role: input.role,
    });

    await notifyUsers([existingUser.id], {
      storeId: store.id,
      type: 'system',
      title: `You now have access to ${store.name}`,
      message: `You were added as ${input.role}.`,
      actionUrl: '/dashboard',
    });

    recordActivity({
      userId: actorId,
      storeId: store.id,
      action: 'team.member_added',
      entityType: 'user',
      entityId: existingUser.id,
      details: { email: input.email, role: input.role },
    });

    return { status: 'added', userId: existingUser.id };
  }

  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.storeId, store.id),
        eq(invitations.email, input.email),
        eq(invitations.status, 'pending'),
      ),
    )
    .limit(1);

  if (pending) throw conflict('An invitation is already pending for this email');

  const token = randomToken(32);
  const [invitation] = await db
    .insert(invitations)
    .values({
      storeId: store.id,
      email: input.email,
      role: input.role,
      tokenHash: sha256(token),
      invitedById: actorId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();

  if (!invitation) throw new Error('Failed to create invitation');

  const inviteUrl = `${env.APP_URL}/accept-invitation?token=${token}`;
  await sendInvitationEmail(input.email, store.name, input.role, inviteUrl);

  recordActivity({
    userId: actorId,
    storeId: store.id,
    action: 'team.invitation_sent',
    entityType: 'invitation',
    entityId: invitation.id,
    details: { email: input.email, role: input.role },
  });

  return {
    status: 'invited',
    invitationId: invitation.id,
    ...(env.NODE_ENV === 'production' ? {} : { devToken: token }),
  };
}

export async function updateMemberRole(
  store: StoreRow,
  targetUserId: string,
  role: 'admin' | 'manager' | 'cashier' | 'viewer',
  actorId: string,
): Promise<void> {
  if (targetUserId === store.ownerId) {
    throw forbidden('The store owner role cannot be changed');
  }

  const db = getDb();
  const [updated] = await db
    .update(storeUsers)
    .set({ role })
    .where(and(eq(storeUsers.storeId, store.id), eq(storeUsers.userId, targetUserId)))
    .returning({ userId: storeUsers.userId });

  if (!updated) throw notFound('Team member not found');

  recordActivity({
    userId: actorId,
    storeId: store.id,
    action: 'team.role_changed',
    entityType: 'user',
    entityId: targetUserId,
    details: { role },
  });

  await notifyUsers([targetUserId], {
    storeId: store.id,
    type: 'system',
    title: 'Your role was updated',
    message: `You are now ${role} at ${store.name}.`,
    actionUrl: '/dashboard',
  });
}

export async function removeMember(
  store: StoreRow,
  targetUserId: string,
  actorId: string,
): Promise<void> {
  if (targetUserId === store.ownerId) {
    throw forbidden('The store owner cannot be removed');
  }
  if (targetUserId === actorId) {
    throw badRequest('You cannot remove yourself. Ask another admin to do it.');
  }

  const db = getDb();
  const [removed] = await db
    .delete(storeUsers)
    .where(and(eq(storeUsers.storeId, store.id), eq(storeUsers.userId, targetUserId)))
    .returning({ userId: storeUsers.userId });

  if (!removed) throw notFound('Team member not found');

  recordActivity({
    userId: actorId,
    storeId: store.id,
    action: 'team.member_removed',
    entityType: 'user',
    entityId: targetUserId,
  });

  await notifyUsers([targetUserId], {
    storeId: store.id,
    type: 'system',
    title: `You no longer have access to ${store.name}`,
    message: 'A store administrator removed your access.',
  });
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
}

export async function listActivity(
  storeId: string,
  options: { page: number; limit: number; action?: string; userId?: string },
): Promise<{ entries: ActivityEntry[]; total: number }> {
  const db = getDb();
  const conditions: SQL[] = [eq(activityLogs.storeId, storeId)];
  if (options.action) conditions.push(eq(activityLogs.action, options.action));
  if (options.userId) conditions.push(eq(activityLogs.userId, options.userId));
  const where = and(...conditions);

  const [rows, totals] = await Promise.all([
    db
      .select({
        log: activityLogs,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(activityLogs)
      .leftJoin(users, eq(users.id, activityLogs.userId))
      .where(where)
      .orderBy(desc(activityLogs.createdAt))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit),
    db.select({ total: count() }).from(activityLogs).where(where),
  ]);

  return {
    entries: rows.map((row) => ({
      id: row.log.id,
      action: row.log.action,
      entityType: row.log.entityType,
      entityId: row.log.entityId,
      details: row.log.details ?? null,
      createdAt: row.log.createdAt,
      userName: row.firstName ? `${row.firstName} ${row.lastName ?? ''}`.trim() : null,
      userEmail: row.email,
    })),
    total: Number(totals[0]?.total ?? 0),
  };
}

/* ─────────────────────────── Invitations ─────────────────────────── */

export async function acceptInvitation(
  input: {
    token: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  },
  meta: RequestMeta,
): Promise<{
  user: PublicUser;
  tokens: TokenPair;
  storeId: string;
  storeName: string;
  role: string;
}> {
  const db = getDb();
  const tokenHash = sha256(input.token);

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
    .limit(1);

  if (!invitation) throw unauthorized('Invitation link is invalid');
  if (invitation.status !== 'pending') throw conflict('Invitation has already been used');
  if (invitation.expiresAt.getTime() <= Date.now()) {
    await db
      .update(invitations)
      .set({ status: 'expired' })
      .where(eq(invitations.id, invitation.id));
    throw unauthorized('Invitation has expired. Ask an administrator for a new one.');
  }

  const [store] = await db.select().from(stores).where(eq(stores.id, invitation.storeId)).limit(1);

  if (!store) throw notFound('Store not found');

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, invitation.email))
    .limit(1);

  let user: UserRow;

  if (existingUser) {
    if (!input.password) throw badRequest('Password is required to accept this invitation');
    const valid = await verifyPassword(input.password, existingUser.passwordHash);
    if (!valid) throw unauthorized('Invalid password');
    user = existingUser;
  } else {
    if (!input.password || !input.firstName || !input.lastName) {
      throw badRequest('First name, last name and password are required for new accounts');
    }
    const passwordHash = await hashPassword(input.password);
    const [createdUser] = await db
      .insert(users)
      .values({
        email: invitation.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'viewer',
      })
      .returning();
    if (!createdUser) throw new Error('Failed to create user');
    user = createdUser;
    await db.insert(dashboardPreferences).values({ userId: user.id }).onConflictDoNothing();
  }

  const [membership] = await db
    .select({ id: storeUsers.id })
    .from(storeUsers)
    .where(and(eq(storeUsers.storeId, store.id), eq(storeUsers.userId, user.id)))
    .limit(1);

  if (!membership) {
    await db.insert(storeUsers).values({
      storeId: store.id,
      userId: user.id,
      role: invitation.role,
    });
  }

  await db
    .update(invitations)
    .set({ status: 'accepted', acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  recordActivity({
    userId: user.id,
    storeId: store.id,
    action: 'team.invitation_accepted',
    entityType: 'invitation',
    entityId: invitation.id,
    ipAddress: meta.ipAddress,
  });

  const tokens = await issueTokens(user, true, meta);

  return {
    user: toPublicUser(user),
    tokens,
    storeId: store.id,
    storeName: store.name,
    role: invitation.role,
  };
}

export async function listInvitations(
  storeId: string,
): Promise<Array<typeof invitations.$inferSelect>> {
  return getDb()
    .select()
    .from(invitations)
    .where(eq(invitations.storeId, storeId))
    .orderBy(desc(invitations.createdAt))
    .limit(50);
}

/** Revokes every refresh token for a user (used by account deletion, admin tools). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await getDb()
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), sql`${refreshTokens.revokedAt} is null`));
}
