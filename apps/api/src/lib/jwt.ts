import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from './errors';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  type: 'access';
}

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ role, type: 'access' }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    issuer: 'pulseboard',
    audience: 'pulseboard-web',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'pulseboard',
      audience: 'pulseboard-web',
    });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      payload.type !== 'access' ||
      typeof payload.role !== 'string'
    ) {
      throw new Error('Malformed token payload');
    }
    return { sub: payload.sub, role: payload.role, type: 'access' };
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
}

export const accessTokenTtlSeconds = (): number => {
  const value = env.ACCESS_TOKEN_TTL;
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 900;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };
  return amount * (multipliers[unit ?? 'm'] ?? 60);
};
