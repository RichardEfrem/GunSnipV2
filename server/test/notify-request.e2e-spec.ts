import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';

/** Back-in-stock capture on an out-of-stock product page (FR-PDP-12). */
describe('Notify requests', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let variantId: string;

  const emails: string[] = [];

  /** Unique per test, so a rerun does not collide with its own previous row. */
  function newEmail(): string {
    const email = `notify-${randomUUID()}@example.com`;
    emails.push(email);
    return email;
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { isArchived: false, product: { status: 'PUBLISHED' } },
      select: { id: true },
    });
    variantId = variant.id;
  });

  afterAll(async () => {
    await prisma.notifyRequest.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('records interest against a variant', async () => {
    const email = newEmail();

    const { body } = await http
      .post('/api/v1/notify-requests')
      .set('Cookie', `gs_session=${randomUUID()}`)
      .send({ variantId, email })
      .expect(201);

    expect(body).toEqual({ variantId, isRegistered: true });
  });

  it('stores the session and leaves user_id null (PRD §11.1)', async () => {
    const email = newEmail();
    const sessionId = randomUUID();

    await http
      .post('/api/v1/notify-requests')
      .set('Cookie', `gs_session=${sessionId}`)
      .send({ variantId, email })
      .expect(201);

    const row = await prisma.notifyRequest.findFirstOrThrow({ where: { email } });
    expect(row.sessionId).toBe(sessionId);
    // The seam: both columns exist from the first migration; Phase 1 fills the second.
    expect(row.userId).toBeNull();
  });

  it('is idempotent, and normalises case so one address is one subscriber', async () => {
    const email = newEmail();

    await http
      .post('/api/v1/notify-requests')
      .set('Cookie', `gs_session=${randomUUID()}`)
      .send({ variantId, email })
      .expect(201);

    // Asking twice is not an error, and telling the caller "you already did" would confirm
    // that the address is on the list.
    await http
      .post('/api/v1/notify-requests')
      .set('Cookie', `gs_session=${randomUUID()}`)
      .send({ variantId, email: email.toUpperCase() })
      .expect(201);

    expect(await prisma.notifyRequest.count({ where: { email } })).toBe(1);
  });

  it('rejects a malformed email', async () => {
    await http
      .post('/api/v1/notify-requests')
      .set('Cookie', `gs_session=${randomUUID()}`)
      .send({ variantId, email: 'not-an-email' })
      .expect(400);
  });

  it('404s on a variant that does not exist', async () => {
    await http
      .post('/api/v1/notify-requests')
      .set('Cookie', `gs_session=${randomUUID()}`)
      .send({ variantId: randomUUID(), email: newEmail() })
      .expect(404);
  });

  it('refuses a body that names its own session', async () => {
    await http
      .post('/api/v1/notify-requests')
      .set('Cookie', `gs_session=${randomUUID()}`)
      .send({ variantId, email: newEmail(), sessionId: randomUUID() })
      .expect(400);
  });
});
