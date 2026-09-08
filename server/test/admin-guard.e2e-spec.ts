import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppConfig } from '../src/config/app-config.js';
import { createTestApp } from './create-test-app.js';

/** PRD §13.10: every admin route returns 401 without the admin key. */
describe('AdminGuard', () => {
  let app: INestApplication;
  let adminKey: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminKey = app.get(AppConfig).adminKey;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a request with no admin key', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/health').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a wrong admin key', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/health')
      .set('x-admin-key', 'not-the-key-but-long-enough')
      .expect(401);
  });

  it('rejects a key that is a prefix of the real one', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/health')
      .set('x-admin-key', adminKey.slice(0, -1))
      .expect(401);
  });

  it('admits the correct admin key and resolves an actor', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/health')
      .set('x-admin-key', adminKey)
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.actor.kind).toBe('guest');
    expect(response.body.actor.sessionId).toEqual(expect.any(String));
  });
});
