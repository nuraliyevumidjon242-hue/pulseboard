import type { Response } from 'express';
import { REFRESH_COOKIE_NAME, cookieOptions, env } from '../../config/env';

export function setRefreshCookie(res: Response, token: string, remember: boolean): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions,
    ...(remember ? { maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 } : {}),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { ...cookieOptions });
}
