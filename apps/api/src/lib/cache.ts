interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
const MAX_ENTRIES = 500;

function sweep(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

/** Tiny in-process TTL cache. For multi-instance deployments swap for Redis. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await load();
  if (store.size >= MAX_ENTRIES) sweep();
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return value;
}

export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export const invalidateStoreCache = (storeId: string): void => invalidateCache(`store:${storeId}:`);

export function clearCache(): void {
  store.clear();
}

export const cacheKeys = {
  dashboard: (storeId: string, days: number): string => `store:${storeId}:dashboard:${days}`,
  analytics: (storeId: string, scope: string): string => `store:${storeId}:${scope}`,
};
