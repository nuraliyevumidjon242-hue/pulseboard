import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../db/client';
import {
  bootstrap,
  createAccount,
  createProduct,
  flushAsync,
  type Account,
  type ProductFixture,
} from '../../test/helpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('sales module', () => {
  let app: Express;
  let owner: Account;
  let coffee: ProductFixture;

  beforeAll(async () => {
    app = await bootstrap();
    owner = await createAccount(app, {
      email: 'sales.owner@example.com',
      storeName: 'Sales Store',
    });
    coffee = await createProduct(app, owner.token, owner.storeId, {
      sku: 'COF-100',
      name: 'Flat White',
      price: 10.5,
      cost: 6.25,
      currentStock: 25,
      minStock: 5,
    });
  });

  afterAll(async () => {
    await flushAsync(200);
    await closeDatabase();
  });

  it('creates a sale with integer-cent totals and decrements stock', async () => {
    const response = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        items: [{ productId: coffee.id, quantity: 3 }],
        paymentMethod: 'card',
        discount: 5.5,
        customerName: 'Anna Weber',
        notes: 'Oat milk',
      })
      .expect(201);

    const { sale, totals, receipt } = response.body.data;
    expect(totals).toEqual({ totalAmount: '31.50', discount: '5.50', finalAmount: '26.00' });
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]).toMatchObject({
      productId: coffee.id,
      productName: 'Flat White',
      quantity: 3,
      unitPrice: '10.50',
      subtotal: '31.50',
    });
    expect(sale.paymentMethod).toBe('card');
    expect(sale.cashierName).toBe('Test User1');
    expect(receipt).toMatchObject({ storeName: 'Sales Store', currency: 'EUR' });
    expect(receipt.transactionId).toMatch(/^TXN-\d{8}-[A-F0-9]{6}$/);

    const product = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products/${coffee.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(product.body.data.product.currentStock).toBe(22);

    const adjustments = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/inventory/adjustments?reason=sale`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(adjustments.body.data[0]).toMatchObject({
      productId: coffee.id,
      quantityChanged: -3,
      reason: 'sale',
      oldQuantity: 25,
      newQuantity: 22,
    });

    await flushAsync();
  });

  it('rejects sales that exceed available stock without mutating it', async () => {
    const response = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ items: [{ productId: coffee.id, quantity: 999 }], paymentMethod: 'cash' })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.details).toMatchObject({ productId: coffee.id, available: 22 });

    const product = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products/${coffee.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(product.body.data.product.currentStock).toBe(22);
  });

  it('rejects duplicate line items and discounts above the total', async () => {
    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        items: [
          { productId: coffee.id, quantity: 1 },
          { productId: coffee.id, quantity: 2 },
        ],
        paymentMethod: 'card',
      })
      .expect(400);

    const excessiveDiscount = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        items: [{ productId: coffee.id, quantity: 1 }],
        paymentMethod: 'card',
        discount: 99,
      })
      .expect(400);
    expect(excessiveDiscount.body.error.message).toContain('Discount cannot exceed');
  });

  it('rejects unknown or archived products', async () => {
    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ items: [{ productId: randomUUID(), quantity: 1 }], paymentMethod: 'card' })
      .expect(400);

    const archived = await createProduct(app, owner.token, owner.storeId, {
      sku: 'ARC-1',
      name: 'Archived Item',
      price: 3,
      currentStock: 4,
    });

    await request(app)
      .delete(`/api/v1/stores/${owner.storeId}/products/${archived.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ items: [{ productId: archived.id, quantity: 1 }], paymentMethod: 'card' })
      .expect(400);
  });

  it('lists and filters sales with pagination metadata', async () => {
    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        items: [{ productId: coffee.id, quantity: 1 }],
        paymentMethod: 'cash',
        customerName: 'Jonas Klein',
      })
      .expect(201);

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/sales`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        items: [{ productId: coffee.id, quantity: 2 }],
        paymentMethod: 'mobile',
        customerName: 'Sofia Braun',
      })
      .expect(201);

    const all = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales?limit=2`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta).toMatchObject({ page: 1, limit: 2, hasPrevious: false });
    expect(all.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(all.body.meta.hasNext).toBe(true);

    const cashOnly = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales?paymentMethod=cash`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(cashOnly.body.data.length).toBeGreaterThan(0);
    expect(
      cashOnly.body.data.every((sale: { paymentMethod: string }) => sale.paymentMethod === 'cash'),
    ).toBe(true);

    const search = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales?search=Jonas`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].customerName).toBe('Jonas Klein');
  });

  it('returns sale details and 404 for unknown sales', async () => {
    const list = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales?limit=1`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const saleId = list.body.data[0].id as string;
    expect(saleId).toMatch(UUID);

    const detail = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales/${saleId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(detail.body.data.sale.id).toBe(saleId);
    expect(detail.body.data.sale.items.length).toBeGreaterThan(0);

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales/${randomUUID()}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
  });

  it('aggregates daily, hourly and payment statistics', async () => {
    const daily = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales/stats/daily?days=7`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(daily.body.data.data).toHaveLength(7);
    expect(Number(daily.body.data.totals.revenue)).toBeGreaterThan(0);
    expect(daily.body.data.totals.transactions).toBeGreaterThanOrEqual(3);

    const hourly = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales/stats/hourly`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(hourly.body.data.data).toHaveLength(24);
    expect(Number(hourly.body.data.total.revenue)).toBeGreaterThan(0);

    const payments = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales/stats/payments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const methods = payments.body.data.map((row: { method: string }) => row.method);
    expect(methods).toEqual(expect.arrayContaining(['card', 'cash', 'mobile']));
    const totalPercentage = payments.body.data.reduce(
      (sum: number, row: { percentage: number }) => sum + row.percentage,
      0,
    );
    expect(totalPercentage).toBeGreaterThan(99);
    expect(totalPercentage).toBeLessThan(101);

    const recent = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/sales/recent?limit=2`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(recent.body.data).toHaveLength(2);
    expect(recent.body.data[0].createdAt >= recent.body.data[1].createdAt).toBe(true);

    await flushAsync();
  });
});
