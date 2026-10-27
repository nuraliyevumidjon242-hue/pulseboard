import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { getDb, initTestDatabase } from '../db/client';
import { runMigrations } from '../db/migrate';
import { storeUsers, users } from '../db/schema';
import { clearCache } from '../lib/cache';
import { createApp } from '../app';

export const TEST_PASSWORD = 'TestPassw0rd!';

export async function bootstrap(): Promise<Express> {
  await initTestDatabase();
  await runMigrations();
  clearCache();
  return createApp();
}

export interface Account {
  token: string;
  userId: string;
  storeId: string;
  email: string;
}

let counter = 0;

export async function createAccount(
  app: Express,
  overrides: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    storeName: string;
  }> = {},
): Promise<Account> {
  counter += 1;
  const email = overrides.email ?? `user${counter}@example.com`;
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: TEST_PASSWORD,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? `User${counter}`,
      storeName: overrides.storeName ?? `Test Store ${counter}`,
    })
    .expect(201);

  return {
    token: response.body.data.accessToken,
    userId: response.body.data.user.id,
    storeId: response.body.data.storeId,
    email,
  };
}

export async function login(
  app: Express,
  email: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return response.body.data.accessToken;
}

export async function addMember(
  storeId: string,
  userId: string,
  role: 'admin' | 'manager' | 'cashier' | 'viewer',
  globalRole?: 'business_owner' | 'manager' | 'cashier' | 'viewer',
): Promise<void> {
  const db = getDb();
  await db.insert(storeUsers).values({ storeId, userId, role });
  if (globalRole) {
    await db.update(users).set({ role: globalRole }).where(eq(users.id, userId));
  }
}

/** Extracts the `pb_refresh=...` cookie from a supertest response. */
export function refreshCookieFrom(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [String(header)] : [];
  const cookie = cookies.find((value) => value.startsWith('pb_refresh='));
  if (!cookie) throw new Error('Expected a pb_refresh cookie in the response');
  return cookie.split(';')[0] ?? cookie;
}

/** Lets fire-and-forget work (notifications, activity logs) settle. */
export const flushAsync = (ms = 75): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface ProductFixture {
  id: string;
  name: string;
  price: string;
  currentStock: number;
}

export async function createProduct(
  app: Express,
  token: string,
  storeId: string,
  overrides: Record<string, unknown> = {},
): Promise<ProductFixture> {
  const response = await request(app)
    .post(`/api/v1/stores/${storeId}/products`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      sku: `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: 'Test Product',
      price: 10,
      cost: 6,
      currentStock: 25,
      minStock: 5,
      ...overrides,
    })
    .expect(201);
  return response.body.data.product;
}

export async function createSale(
  app: Express,
  token: string,
  storeId: string,
  items: Array<{ productId: string; quantity: number }>,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await request(app)
    .post(`/api/v1/stores/${storeId}/sales`)
    .set('Authorization', `Bearer ${token}`)
    .send({ items, paymentMethod: 'card', ...overrides })
    .expect(201);
  return response.body.data;
}
