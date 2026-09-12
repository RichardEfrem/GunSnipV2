import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppConfig } from '../src/config/app-config.js';
import { validateEnv } from '../src/config/env.schema.js';
import { createTestApp } from './create-test-app.js';
import { newSession } from './cart-helpers.js';

/**
 * The cap on order creation (PRD §12 Security).
 *
 * The app under test is the real one with one setting changed — a limit of 2, so the third
 * request is the interesting one. Bodies are deliberately invalid: the guard runs before the
 * validation pipe and counts attempts rather than orders, so this proves the limit without
 * seeding a cart, and proves that a rejected attempt still spends from the allowance.
 */
describe('Order rate limit', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  const LIMIT = 2;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(AppConfig)
        .useValue(new AppConfig(validateEnv({ ...process.env, ORDER_RATE_LIMIT: String(LIMIT) }))),
    );
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  /** A well-formed request as far as the guard can see, and nonsense to everything after it. */
  function attempt() {
    return http
      .post('/api/v1/orders')
      .set('Cookie', newSession().cookie)
      .set('Idempotency-Key', randomUUID())
      .send({});
  }

  it('refuses the request after the limit, and says how long to wait', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await attempt().expect(400);
    }

    const refused = await attempt().expect(429);

    expect(refused.body.error.code).toBe('RATE_LIMITED');
    expect(refused.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number(refused.headers['retry-after'])).toBe(refused.body.error.details.retryAfterSeconds);
    // The one error contract the web app parses, rate limits included (DomainExceptionFilter).
    expect(refused.body.requestId).toEqual(expect.any(String));
  });

  it('keeps refusing a new session from the same address', async () => {
    // The point of bucketing by address: clearing the cookie buys nothing.
    await attempt().expect(429);
  });

  it('leaves other endpoints alone', async () => {
    await http.get('/api/v1/health').expect(200);
  });
});
