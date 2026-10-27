import { and, eq } from 'drizzle-orm';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { corsOrigins } from '../config/env';
import { getDb } from '../db/client';
import { storeUsers, stores } from '../db/schema';
import { logger } from '../lib/logger';
import { verifyAccessToken } from '../lib/jwt';
import { setIo, storeRoom, userRoom } from './bus';

interface SocketUser {
  id: string;
  role: string;
}

type AuthedSocket = Socket & { data: { user?: SocketUser } };

function extractToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) return authToken;
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  const queryToken = socket.handshake.query.token;
  return typeof queryToken === 'string' ? queryToken : null;
}

async function canAccessStore(user: SocketUser, storeId: string): Promise<boolean> {
  const db = getDb();
  const [store] = await db
    .select({ ownerId: stores.ownerId, isActive: stores.isActive })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (!store || !store.isActive) return false;
  if (store.ownerId === user.id || user.role === 'super_admin') return true;

  const [membership] = await db
    .select({ id: storeUsers.id })
    .from(storeUsers)
    .where(and(eq(storeUsers.storeId, storeId), eq(storeUsers.userId, user.id)))
    .limit(1);

  return Boolean(membership);
}

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
    pingTimeout: 25_000,
    pingInterval: 20_000,
    maxHttpBufferSize: 1e6,
  });

  io.use((socket: AuthedSocket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        next(new Error('UNAUTHORIZED'));
        return;
      }
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const user = socket.data.user!;

    socket.join(userRoom(user.id));
    socket.emit('connected', { userId: user.id, at: new Date().toISOString() });
    logger.debug({ userId: user.id, socketId: socket.id }, 'Socket connected');

    socket.on('join-store', async (storeId: unknown, ack?: (response: unknown) => void) => {
      if (typeof storeId !== 'string') {
        ack?.({ ok: false, error: 'Invalid store id' });
        return;
      }
      try {
        const allowed = await canAccessStore(user, storeId);
        if (!allowed) {
          ack?.({ ok: false, error: 'FORBIDDEN' });
          return;
        }
        await socket.join(storeRoom(storeId));
        ack?.({ ok: true });
      } catch (error) {
        logger.warn({ err: error, storeId }, 'Failed to join store room');
        ack?.({ ok: false, error: 'INTERNAL_ERROR' });
      }
    });

    socket.on('leave-store', (storeId: unknown) => {
      if (typeof storeId === 'string') void socket.leave(storeRoom(storeId));
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: user.id, socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

  setIo(io);
  return io;
}
