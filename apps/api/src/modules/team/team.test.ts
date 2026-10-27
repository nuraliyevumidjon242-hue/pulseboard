import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../db/client';
import {
  bootstrap,
  createAccount,
  flushAsync,
  TEST_PASSWORD,
  type Account,
} from '../../test/helpers';

describe('team and invitations', () => {
  let app: Express;
  let owner: Account;
  let colleague: Account;

  beforeAll(async () => {
    app = await bootstrap();
    owner = await createAccount(app, { email: 'team.owner@example.com', storeName: 'Team Store' });
    colleague = await createAccount(app, { email: 'colleague@example.com' });
  });

  afterAll(async () => {
    await flushAsync(150);
    await closeDatabase();
  });

  it('starts with just the owner and no pending invitations', async () => {
    const team = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(team.body.data).toHaveLength(1);
    expect(team.body.data[0]).toMatchObject({
      userId: owner.userId,
      email: 'team.owner@example.com',
      role: 'admin',
      isOwner: true,
    });

    const invitations = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team/invitations`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(invitations.body.data).toEqual([]);
  });

  it('adds an existing user to the store', async () => {
    const response = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/team/invite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'colleague@example.com', role: 'viewer' })
      .expect(201);

    expect(response.body.data).toMatchObject({ status: 'added', userId: colleague.userId });

    const team = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(team.body.data).toHaveLength(2);
    expect(
      team.body.data.find((m: { email: string }) => m.email === 'colleague@example.com'),
    ).toMatchObject({
      role: 'viewer',
      isOwner: false,
    });

    // The invited business owner must only receive the role they were granted.
    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/settings`)
      .set('Authorization', `Bearer ${colleague.token}`)
      .expect(403);

    const duplicate = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/team/invite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'colleague@example.com', role: 'cashier' })
      .expect(409);
    expect(duplicate.body.error.message).toContain('already a member');

    await flushAsync();
  });

  it('updates a member role and notifies them', async () => {
    await request(app)
      .put(`/api/v1/stores/${owner.storeId}/team/${colleague.userId}/role`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'manager' })
      .expect(200);

    const team = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(team.body.data.find((m: { userId: string }) => m.userId === colleague.userId).role).toBe(
      'manager',
    );

    // The promotion now lets the member read the team list.
    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${colleague.token}`)
      .expect(200);

    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${colleague.token}`)
      .expect(200);
    expect(notifications.body.data.length).toBeGreaterThanOrEqual(2);
    expect(
      notifications.body.data.some(
        (notification: { title: string }) => notification.title === 'Your role was updated',
      ),
    ).toBe(true);
    expect(notifications.body.meta.unread).toBeGreaterThanOrEqual(2);
  });

  it('invites a new person and accepts the invitation once', async () => {
    const invite = await request(app)
      .post(`/api/v1/stores/${owner.storeId}/team/invite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'newcashier@example.com', role: 'cashier' })
      .expect(201);

    expect(invite.body.data.status).toBe('invited');
    expect(invite.body.data.invitationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    const token = invite.body.data.devToken as string;
    expect(token).toEqual(expect.any(String));

    const pending = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team/invitations`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(pending.body.data[0]).toMatchObject({
      email: 'newcashier@example.com',
      role: 'cashier',
      status: 'pending',
    });

    const accepted = await request(app)
      .post('/api/v1/invitations/accept')
      .send({
        token,
        password: TEST_PASSWORD,
        firstName: 'Nora',
        lastName: 'Khan',
      })
      .expect(200);

    expect(accepted.body.data).toMatchObject({
      storeId: owner.storeId,
      storeName: 'Team Store',
      role: 'cashier',
      user: { email: 'newcashier@example.com', firstName: 'Nora' },
    });

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/products`)
      .set('Authorization', `Bearer ${accepted.body.data.accessToken}`)
      .expect(200);

    const reused = await request(app)
      .post('/api/v1/invitations/accept')
      .send({ token, password: TEST_PASSWORD, firstName: 'Nora', lastName: 'Khan' })
      .expect(409);
    expect(reused.body.error.message).toContain('already been used');

    const team = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(team.body.data).toHaveLength(3);
  });

  it('validates invitation payloads', async () => {
    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/team/invite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'not-an-email', role: 'viewer' })
      .expect(422);

    await request(app)
      .post(`/api/v1/stores/${owner.storeId}/team/invite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'valid@example.com', role: 'superuser' })
      .expect(422);
  });

  it('protects the owner from role changes and removal', async () => {
    await request(app)
      .put(`/api/v1/stores/${owner.storeId}/team/${owner.userId}/role`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'viewer' })
      .expect(403);

    await request(app)
      .delete(`/api/v1/stores/${owner.storeId}/team/${owner.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);
  });

  it('removes a member and revokes store access', async () => {
    await request(app)
      .delete(`/api/v1/stores/${owner.storeId}/team/${colleague.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${colleague.token}`)
      .expect(403);

    const team = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/team`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(
      team.body.data.find((m: { userId: string }) => m.userId === colleague.userId),
    ).toBeUndefined();
  });

  it('returns 404 when changing the role of a non-member', async () => {
    const outsider = await createAccount(app, { email: 'outsider@example.com' });

    await request(app)
      .put(`/api/v1/stores/${owner.storeId}/team/${randomUUID()}/role`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'viewer' })
      .expect(404);

    await request(app)
      .delete(`/api/v1/stores/${owner.storeId}/team/${outsider.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
  });

  it('records team activity and exposes notification management', async () => {
    const activity = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/activity-log?limit=50`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const actions = activity.body.data.map((entry: { action: string }) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'team.member_added',
        'team.role_changed',
        'team.invitation_sent',
        'team.invitation_accepted',
        'team.member_removed',
      ]),
    );
    expect(activity.body.meta.total).toBeGreaterThanOrEqual(5);

    const filtered = await request(app)
      .get(`/api/v1/stores/${owner.storeId}/activity-log?action=team.member_added`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);

    const unread = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${colleague.token}`)
      .expect(200);
    expect(unread.body.data.count).toBeGreaterThanOrEqual(1);

    await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${colleague.token}`)
      .expect(200);

    const after = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${colleague.token}`)
      .expect(200);
    expect(after.body.data.count).toBe(0);

    await flushAsync();
  });
});
