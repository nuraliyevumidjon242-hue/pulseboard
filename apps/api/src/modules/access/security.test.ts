import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../db/client';
import {
  addMember,
  bootstrap,
  createAccount,
  createProduct,
  type Account,
} from '../../test/helpers';

describe('access control and API hardening', () => {
  let app: Express;
  let owner: Account;
  let productId: string;

  beforeAll(async () => {
    app = await bootstrap();
    owner = await createAccount(app, { email: 'owner.security@example.com' });
    const product = await createProduct(app, owner.token, owner.storeId, {
      name: 'Security Test Coffee',
      sku: 'SEC-001',
      currentStock: 100,
    });
    productId = product.id;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('rejects requests without a bearer token', async () => {
    const response = await request(app).get('/api/v1/stores').expect(401);
    expect(response.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects malformed tokens', async () => {
    const response = await request(app)
      .get('/api/v1/stores')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('hides another store from a different business owner', async () => {
    const stranger = await createAccount(app, { email: 'stranger@example.com' });

    const response = await request(app)
      .get(`/api/v1/stores/${stranger.storeId}/products`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toContain('do not have access');
  });

  it('limits viewers to read-only analytics', async () => {
    const viewer = await createAccount(app, { email: 'viewer@example.com' });
    await addMember(owner.storeId, viewer.userId, 'viewer', 'viewer');

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/dashboard`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);

    const createForbidden = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ sku: 'VIEW-1', name: 'Nope', price: 5 })
      .expect(403);
    expect(createForbidden.body.error.code).toBe('FORBIDDEN');

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ items: [{ productId, quantity: 1 }], paymentMethod: 'card' })
      .expect(403);

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/settings`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(403);

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/analytics/export`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ format: 'csv', type: 'daily' })
      .expect(403);
  });

  it('lets cashiers sell but not manage stock or products', async () => {
    const cashier = await createAccount(app, { email: 'cashier@example.com' });
    await addMember(owner.storeId, cashier.userId, 'cashier', 'cashier');

    const sale = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${cashier.token}`)
      .send({ items: [{ productId, quantity: 2 }], paymentMethod: 'cash' })
      .expect(201);
    expect(sale.body.data.totals.finalAmount).toBe('20.00');

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${cashier.token}`)
      .send({ sku: 'CASH-1', name: 'Forbidden', price: 3 })
      .expect(403);

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${cashier.token}`)
      .send({ productId, quantityChange: 5, reason: 'purchase' })
      .expect(403);

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${cashier.token}`)
      .expect(403);
  });

  it('lets managers operate the store but not change settings or team roles', async () => {
    const manager = await createAccount(app, { email: 'manager@example.com' });
    await addMember(owner.storeId, manager.userId, 'manager', 'manager');

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ sku: 'MGR-1', name: 'Manager Product', price: 7.5, currentStock: 10 })
      .expect(201);

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/team/invite`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ email: 'new-member@example.com', role: 'viewer' })
      .expect(403);

    await request(app)
      .put(`/api/v1/stores/${owner.storeId}/settings`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ timezone: 'UTC' })
      .expect(403);

    await request(app)
      .patch(`/api/v1/stores/${owner.storeId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Renamed by manager' })
      .expect(403);
  });

  it('validates request payloads before touching the database', async () => {
    const response = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ sku: '', name: '', price: -4 })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fields.sku).toBeDefined();
    expect(response.body.error.details.fields.name).toBeDefined();
    expect(response.body.error.details.fields.price).toBeDefined();

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products?limit=500`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(422);
  });

  it('returns a JSON 404 envelope and echoes request ids', async () => {
    const response = await request(app)
      .get('/api/v1/does-not-exist')
      .set('X-Request-Id', 'req-test-123')
      .expect(404);

    expect(response.headers['x-request-id']).toBe('req-test-123');
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      requestId: 'req-test-123',
    });
  });

  it('rejects disallowed CORS origins', async () => {
    const response = await request(app)
      .get('/api/v1/meta')
      .set('Origin', 'https://evil.example')
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('applies security headers and never leaks the Express signature', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database.status).toBe('up');
  });

  it('handles malformed JSON with a 400 error', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
  });
});
