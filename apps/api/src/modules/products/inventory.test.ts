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

describe('products and inventory', () => {
  let app: Express;
  let owner: Account;
  let coffee: ProductFixture;
  let matcha: ProductFixture;

  beforeAll(async () => {
    app = await bootstrap();
    owner = await createAccount(app, {
      email: 'inventory.owner@example.com',
      storeName: 'Inventory Store',
    });

    coffee = await createProduct(app, owner.token, owner.storeId, {
      sku: 'INV-101',
      name: 'Old Coffee Name',
      category: 'Coffee',
      price: 18.9,
      cost: 11.2,
      currentStock: 4,
      minStock: 5,
      barcode: '4001234567890',
    });

    matcha = await createProduct(app, owner.token, owner.storeId, {
      sku: 'INV-200',
      name: 'Matcha Powder',
      category: 'Tea',
      price: 24,
      cost: 15,
      currentStock: 20,
      minStock: 5,
      maxStock: 100,
    });
  });

  afterAll(async () => {
    await flushAsync(150);
    await closeDatabase();
  });

  it('lists products with search, category filters and pagination', async () => {
    const all = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta.total).toBe(2);
    expect(all.body.data.every((product: { isActive: boolean }) => product.isActive)).toBe(true);

    const search = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products?search=matcha`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].sku).toBe('INV-200');

    const category = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products?category=Coffee`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(category.body.data).toHaveLength(1);

    const categories = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products/categories`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(categories.body.data).toEqual(['Coffee', 'Tea']);
  });

  it('finds products by barcode and rejects duplicate SKUs', async () => {
    const byBarcode = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products/barcode/4001234567890`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(byBarcode.body.data.product.id).toBe(coffee.id);

    const duplicate = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ sku: 'INV-101', name: 'Duplicate', price: 1 })
      .expect(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('updates a product and archives it', async () => {
    const updated = await request(app)
      .patch(`/api/v1/stores/${owner.storeId}/products/${matcha.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Ceremonial Matcha', price: 29.95, minStock: 4 })
      .expect(200);

    expect(updated.body.data.product).toMatchObject({
      name: 'Ceremonial Matcha',
      price: '29.95',
      minStock: 4,
      currentStock: 20,
      maxStock: 100,
    });

    const discontinued = await createProduct(app, owner.token, owner.storeId, {
      sku: 'OLD-1',
      name: 'Discontinued Syrup',
      price: 4,
      cost: 0,
      currentStock: 0,
      minStock: 0,
    });

    await request(app)
      .delete(`/api/v1/stores/${owner.storeId}/products/${discontinued.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const archived = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products?includeInactive=true`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(archived.body.data.find((p: { id: string }) => p.id === discontinued.id).isActive).toBe(
      false,
    );

    const defaultList = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(
      defaultList.body.data.find((p: { id: string }) => p.id === discontinued.id),
    ).toBeUndefined();
    expect(defaultList.body.data.find((p: { id: string }) => p.id === matcha.id)).toBeDefined();
  });

  it('adjusts stock atomically and records an audit trail', async () => {
    const purchase = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ productId: coffee.id, quantityChange: 10, reason: 'purchase', notes: 'Delivery' })
      .expect(200);
    expect(purchase.body.data).toMatchObject({ newStock: 14 });

    const damage = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ productId: coffee.id, quantityChange: -2, reason: 'damage' })
      .expect(200);
    expect(damage.body.data.newStock).toBe(12);

    const impossible = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/inventory/adjust`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ productId: coffee.id, quantityChange: -100, reason: 'loss' })
      .expect(400);
    expect(impossible.body.error.message).toContain('Insufficient stock');

    const adjustments = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/inventory/adjustments?reason=purchase&limit=10`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(adjustments.body.data).toHaveLength(1);
    expect(adjustments.body.data[0]).toMatchObject({
      productId: coffee.id,
      quantityChanged: 10,
      reason: 'purchase',
      productName: 'Old Coffee Name',
    });
    expect(adjustments.body.meta.total).toBe(1);

    await flushAsync();
  });

  it('reports low stock and inventory valuation', async () => {
    await request(app)
      .patch(`/api/v1/stores/${owner.storeId}/products/${coffee.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ minStock: 20 })
      .expect(200);

    const lowStock = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/inventory/low-stock`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(lowStock.body.data).toHaveLength(1);
    expect(lowStock.body.data[0].id).toBe(coffee.id);
    expect(lowStock.body.meta.count).toBe(1);

    const filtered = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products?lowStockOnly=true`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);

    const summary = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/inventory/summary`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(summary.body.data).toMatchObject({
      totalProducts: 3,
      activeProducts: 2,
      lowStockCount: 1,
      outOfStockCount: 0,
      inventoryValue: '434.40',
      potentialRevenue: '825.80',
    });
  });

  it('exports products as CSV and serves an import template', async () => {
    const exported = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/inventory/export`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.headers['content-disposition']).toContain('products.csv');
    expect(exported.text).toContain('sku,name,category');
    expect(exported.text).toContain('INV-101');

    const template = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/inventory/template`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(template.text).toContain('COF-001');
  });

  it('imports CSV rows, updating existing SKUs and reporting bad rows', async () => {
    const csv = [
      'sku,name,category,price,cost,stock,min_stock,max_stock,unit,barcode,expiry_date',
      'INV-300,Imported Beans,Coffee,18.90,11.20,40,10,200,pcs,400999,2027-01-31',
      'INV-101,Updated Coffee Name,Coffee,20.00,12.00,12,5,100,pcs,,',
      'BAD-1,,Coffee,10.00,5.00,3,1,10,pcs,,',
    ].join('\r\n');

    const response = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/inventory/import`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('file', Buffer.from(csv, 'utf8'), {
        filename: 'products.csv',
        contentType: 'text/csv',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({ imported: 1, updated: 1, failed: 1 });
    expect(response.body.data.errors[0].row).toBe(4);

    const updated = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products/${coffee.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(updated.body.data.product).toMatchObject({
      name: 'Updated Coffee Name',
      price: '20.00',
      currentStock: 12,
    });

    const imported = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products?search=Imported`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(imported.body.data[0]).toMatchObject({
      sku: 'INV-300',
      barcode: '400999',
      expiryDate: '2027-01-31',
    });

    await flushAsync();
  });

  it('rejects CSV uploads without content', async () => {
    const response = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/inventory/import`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(400);
    expect(response.body.error.message).toContain('Upload a CSV');
  });
});
