import type { Server } from 'socket.io';

let io: Server | null = null;

export const storeRoom = (storeId: string): string => `store:${storeId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

export function setIo(server: Server): void {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export function emitToStore(storeId: string, event: string, payload: unknown): void {
  io?.to(storeRoom(storeId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}
