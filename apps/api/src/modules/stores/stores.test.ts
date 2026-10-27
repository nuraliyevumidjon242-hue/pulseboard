import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../db/client';
import { addMember, bootstrap, createAccount, flushAsync, type Account } from '../../test/helpers';

describe('stores module', () => {
  let app: Express;
  let owner: Account;
  let secondStoreId: string;

  beforeAll(async () => {
    app = await bootstrap();
    owner = await createAccount(app, {
      email: 'stores.owner@example.com',
      storeName: 'Flagship Store',
    });
  });

  afterAll(async () => {
    await flushAsync(150);
    await closeDatabase();
  });

  it('lists accessible stores with metrics and membership counts', async () => {
    const response = await request(app)
      .get('/api/v1/stores')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: owner.storeId,
      name: 'Flagship Store',
      currency: 'EUR',
      timezone: 'Europe/Berlin',
      role: 'admin',
      isOwner: true,
      memberCount: 1,
    });
    expect(response.body.data[0].metrics).toMatchObject({
      todayRevenue: '0.00',
      todayTransactions: 0,
      monthRevenue: '0.00',
      lowStockCount: 0,
    });
    expect(response.body.meta.total).toBe(1);
  });

  it('creates a second store for a business owner', async () => {
    const response = await request(app)
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Tashkent Branch',
        city: 'Tashkent',
        country: 'Uzbekistan',
        timezone: 'Asia/Tashkent',
        currency: 'uzs',
        phone: '+998 71 200 0000',
        settings: { milestoneAmount: 5_000_000, receiptPrefix: 'TSH' },
      })
      .expect(201);

    const store = response.body.data.store;
    secondStoreId = store.id;
    expect(store).toMatchObject({
      name: 'Tashkent Branch',
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
    });
    expect(store.settings).toMatchObject({ milestoneAmount: 5_000_000, receiptPrefix: 'TSH' });
    expect(response.body.data.permissions).toEqual(expect.arrayContaining(['settings:write']));

    const list = await request(app)
      .get('/api/v1/stores')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(list.body.data).toHaveLength(2);

    const comparison = await request(app)
      .get('/api/v1/stores/compare')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(comparison.body.data).toHaveLength(2);
    expect(comparison.body.data.map((store: { name: string }) => store.name)).toEqual(
      expect.arrayContaining(['Flagship Store', 'Tashkent Branch']),
    );
  });

  it('returns store details with effective permissions', async () => {
    const response = await request(app)
      .get(`/api/v1/stores/${owner.storeId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      role: 'admin',
      isOwner: true,
      memberCount: 1,
    });
    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining([
        'store:read',
        'store:update',
        'sales:write',
        'analytics:export',
        'team:manage',
        'settings:write',
      ]),
    );
  });

  it('updates store profile and settings', async () => {
    const profile = await request(app)
      .patch(`/api/v1/stores/${secondStoreId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Tashkent Flagship', city: 'Tashkent City', description: 'New location' })
      .expect(200);
    expect(profile.body.data.store).toMatchObject({
      name: 'Tashkent Flagship',
      city: 'Tashkent City',
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
    });

    const settings = await request(app)
      .put(`/api/v1/stores/${secondStoreId}/settings`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        timezone: 'Europe/Vienna',
        currency: 'USD',
        settings: {
          milestoneAmount: 2500,
          lowStockEmails: false,
          dataRetentionDays: 365,
          receiptPrefix: 'VIE',
        },
      })
      .expect(200);
    expect(settings.body.data.settings).toMatchObject({
      currency: 'USD',
      timezone: 'Europe/Vienna',
      milestoneAmount: 2500,
      lowStockEmails: false,
      dataRetentionDays: 365,
      receiptPrefix: 'VIE',
    });

    const readBack = await request(app)
      .get(`/api/v1/stores/${secondStoreId}/settings`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(readBack.body.data.settings).toMatchObject({
      name: 'Tashkent Flagship',
      currency: 'USD',
      timezone: 'Europe/Vienna',
      milestoneAmount: 2500,
      receiptPrefix: 'VIE',
    });
  });

  it('rejects invalid timezones and non-owner store creation', async () => {
    await request(app)
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Mars Outpost', timezone: 'Mars/Olympus' })
      .expect(422);

    const manager = await createAccount(app, { email: 'store.manager@example.com' });
    await addMember(owner.storeId, manager.userId, 'manager', 'manager');

    const forbidden = await request(app)
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Manager Store' })
      .expect(403);
    expect(forbidden.body.error.message).toContain('Only business owners');
  });

  it('only allows the owner to delete a store', async () => {
    const admin = await createAccount(app, { email: 'store.admin@example.com' });
    await addMember(secondStoreId, admin.userId, 'admin', 'manager');

    await request(app)
      .delete(`/api/v1/stores/${secondStoreId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(403);

    await request(app)
      .delete(`/api/v1/stores/${secondStoreId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const gone = await request(app)
      .get(`/api/v1/stores/${secondStoreId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
    expect(gone.body.error.code).toBe('NOT_FOUND');
  });
});
