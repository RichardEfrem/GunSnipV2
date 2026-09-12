import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_QUANTITY_PER_LINE } from '@gunsnip/shared';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { addToCart, buildTools, newSession } from './cart-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * The cart, against the seeded test database (FR-PDP-07, FR-PDP-08, FR-CART-01 … FR-CART-05).
 */
describe('Cart', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;

  /** The cheapest regular rate in the seed — Jabodetabek, Rp 15.000. */
  const SHIPPING_ESTIMATE_IDR = 15_000;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('adding', () => {
    it('starts empty without creating a row (a read must not write)', async () => {
      const session = newSession();
      const { body } = await http.get('/api/v1/cart').set('Cookie', session.cookie).expect(200);

      expect(body.lines).toEqual([]);
      expect(body.voucher).toBeNull();
      expect(body.totals).toEqual({
        subtotalIdr: 0,
        discountIdr: 0,
        shippingIdr: 0,
        totalIdr: 0,
        lineCount: 0,
        selectedQuantity: 0,
      });

      expect(await prisma.cart.count({ where: { sessionId: session.sessionId } })).toBe(0);
    });

    it('puts a nipper and a panel liner in the cart in one action (DoD §13.3)', async () => {
      const session = newSession();
      const { nipper, liner } = await buildTools(http);

      const { body } = await addToCart(http, session, [
        { variantId: nipper, quantity: 1 },
        { variantId: liner, quantity: 1 },
      ]);

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
      const session = newSession();
      const { nipper } = await buildTools(http);

      await addToCart(http, session, [{ variantId: nipper, quantity: 2 }]);

      // A second, entirely separate request carrying only the cookie.
      const { body } = await http.get('/api/v1/cart').set('Cookie', session.cookie).expect(200);

      expect(body.lines).toHaveLength(1);
      expect(body.lines[0].quantity).toBe(2);
    });

    it('keeps one session’s cart invisible to another', async () => {
      const { nipper } = await buildTools(http);

      await addToCart(http, newSession(), [{ variantId: nipper, quantity: 1 }]);

      const { body } = await http.get('/api/v1/cart').set('Cookie', newSession().cookie).expect(200);
      expect(body.lines).toEqual([]);
    });

    it('adds to an existing line rather than creating a second one for the same variant', async () => {
      const session = newSession();
      const { nipper } = await buildTools(http);

      await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);
      const { body } = await addToCart(http, session, [{ variantId: nipper, quantity: 2 }]);

      expect(body.lines).toHaveLength(1);
      expect(body.lines[0].quantity).toBe(3);
    });

    it('folds a request naming the same variant twice into one line', async () => {
      const { nipper } = await buildTools(http);

      const { body } = await addToCart(http, newSession(), [
        { variantId: nipper, quantity: 1 },
        { variantId: nipper, quantity: 1 },
      ]);

      expect(body.lines).toHaveLength(1);
      expect(body.lines[0].quantity).toBe(2);
    });

    it('prices the line from the database, never from the request (non-negotiable #2)', async () => {
      const session = newSession();
      const { nipper } = await buildTools(http);

      // `forbidNonWhitelisted` means an attempt to send a price is rejected outright rather than
      // quietly ignored — the strongest form of "the client cannot name a price".
      await http
        .post('/api/v1/cart/items')
        .set('Cookie', session.cookie)
        .send({ items: [{ variantId: nipper, quantity: 1, priceIdr: 1 }] })
        .expect(400);

      const { body } = await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: nipper } });
      expect(body.lines[0].unitPriceIdr).toBe(variant.priceIdr);
    });

    it('rejects a quantity over the per-order cap (FR-PDP-06)', async () => {
      const { nipper } = await buildTools(http);

      await http
        .post('/api/v1/cart/items')
        .set('Cookie', newSession().cookie)
        .send({ items: [{ variantId: nipper, quantity: MAX_QUANTITY_PER_LINE + 1 }] })
        .expect(400);
    });

    it('404s on a variant that does not exist', async () => {
      const { body } = await http
        .post('/api/v1/cart/items')
        .set('Cookie', newSession().cookie)
        .send({ items: [{ variantId: randomUUID(), quantity: 1 }] })
        .expect(404);

      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('adds nothing at all when one item of a batch is bad (FR-PDP-08 is one action)', async () => {
      const session = newSession();
      const { nipper } = await buildTools(http);

      await http
        .post('/api/v1/cart/items')
        .set('Cookie', session.cookie)
        .send({
          items: [
            { variantId: nipper, quantity: 1 },
            { variantId: randomUUID(), quantity: 1 },
          ],
        })
        .expect(404);

      // The good half must not have landed — a half-filled cart is the failure this prevents.
      const { body } = await http.get('/api/v1/cart').set('Cookie', session.cookie).expect(200);
      expect(body.lines).toEqual([]);
    });

    it('rejects an empty batch', async () => {
      await http.post('/api/v1/cart/items').set('Cookie', newSession().cookie).send({ items: [] }).expect(400);
    });
  });

  describe('editing a line (FR-CART-02)', () => {
    it('changes the quantity and reprices the line and the total', async () => {
      const session = newSession();
      const { nipper } = await buildTools(http);
      const { body: added } = await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

      const { body } = await http
        .patch(`/api/v1/cart/items/${added.lines[0].id}`)
        .set('Cookie', session.cookie)
        .send({ quantity: 3 })
        .expect(200);

      expect(body.lines[0].quantity).toBe(3);
      expect(body.lines[0].lineTotalIdr).toBe(body.lines[0].unitPriceIdr * 3);
      expect(body.totals.subtotalIdr).toBe(body.lines[0].lineTotalIdr);
    });

    it('refuses more than is in stock, and says how many are left', async () => {
      const session = newSession();
      const { liner } = await buildTools(http);
      const { body: added } = await addToCart(http, session, [{ variantId: liner, quantity: 1 }]);

      // The seed holds more liners than the per-line cap, so stock is lowered to make "too many"
      // reachable, and put back afterwards for the specs that follow.
      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: liner } });
      await prisma.productVariant.update({
        where: { id: liner },
        data: { stockOnHand: variant.stockReserved + 2 },
      });

      try {
        const { body } = await http
          .patch(`/api/v1/cart/items/${added.lines[0].id}`)
          .set('Cookie', session.cookie)
          .send({ quantity: 3 })
          .expect(409);

        expect(body.error.message).toMatch(/^Only 2 of .+ left\.$/);
      } finally {
        await prisma.productVariant.update({ where: { id: liner }, data: { stockOnHand: variant.stockOnHand } });
      }
    });

    it('removes a line', async () => {
      const session = newSession();
      const { nipper, liner } = await buildTools(http);
      const { body: added } = await addToCart(http, session, [
        { variantId: nipper, quantity: 1 },
        { variantId: liner, quantity: 1 },
      ]);
      const nipperLine = added.lines.find((line: { variantId: string }) => line.variantId === nipper);

      const { body } = await http
        .delete(`/api/v1/cart/items/${nipperLine.id}`)
        .set('Cookie', session.cookie)
        .expect(200);

      expect(body.lines.map((line: { variantId: string }) => line.variantId)).toEqual([liner]);
    });

    it('rejects an empty change rather than treating it as a no-op', async () => {
      const session = newSession();
      const { nipper } = await buildTools(http);
      const { body: added } = await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

      await http
        .patch(`/api/v1/cart/items/${added.lines[0].id}`)
        .set('Cookie', session.cookie)
        .send({})
        .expect(400);
    });

    it('rejects a zero quantity — removing is DELETE', async () => {
      const session = newSession();
      const { nipper } = await buildTools(http);
      const { body: added } = await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

      await http
        .patch(`/api/v1/cart/items/${added.lines[0].id}`)
        .set('Cookie', session.cookie)
        .send({ quantity: 0 })
        .expect(400);
    });

    it('will not let one session edit or delete another’s line', async () => {
      const owner = newSession();
      const intruder = newSession();
      const { nipper } = await buildTools(http);
      const { body: added } = await addToCart(http, owner, [{ variantId: nipper, quantity: 1 }]);
      const lineId = added.lines[0].id;

      await http.patch(`/api/v1/cart/items/${lineId}`).set('Cookie', intruder.cookie).send({ quantity: 5 }).expect(404);
      await http.delete(`/api/v1/cart/items/${lineId}`).set('Cookie', intruder.cookie).expect(404);

      const { body } = await http.get('/api/v1/cart').set('Cookie', owner.cookie).expect(200);
      expect(body.lines[0].quantity).toBe(1);
    });

    it('400s on a line id that is not a UUID', async () => {
      await http.patch('/api/v1/cart/items/not-a-uuid').set('Cookie', newSession().cookie).send({ quantity: 1 }).expect(400);
    });
  });

  describe('selection (FR-CART-03)', () => {
    it('drops a deselected line from the total and keeps it in the cart (DoD §13.4)', async () => {
      const session = newSession();
      const { nipper, liner } = await buildTools(http);
      const { body: added } = await addToCart(http, session, [
        { variantId: nipper, quantity: 1 },
        { variantId: liner, quantity: 1 },
      ]);
      const nipperLine = added.lines.find((line: { variantId: string }) => line.variantId === nipper);

      const { body } = await http
        .patch(`/api/v1/cart/items/${nipperLine.id}`)
        .set('Cookie', session.cookie)
        .send({ isSelected: false })
        .expect(200);

      const liner$ = body.lines.find((line: { variantId: string }) => line.variantId === liner);
      expect(body.totals.subtotalIdr).toBe(liner$.lineTotalIdr);
      expect(body.totals.lineCount).toBe(2);
      expect(body.totals.selectedQuantity).toBe(1);
    });

    it('selects and deselects every line at once', async () => {
      const session = newSession();
      const { nipper, liner } = await buildTools(http);
      await addToCart(http, session, [
        { variantId: nipper, quantity: 1 },
        { variantId: liner, quantity: 1 },
      ]);

      const { body: none } = await http
        .patch('/api/v1/cart/items')
        .set('Cookie', session.cookie)
        .send({ isSelected: false })
        .expect(200);

      expect(none.lines.every((line: { isSelected: boolean }) => !line.isSelected)).toBe(true);
      expect(none.totals).toMatchObject({ subtotalIdr: 0, shippingIdr: 0, totalIdr: 0, lineCount: 2 });

      const { body: all } = await http
        .patch('/api/v1/cart/items')
        .set('Cookie', session.cookie)
        .send({ isSelected: true })
        .expect(200);

      expect(all.totals.selectedQuantity).toBe(2);
    });

    it('deletes only the selected lines', async () => {
      const session = newSession();
      const { nipper, liner } = await buildTools(http);
      const { body: added } = await addToCart(http, session, [
        { variantId: nipper, quantity: 1 },
        { variantId: liner, quantity: 1 },
      ]);
      const linerLine = added.lines.find((line: { variantId: string }) => line.variantId === liner);

      await http
        .patch(`/api/v1/cart/items/${linerLine.id}`)
        .set('Cookie', session.cookie)
        .send({ isSelected: false })
        .expect(200);

      const { body } = await http.delete('/api/v1/cart/items/selected').set('Cookie', session.cookie).expect(200);

      expect(body.lines.map((line: { variantId: string }) => line.variantId)).toEqual([liner]);
    });
  });

  describe('summary (FR-CART-05)', () => {
    it('adds the shipping estimate to the total once something is selected', async () => {
      const session = newSession();
      const { nipper } = await buildTools(http);

      const { body } = await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

      expect(body.shippingEstimate).toMatchObject({ zone: 'JABODETABEK', tier: 'REGULAR' });
      expect(body.totals.shippingIdr).toBe(SHIPPING_ESTIMATE_IDR);
      expect(body.totals.totalIdr).toBe(body.totals.subtotalIdr + SHIPPING_ESTIMATE_IDR);
    });
  });
});
