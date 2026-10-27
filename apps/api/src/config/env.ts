import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  PGLITE_DATA_DIR: z.string().default('.data/pglite'),

  JWT_ACCESS_SECRET: z.string().min(24).default('dev-access-secret-please-change-0123456789'),
  JWT_REFRESH_SECRET: z.string().min(24).default('dev-refresh-secret-please-change-0123456789'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.preprocess(emptyToUndefined, booleanFromString.optional()),
  COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  TRUST_PROXY: booleanFromString.default(false),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MAIL_FROM: z.string().default('PulseBoard <no-reply@pulseboard.app>'),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_SECURE: booleanFromString.default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';

if (isProduction) {
  const secrets = [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET];
  if (secrets.some((secret) => secret.startsWith('dev-') || secret.includes('CHANGE_ME'))) {
    throw new Error('Refusing to start in production with development or placeholder JWT secrets.');
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('JWT access and refresh secrets must be different.');
  }
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production.');
  }
}

export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const cookieOptions = {
  httpOnly: true as const,
  secure: env.COOKIE_SECURE ?? isProduction,
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN,
  path: '/',
};

export const REFRESH_COOKIE_NAME = 'pb_refresh';
