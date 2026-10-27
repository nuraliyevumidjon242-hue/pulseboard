import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../db/client';
import { bootstrap, createAccount, refreshCookieFrom, TEST_PASSWORD } from '../../test/helpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('auth module', () => {
  let app: Express;

  beforeAll(async () => {
    app = await bootstrap();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('registers a business owner, creates a store and sets a refresh cookie', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'Owner@Example.com',
        password: TEST_PASSWORD,
        firstName: 'Mara',
        lastName: 'Vogel',
        storeName: 'Nordwind Café',
        currency: 'eur',
        timezone: 'Europe/Berlin',
      })
      .expect(201);

    expect(response.body.data.user).toMatchObject({
      email: 'owner@example.com',
      firstName: 'Mara',
      lastName: 'Vogel',
      role: 'business_owner',
    });
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.storeId).toMatch(UUID);
    expect(response.body.data.expiresIn).toBeGreaterThan(0);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const cookie = response.headers['set-cookie']?.join(';') ?? '';
    expect(cookie).toContain('pb_refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('rejects duplicate email registration', async () => {
    await createAccount(app, { email: 'duplicate@example.com' });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: TEST_PASSWORD,
        firstName: 'Dup',
        lastName: 'Licate',
      })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('returns structured validation errors for weak passwords', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'weak@example.com',
        password: 'short',
        firstName: 'Weak',
        lastName: 'Password',
      })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fields.password).toBeDefined();
    expect(response.body.error.requestId).toEqual(expect.any(String));
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    await createAccount(app, { email: 'login@example.com' });

    const ok = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'Login@Example.com', password: TEST_PASSWORD, rememberMe: true })
      .expect(200);

    expect(ok.body.data.user.email).toBe('login@example.com');
    expect(ok.body.data.accessToken).toEqual(expect.any(String));

    const denied = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPassword123' })
      .expect(401);

    expect(denied.body.error.code).toBe('UNAUTHORIZED');
    expect(denied.body.error.message).toBe('Invalid email or password');
  });

  it('returns the current user with stores and default preferences', async () => {
    const account = await createAccount(app, { email: 'me@example.com', storeName: 'Kiez Markt' });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${account.token}`)
      .expect(200);

    expect(response.body.data.user.email).toBe('me@example.com');
    expect(response.body.data.stores).toHaveLength(1);
    expect(response.body.data.stores[0]).toMatchObject({
      id: account.storeId,
      name: 'Kiez Markt',
      role: 'admin',
    });
    expect(response.body.data.preferences).toMatchObject({
      theme: 'system',
      language: 'en',
      autoRefreshInterval: 30,
      notificationsEnabled: true,
    });
  });

  it('rotates refresh tokens and revokes every session when a token is reused', async () => {
    await createAccount(app, { email: 'rotate@example.com' });

    const session = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rotate@example.com', password: TEST_PASSWORD })
      .expect(200);

    const firstCookie = refreshCookieFrom(session);

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);

    const secondCookie = refreshCookieFrom(rotated);
    expect(rotated.body.data.accessToken).toEqual(expect.any(String));
    expect(secondCookie).not.toBe(firstCookie);

    // Replaying the revoked token must fail and must revoke the whole family.
    await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie).expect(401);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', secondCookie).expect(401);
  });

  it('logs out and revokes the refresh session', async () => {
    await createAccount(app, { email: 'logout@example.com' });

    const session = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'logout@example.com', password: TEST_PASSWORD })
      .expect(200);
    const cookie = refreshCookieFrom(session);

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);

    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('updates the authenticated profile', async () => {
    const account = await createAccount(app, { email: 'profile@example.com' });

    const updated = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ firstName: 'Lena', lastName: 'Fischer', phone: '+49 30 1234567' })
      .expect(200);

    expect(updated.body.data.user).toMatchObject({
      firstName: 'Lena',
      lastName: 'Fischer',
      phone: '+49 30 1234567',
    });

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${account.token}`)
      .expect(200);
    expect(me.body.data.user.firstName).toBe('Lena');
  });

  it('changes the password and invalidates the old credentials', async () => {
    const account = await createAccount(app, { email: 'change@example.com' });
    const newPassword = 'BrandNewPassw0rd!';

    await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'change@example.com', password: TEST_PASSWORD })
      .expect(401);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'change@example.com', password: newPassword })
      .expect(200);
    expect(loginResponse.body.data.accessToken).toEqual(expect.any(String));
  });

  it('resets a forgotten password exactly once', async () => {
    await createAccount(app, { email: 'reset@example.com' });

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(200);

    const token = forgot.body.data.devToken as string;
    expect(token).toEqual(expect.any(String));

    const newPassword = 'ResetPassw0rd!2026';
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: newPassword })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.com', password: TEST_PASSWORD })
      .expect(401);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.com', password: newPassword })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'AnotherPassw0rd!1' })
      .expect(401);
  });
});
