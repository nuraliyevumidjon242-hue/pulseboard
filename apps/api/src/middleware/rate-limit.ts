import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env';

const base = {
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    },
  },
};

export const apiLimiter = rateLimit({
  ...base,
  max: env.RATE_LIMIT_MAX,
});

export const authLimiter = rateLimit({
  ...base,
  max: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
});

export const writeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 120,
});
