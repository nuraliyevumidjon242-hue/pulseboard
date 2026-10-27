import { io, type Socket } from 'socket.io-client';
import type { NotificationItem, PaymentMethod } from '../types';

export interface SaleCreatedEvent {
  saleId: string;
  transactionId: string;
  finalAmount: string;
  totalAmount: string;
  discount: string;
  paymentMethod: PaymentMethod;
  itemsCount: number;
  cashierName: string | null;
  createdAt: string;
}

export interface InventoryUpdatedEvent {
  productId: string;
  currentStock: number;
  previousStock: number;
  reason: string;
}

export interface ServerToClientEvents {
  connected: (payload: { userId: string; at: string }) => void;
  'sale:created': (payload: SaleCreatedEvent) => void;
  'inventory:updated': (payload: InventoryUpdatedEvent) => void;
  'notification:new': (payload: NotificationItem) => void;
  'milestone:reached': (payload: { milestone: number; revenue: number }) => void;
}

export interface ClientToServerEvents {
  'join-store': (
    storeId: string,
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;
  'leave-store': (storeId: string) => void;
}

export type PulseSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: PulseSocket | null = null;

function socketOrigin(): string {
  const explicit =
    (import.meta.env.VITE_WS_URL as string | undefined) ??
    (import.meta.env.VITE_API_URL as string | undefined);
  if (explicit) return explicit.replace(/\/$/, '');
  return window.location.origin;
}

export function getSocket(token: string): PulseSocket {
  if (!socket) {
    socket = io(socketOrigin(), {
      path: '/socket.io',
      autoConnect: false,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 8_000,
    });
  }

  socket.auth = { token };
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function currentSocket(): PulseSocket | null {
  return socket;
}
