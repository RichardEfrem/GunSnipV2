import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_QUANTITY_PER_LINE } from '@gunsnip/shared';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';

/**
 * The cart, against the seeded database (FR-PDP-07, FR-PDP-08, FR-CART-01, FR-CART-03).
 *
 * Every test invents its own `gs_session` cookie, so carts are isolated from each other and
 * from anything already in the database — the alternative is a shared cart whose contents
 * depend on test order. The sessions it creates are deleted afterwards.
 */
describe('Cart', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;

  const sessions: string[] = [];

  /** A fresh guest. Returns the cookie header to send. */
  function newSession(): string {
    const sessionId = randomUUID();
    sessions.push(sessionId);
    return `gs_session=${sessionId}`;
  }

  /** Two tools a Master Grade kit requires: a nipper and a panel liner (DoD §13.3). */
  async function buildTools(): Promise<{ nipper: string; liner: string }> {
    const { body } = await http
      .get('/api/v1/products/mg-1-100-nu-gundam-verka/requirements')
      .expect(200);

    const find = (needle: RegExp): string => {
      const match = body.find((requirement: { tool: { name: string } }) =>
        needle.test(requirement.tool.name),
      );
      expect(match, `no seeded tool matching ${needle}`).toBeDefined();
      return match.variantId;
    };

    return { nipper: find(/cutter/i), liner: find(/panel line/i) };
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Carts cascade to their items.
    await prisma.cart.deleteMany({ where: { sessionId: { in: sessions } } });
    await app.close();
  });

  it('starts empty without creating a row (a read must not write)', async () => {
    const cookie = newSession();
    const { body } = await http.get('/api/v1/cart').set('Cookie', cookie).expect(200);

    expect(body.lines).toEqual([]);
    expect(body.totals).toEqual({ subtotalIdr: 0, lineCount: 0, selectedQuantity: 0 });

    const sessionId = cookie.split('=')[1] ?? '';
    expect(await prisma.cart.count({ where: { sessionId } })).toBe(0);
  });

  it('puts a nipper and a panel liner in the cart in one action (DoD §13.3)', async () => {
    const cookie = newSession();
    const { nipper, liner } = await buildTools();

    const { body } = await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({
        items: [
          { variantId: nipper, quantity: 1 },
          { variantId: liner, quantity: 1 },
        ],
      })
      .expect(201);

    expect(body.lines).toHaveLength(2);
    expect(body.totals.lineCount).toBe(2);
    expect(body.totals.selectedQuantity).toBe(2);

    // The subtotal is the sum of what the server priced, not of anything the client sent.
    const summed = body.lines.reduce(
      (total: number, line: { lineTotalIdr: number }) => total + line.lineTotalIdr,
      0,
    );
    expect(body.totals.subtotalIdr).toBe(summed);
  });

  it('persists across requests, which is what survives a browser restart (FR-CART-01)', async () => {
    const cookie = newSession();
    const { nipper } = await buildTools();

    await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ items: [{ variantId: nipper, quantity: 2 }] })
      .expect(201);

    // A second, entirely separate request carrying only the cookie.
    const { body } = await http.get('/api/v1/cart').set('Cookie', cookie).expect(200);

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].quantity).toBe(2);
  });

  it('keeps one session’s cart invisible to another', async () => {
    const mine = newSession();
    const theirs = newSession();
    const { nipper } = await buildTools();

    await http
      .post('/api/v1/cart/items')
      .set('Cookie', mine)
      .send({ items: [{ variantId: nipper, quantity: 1 }] })
      .expect(201);

    const { body } = await http.get('/api/v1/cart').set('Cookie', theirs).expect(200);
    expect(body.lines).toEqual([]);
  });

  it('adds to an existing line rather than creating a second one for the same variant', async () => {
    const cookie = newSession();
    const { nipper } = await buildTools();

    await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ items: [{ variantId: nipper, quantity: 1 }] })
      .expect(201);

    const { body } = await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ items: [{ variantId: nipper, quantity: 2 }] })
      .expect(201);

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].quantity).toBe(3);
  });

  it('folds a request naming the same variant twice into one line', async () => {
    const cookie = newSession();
    const { nipper } = await buildTools();

    const { body } = await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({
        items: [
          { variantId: nipper, quantity: 1 },
          { variantId: nipper, quantity: 1 },
        ],
      })
      .expect(201);

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].quantity).toBe(2);
  });

  it('prices the line from the database, never from the request (non-negotiable #2)', async () => {
    const cookie = newSession();
    const { nipper } = await buildTools();

    // `forbidNonWhitelisted` means an attempt to send a price is rejected outright rather than
    // quietly ignored — the strongest form of "the client cannot name a price".
    await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ items: [{ variantId: nipper, quantity: 1, priceIdr: 1 }] })
      .expect(400);

    const { body } = await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ items: [{ variantId: nipper, quantity: 1 }] })
      .expect(201);

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: nipper } });
    expect(body.lines[0].unitPriceIdr).toBe(variant.priceIdr);
  });

  it('rejects a quantity over the per-order cap (FR-PDP-06)', async () => {
    const cookie = newSession();
    const { nipper } = await buildTools();

    await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ items: [{ variantId: nipper, quantity: MAX_QUANTITY_PER_LINE + 1 }] })
      .expect(400);
  });

  it('404s on a variant that does not exist', async () => {
    const cookie = newSession();

    const { body } = await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ items: [{ variantId: randomUUID(), quantity: 1 }] })
      .expect(404);

    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('adds nothing at all when one item of a batch is bad (FR-PDP-08 is one action)', async () => {
    const cookie = newSession();
    const { nipper } = await buildTools();

    await http
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({
        items: [
          { variantId: nipper, quantity: 1 },
          { variantId: randomUUID(), quantity: 1 },
        ],
      })
      .expect(404);

    // The good half must not have landed — a half-filled cart is the failure this prevents.
    const { body } = await http.get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(body.lines).toEqual([]);
  });

  it('rejects an empty batch', async () => {
    await http
      .post('/api/v1/cart/items')
      .set('Cookie', newSession())
      .send({ items: [] })
      .expect(400);
  });
});
