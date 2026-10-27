/**
 * Access tokens live in memory only. The long-lived refresh token is an
 * httpOnly cookie, which keeps XSS from being able to exfiltrate a session.
 */
let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
const listeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  set(token: string | null): void {
    accessToken = token;
    listeners.forEach((listener) => listener(token));
  },
  clear(): void {
    accessToken = null;
    listeners.forEach((listener) => listener(null));
  },
  /** Lets long-lived connections pick up a rotated access token. */
  subscribe(listener: (token: string | null) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  onUnauthorized(handler: (() => void) | null): void {
    unauthorizedHandler = handler;
  },
  notifyUnauthorized(): void {
    unauthorizedHandler?.();
  },
};
