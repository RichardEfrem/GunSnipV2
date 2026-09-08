import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './create-test-app.js';

describe('Health and request plumbing', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the database as reachable', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('mints a gs_session cookie for a caller that has none', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const session = cookies.find((cookie) => cookie.startsWith('gs_session='));

    expect(session).toBeDefined();
    expect(session).toContain('HttpOnly');
    expect(session).toContain('SameSite=Lax');
  });

  it('keeps the session cookie a caller already has', async () => {
    const sessionId = '0f6a4a3e-7a5c-4b8e-9f2d-1c3b5a7d9e11';

    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Cookie', `gs_session=${sessionId}`)
      .expect(200);

    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('echoes a caller-supplied request id and invents one otherwise', async () => {
    const supplied = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'trace-abc-123')
      .expect(200);

    expect(supplied.headers['x-request-id']).toBe('trace-abc-123');

    const invented = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(invented.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers an unknown route in the standard error shape', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.path).toBe('/api/v1/nope');
    expect(response.body.requestId).toEqual(expect.any(String));
  });
});
