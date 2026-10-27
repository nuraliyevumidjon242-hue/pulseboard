import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../db/client';
import { toDateKey } from '../../lib/time';
import {
  bootstrap,
  createAccount,
  createProduct,
  createSale,
  flushAsync,
  type Account,
} from '../../test/helpers';

describe('analytics module', () => {
  let app: Express;
  let owner: Account;
  const transactionIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrap();
    owner = await createAccount(app, {
      email: 'analytics.owner@example.com',
      storeName: 'Analytics Store',
    });

    const espresso = await createProduct(app, owner.token, owner.storeId, {
      sku: 'ESP-1',
      name: 'Espresso',
      category: 'Coffee',
      price: 5,
      cost: 2,
      currentStock: 100,
      minStock: 5,
    });
    const croissant = await createProduct(app, owner.token, owner.storeId, {
      sku: 'CRO-1',
      name: 'Croissant',
      category: 'Bakery',
      price: 3.5,
      cost: 1.25,
      currentStock: 80,
      minStock: 10,
    });
    await createProduct(app, owner.token, owner.storeId, {
      sku: 'LOW-1',
      name: 'Low Stock Syrup',
      category: 'Coffee',
      price: 8,
      cost: 4,
      currentStock: 2,
      minStock: 5,
    });

    const sales = [
      await createSale(app, owner.token, owner.storeId, [{ productId: espresso.id, quantity: 2 }], {
        paymentMethod: 'card',
        customerName: 'Anna Weber',
      }),
      await createSale(
        app,
        owner.token,
        owner.storeId,
        [{ productId: croissant.id, quantity: 1 }],
        {
          paymentMethod: 'cash',
          customerName: 'Anna Weber',
        },
      ),
      await createSale(
        app,
        owner.token,
        owner.storeId,
        [{ productId: croissant.id, quantity: 3 }],
        {
          paymentMethod: 'mobile',
          customerName: 'Jonas Klein',
          discount: 0.5,
        },
      ),
      await createSale(app, owner.token, owner.storeId, [{ productId: espresso.id, quantity: 1 }], {
        paymentMethod: 'cash',
      }),
    ];

    for (const sale of sales) {
      transactionIds.push((sale.sale as { transactionId: string }).transactionId);
    }
    await flushAsync(150);
  });

  afterAll(async () => {
    await flushAsync(150);
    await closeDatabase();
  });

  it('returns a complete dashboard payload with today, trends and alerts', async () => {
    const response = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/dashboard?days=30`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const data = response.body.data;
    expect(data.store).toMatchObject({
      id: owner.storeId,
      name: 'Analytics Store',
      currency: 'EUR',
      timezone: 'Europe/Berlin',
    });
    expect(data.today).toMatchObject({
      revenue: '28.50',
      transactions: 4,
      itemsSold: 7,
      avgTransaction: '7.13',
    });
    expect(data.yesterday.revenue).toBe('0.00');
    expect(data.last7Days.revenue).toBe('28.50');
    expect(data.last30Days.revenue).toBe('28.50');
    expect(data.trend).toHaveLength(30);
    expect(data.trend.at(-1).revenue).toBe('28.50');
    expect(data.hourly).toHaveLength(24);
    expect(data.paymentBreakdown.map((row: { method: string }) => row.method)).toEqual(
      expect.arrayContaining(['card', 'cash', 'mobile']),
    );
    expect(data.topProducts[0]).toMatchObject({
      name: 'Espresso',
      quantity: 3,
      revenue: '15.00',
      profit: '9.00',
    });
    expect(data.lowStock.count).toBe(1);
    expect(data.lowStock.items[0].name).toBe('Low Stock Syrup');
    expect(data.recentSales).toHaveLength(4);
    expect(data.inventory).toMatchObject({ totalProducts: 3, lowStockCount: 1 });
  });

  it('serves revenue series and honours explicit date ranges', async () => {
    const monthly = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/revenue?period=monthly`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(monthly.body.data.period).toBe('monthly');
    expect(monthly.body.data.totals.revenue).toBe('28.50');
    expect(monthly.body.data.previous.revenue).toBe('0.00');
    expect(monthly.body.data.percentageChange).toBeNull();
    expect(monthly.body.data.data.length).toBeGreaterThan(0);

    const today = toDateKey(new Date(), 'Europe/Berlin');
    const todayOnly = await request(app)
      .get(
        `/api/v1/stores/${owner.storeId}/analytics/revenue?period=daily&from=${today}&to=${today}`,
      )
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(todayOnly.body.data.range).toEqual({ from: today, to: today });
    expect(todayOnly.body.data.data).toHaveLength(1);
    expect(todayOnly.body.data.data[0].revenue).toBe('28.50');
    expect(todayOnly.body.data.totals.transactions).toBe(4);
  });

  it('ranks products and categories by performance', async () => {
    const response = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/products?days=30&limit=10`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const data = response.body.data;
    expect(data.top).toHaveLength(2);
    expect(data.top[0]).toMatchObject({
      name: 'Espresso',
      quantity: 3,
      revenue: '15.00',
      profit: '9.00',
      margin: 60,
    });
    expect(data.top[1]).toMatchObject({
      name: 'Croissant',
      quantity: 4,
      revenue: '14.00',
      profit: '9.00',
      margin: 64.3,
    });
    expect(data.bottom.length).toBe(3);
    expect(
      data.bottom.some(
        (row: { name: string; quantity: number }) =>
          row.name === 'Low Stock Syrup' && row.quantity === 0,
      ),
    ).toBe(true);
    expect(data.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Coffee', revenue: '15.00' }),
        expect.objectContaining({ category: 'Bakery', revenue: '14.00' }),
      ]),
    );
  });

  it('computes customer loyalty, walk-ins and top spenders', async () => {
    const response = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/customers?days=90`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const data = response.body.data;
    expect(data).toMatchObject({
      totalCustomers: 2,
      returningCustomers: 1,
      loyalCustomers: 0,
      repeatRate: 50,
      namedRevenue: '23.50',
    });
    expect(data.walkIn).toMatchObject({ transactions: 1, revenue: '5.00', share: 25 });
    expect(data.topCustomers[0]).toMatchObject({
      name: 'Anna Weber',
      orders: 2,
      spend: '13.50',
      avgOrder: '6.75',
    });
    expect(data.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'One-time', customers: 1 }),
        expect.objectContaining({ label: 'Returning', customers: 1 }),
        expect.objectContaining({ label: 'Loyal (5+)', customers: 0 }),
      ]),
    );
  });

  it('builds the 24-hour and weekday peak matrices', async () => {
    const response = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/peak-hours?days=30`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const data = response.body.data;
    expect(data.hours).toHaveLength(24);
    expect(data.weekdays).toHaveLength(7);
    expect(
      data.hours.reduce((sum: number, row: { transactions: number }) => sum + row.transactions, 0),
    ).toBe(4);
    expect(
      data.weekdays.reduce(
        (sum: number, row: { transactions: number }) => sum + row.transactions,
        0,
      ),
    ).toBe(4);
    expect(data.busiestHour).toEqual(expect.any(Number));
    expect(data.busiestWeekday).toEqual(expect.any(String));
    const busiest = [...data.hours].sort(
      (a: { revenue: string }, b: { revenue: string }) => Number(b.revenue) - Number(a.revenue),
    )[0];
    expect(busiest.revenue).toBe('28.50');
  });

  it('exports CSV and PDF reports', async () => {
    const csv = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/analytics/export`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ format: 'csv', type: 'daily' })
      .expect(200);

    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toContain('.csv');
    expect(csv.text).toContain('transaction_id,date,customer');
    for (const transactionId of transactionIds) {
      expect(csv.text).toContain(transactionId);
    }

    const pdf = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/export?format=pdf&type=monthly`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('.pdf');

    const invalid = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/export?format=docx`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates analytics query parameters', async () => {
    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/dashboard?days=500`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(422);

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/products?limit=2`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(422);

    const badRange = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/analytics/revenue?from=2026-10-20&to=2026-10-01`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(400);
    expect(badRange.body.error.message).toContain('"from" must be before "to"');
  });
});
