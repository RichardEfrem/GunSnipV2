import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ORDER_NUMBER_PATTERN } from '@gunsnip/shared';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { addToCart, buildTools, masterGradeKit, newSession, type GuestSession } from './cart-helpers.js';
import { jakartaDistrict, orderBodyFrom, papuaCity, placeOrder, quote, regionPath } from './checkout-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * The whole checkout path against a real database (CLAUDE.md Testing: "integration test the full
 * checkout path against a real test database"; PLAN Phase 7 exit; DoD §13.5, §13.6).
 *
 * Browse data comes from the seed; every order is placed the way the storefront places it — quote,
 * then send the quote's lines and total back with an `Idempotency-Key`. Specs that squeeze a
 * variant's stock or move its price put it back before they finish, so later specs see the seed.
 */
describe('Checkout', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let jakarta: string;

  /** The seeded Jabodetabek regular rate. */
  const JAKARTA_REGULAR_IDR = 15_000;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    jakarta = await jakartaDistrict(http);
  });

  afterAll(async () => {
    await app.close();
  });

  async function stockOf(variantId: string) {
    return prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stockOnHand: true, stockReserved: true, priceIdr: true },
    });
  }

  /** A session with these lines in its cart, and the quote checkout would show it for Jakarta. */
  async function readyToOrder(items: { variantId: string; quantity: number }[], regionId = jakarta) {
    const session = newSession();
    await addToCart(http, session, items);
    const { body } = await quote(http, session, { regionId, shippingTier: 'REGULAR' }).expect(200);
    return { session, quoted: body };
  }

  describe('shipping (FR-CO-03, FR-CO-04)', () => {
    it('lists all 38 provinces, then a province’s cities, then a city’s districts', async () => {
      const { body: provinces } = await http.get('/api/v1/shipping/regions').expect(200);
      expect(provinces).toHaveLength(38);
      expect(provinces[0]).toMatchObject({ level: 'PROVINCE', hasChildren: true });

      const [, city, district] = await regionPath(http, 'DKI Jakarta', 'Jakarta Selatan', 'Kebayoran Baru');
      expect(city).toMatchObject({ hasChildren: true });
      expect(district).toMatchObject({ hasChildren: false });
    });

    it('offers same-day only in Jabodetabek, cheapest tier first', async () => {
      const { body: jakartaQuote } = await http.post('/api/v1/shipping/quote').send({ regionId: jakarta }).expect(200);
      expect(jakartaQuote.zone).toBe('JABODETABEK');
      expect(jakartaQuote.options.map((option: { tier: string }) => option.tier)).toEqual([
        'REGULAR',
        'EXPRESS',
        'SAME_DAY',
      ]);

      const { body: papuaQuote } = await http
        .post('/api/v1/shipping/quote')
        .send({ regionId: await papuaCity(http) })
        .expect(200);
      expect(papuaQuote).toMatchObject({ zone: 'MALUKU_PAPUA', options: [{ tier: 'REGULAR', priceIdr: 75_000 }, { tier: 'EXPRESS' }] });
    });

    it('404s a region that does not exist', async () => {
      await http.post('/api/v1/shipping/quote').send({ regionId: randomUUID() }).expect(404);
    });
  });

  describe('the checkout quote (FR-CO-05)', () => {
    it('prices the selected lines for the address and tier, and only those', async () => {
      const { nipper, liner } = await buildTools(http);
      const session = newSession();
      const { body: cart } = await addToCart(http, session, [
        { variantId: nipper, quantity: 1 },
        { variantId: liner, quantity: 2 },
      ]);
      const linerLine = cart.lines.find((line: { variantId: string }) => line.variantId === liner);
      await http.patch(`/api/v1/cart/items/${linerLine.id}`).set('Cookie', session.cookie).send({ isSelected: false });

      const { body } = await quote(http, session, { regionId: jakarta, shippingTier: 'EXPRESS' }).expect(200);

      expect(body.lines.map((line: { variantId: string }) => line.variantId)).toEqual([nipper]);
      expect(body.delivery).toMatchObject({ isComplete: true, selected: { tier: 'EXPRESS', priceIdr: 30_000 } });
      expect(body.totals).toEqual({
        subtotalIdr: 385_000,
        discountIdr: 0,
        shippingIdr: 30_000,
        totalIdr: 415_000,
        itemCount: 1,
      });
    });

    it('falls back to the cheapest tier when the zone does not offer the one asked for', async () => {
      const { nipper } = await buildTools(http);
      const session = newSession();
      await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

      const { body } = await quote(http, session, { regionId: await papuaCity(http), shippingTier: 'SAME_DAY' });

      expect(body.delivery.selected).toMatchObject({ tier: 'REGULAR', priceIdr: 75_000 });
      expect(body.totals.shippingIdr).toBe(75_000);
    });

    it('quotes no shipping before an address, and marks a province as not yet shippable', async () => {
      const { nipper } = await buildTools(http);
      const session = newSession();
      await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

      const { body: bare } = await quote(http, session).expect(200);
      expect(bare.delivery).toBeNull();
      expect(bare.totals.shippingIdr).toBe(0);

      const [province] = await regionPath(http, 'Jawa Barat');
      const { body: partial } = await quote(http, session, { regionId: province?.id }).expect(200);
      expect(partial.delivery).toMatchObject({ isComplete: false, zone: 'JAVA', selected: { tier: 'REGULAR' } });
    });
  });

  describe('placing an order (FR-CO-07, FR-CO-08, DoD §13.5)', () => {
    it('creates a GS- order with snapshots, a first event, a payment, and reserved stock', async () => {
      const kit = await masterGradeKit(http);
      const before = await stockOf(kit);
      const { session, quoted } = await readyToOrder([{ variantId: kit, quantity: 2 }]);

      const { body: order } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);

      expect(order.orderNumber).toMatch(ORDER_NUMBER_PATTERN);
      expect(order).toMatchObject({
        status: 'PENDING_PAYMENT',
        canCancel: true,
        totals: {
          subtotalIdr: 2 * before.priceIdr,
          discountIdr: 0,
          shippingIdr: JAKARTA_REGULAR_IDR,
          totalIdr: 2 * before.priceIdr + JAKARTA_REGULAR_IDR,
        },
        // Normalised at the boundary: trimmed, lower-cased, separators stripped.
        contact: { name: 'Amuro Ray', email: 'amuro@example.com', phone: '081234567890' },
        address: {
          street: 'Jl. Senopati No. 79',
          district: 'Kebayoran Baru',
          city: 'Jakarta Selatan',
          province: 'DKI Jakarta',
          postalCode: '12110',
          notes: 'Leave with security',
        },
        delivery: { tier: 'REGULAR', minDays: 1, maxDays: 2 },
        payment: { method: 'VIRTUAL_ACCOUNT', status: 'PENDING', amountIdr: 2 * before.priceIdr + JAKARTA_REGULAR_IDR },
        timeline: [{ status: 'PENDING_PAYMENT', note: 'Order placed.' }],
      });
      expect(order.items).toEqual([
        expect.objectContaining({ productName: 'MG 1/100 Gundam Exia', quantity: 2, unitPriceIdr: before.priceIdr }),
      ]);

      // Reserved, not sold: on hand is untouched and availability drops at once (DoD §13.6).
      const after = await stockOf(kit);
      expect(after.stockReserved).toBe(before.stockReserved + 2);
      expect(after.stockOnHand).toBe(before.stockOnHand);

      const { body: product } = await http.get('/api/v1/products/mg-1-100-gundam-exia').expect(200);
      expect(product.variants[0].availableQuantity).toBe(before.stockOnHand - before.stockReserved - 2);

      // The ordered line has left the cart.
      const { body: cart } = await http.get('/api/v1/cart').set('Cookie', session.cookie).expect(200);
      expect(cart.lines).toEqual([]);

      const events = await prisma.orderEvent.findMany({ where: { order: { orderNumber: order.orderNumber } } });
      expect(events).toEqual([
        expect.objectContaining({ fromStatus: null, toStatus: 'PENDING_PAYMENT', actorKind: 'GUEST', actorId: session.sessionId }),
      ]);
    });

    it('snapshots the line, so a later price change never reaches the order (FR-ORD-05)', async () => {
      const { nipper } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }]);
      const { body: order } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);
      const original = await stockOf(nipper);

      await prisma.productVariant.update({ where: { id: nipper }, data: { priceIdr: 1 } });
      try {
        const { body: reread } = await http.get(`/api/v1/orders/${order.orderNumber}`).set('Cookie', session.cookie).expect(200);
        expect(reread.items[0].unitPriceIdr).toBe(original.priceIdr);
      } finally {
        await prisma.productVariant.update({ where: { id: nipper }, data: { priceIdr: original.priceIdr } });
      }
    });

    it('answers a repeated request with the same order, not a second one (FR-CO-07)', async () => {
      const { liner } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: liner, quantity: 1 }]);
      const body = orderBodyFrom(quoted, jakarta);
      const key = randomUUID();

      const first = await placeOrder(http, session, body, key).expect(201);
      const second = await placeOrder(http, session, body, key).expect(201);

      expect(second.body.orderNumber).toBe(first.body.orderNumber);
      expect(await prisma.order.count({ where: { sessionId: session.sessionId } })).toBe(1);
    });

    it('turns a double-click — two concurrent submits — into one order (DoD §13.5)', async () => {
      const kit = await masterGradeKit(http);
      const before = await stockOf(kit);
      const { session, quoted } = await readyToOrder([{ variantId: kit, quantity: 1 }]);
      const body = orderBodyFrom(quoted, jakarta);
      const key = randomUUID();

      const responses = await Promise.all([placeOrder(http, session, body, key), placeOrder(http, session, body, key)]);

      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(responses[1]?.body.orderNumber).toBe(responses[0]?.body.orderNumber);
      expect(await prisma.order.count({ where: { sessionId: session.sessionId } })).toBe(1);
      // Reserved once.
      expect((await stockOf(kit)).stockReserved).toBe(before.stockReserved + 1);
    });

    it('refuses a key reused with a different body, or by another session', async () => {
      const { nipper } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }]);
      const body = orderBodyFrom(quoted, jakarta);
      const key = randomUUID();
      await placeOrder(http, session, body, key).expect(201);

      const changed = await placeOrder(http, session, { ...body, paymentMethod: 'E_WALLET' }, key).expect(409);
      expect(changed.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');

      const stranger = await placeOrder(http, newSession(), body, key).expect(409);
      expect(stranger.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('requires an Idempotency-Key', async () => {
      const { nipper } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }]);

      const { body } = await http
        .post('/api/v1/orders')
        .set('Cookie', session.cookie)
        .send(orderBodyFrom(quoted, jakarta))
        .expect(400);

      expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('names the line that ran short, and writes nothing (FR-CO-08)', async () => {
      const kit = await masterGradeKit(http);
      const { session, quoted } = await readyToOrder([{ variantId: kit, quantity: 3 }]);
      const original = await stockOf(kit);
      const key = randomUUID();

      // Someone else takes all but one between the summary and the click.
      await prisma.productVariant.update({
        where: { id: kit },
        data: { stockReserved: original.stockOnHand - 1 },
      });

      try {
        const { body } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta), key).expect(409);

        expect(body.error).toMatchObject({
          code: 'INSUFFICIENT_STOCK',
          message: 'Only 1 of MG 1/100 Gundam Exia left.',
          details: { variantId: kit, requested: 3, available: 1 },
        });

        // Rolled back whole: no order, no reservation, no key — a retry is a fresh attempt.
        expect(await prisma.order.count({ where: { sessionId: session.sessionId } })).toBe(0);
        expect((await stockOf(kit)).stockReserved).toBe(original.stockOnHand - 1);
        expect(await prisma.idempotencyKey.count({ where: { key } })).toBe(0);
      } finally {
        await prisma.productVariant.update({ where: { id: kit }, data: { stockReserved: original.stockReserved } });
      }
    });

    it('sells the last unit exactly once when two customers race for it (PRD §8.3)', async () => {
      const kit = await masterGradeKit(http);
      const original = await stockOf(kit);
      const first = await readyToOrder([{ variantId: kit, quantity: 1 }]);
      const second = await readyToOrder([{ variantId: kit, quantity: 1 }]);

      await prisma.productVariant.update({ where: { id: kit }, data: { stockReserved: original.stockOnHand - 1 } });

      try {
        const responses = await Promise.all([
          placeOrder(http, first.session, orderBodyFrom(first.quoted, jakarta)),
          placeOrder(http, second.session, orderBodyFrom(second.quoted, jakarta)),
        ]);

        expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
        expect(responses.find((response) => response.status === 409)?.body.error.code).toBe('INSUFFICIENT_STOCK');
        expect((await stockOf(kit)).stockReserved).toBe(original.stockOnHand);
      } finally {
        await prisma.productVariant.update({ where: { id: kit }, data: { stockReserved: original.stockReserved } });
      }
    });

    it('stops rather than charging a total the customer was not shown', async () => {
      const { nipper } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }]);
      const original = await stockOf(nipper);

      await prisma.productVariant.update({ where: { id: nipper }, data: { priceIdr: original.priceIdr + 10_000 } });
      try {
        const { body } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(409);

        expect(body.error).toMatchObject({
          code: 'TOTAL_CHANGED',
          details: { expectedTotalIdr: quoted.totals.totalIdr, totalIdr: quoted.totals.totalIdr + 10_000 },
        });
      } finally {
        await prisma.productVariant.update({ where: { id: nipper }, data: { priceIdr: original.priceIdr } });
      }
    });

    it('never reads a price from the request — a zero total is refused, not charged', async () => {
      const { nipper } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }]);

      const { body } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta, { expectedTotalIdr: 0 })).expect(409);
      expect(body.error.code).toBe('TOTAL_CHANGED');
    });

    it('refuses a line that is not in the cart', async () => {
      const { nipper } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }]);

      // A cart line id this session does not own. Lines are named by cart line rather than by
      // variant (FR-CAT-11 lets one variant be in the cart twice), so this is what "a line that
      // is not in the cart" now looks like.
      const body = orderBodyFrom(quoted, jakarta, { items: [{ cartLineId: randomUUID(), quantity: 1 }] });
      expect((await placeOrder(http, session, body).expect(409)).body.error.code).toBe('CART_CHANGED');
    });

    it('asks for a district when only the city was chosen', async () => {
      const { nipper } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }]);
      const [, city] = await regionPath(http, 'DKI Jakarta', 'Jakarta Selatan');

      const { body } = await placeOrder(http, session, orderBodyFrom(quoted, city?.id ?? '')).expect(400);
      expect(body.error.message).toBe('Choose a district for the delivery address.');
    });

    it('refuses a tier the address is not offered', async () => {
      const { nipper } = await buildTools(http);
      const papua = await papuaCity(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }], papua);

      await placeOrder(http, session, orderBodyFrom(quoted, papua, { shippingTier: 'SAME_DAY' })).expect(400);
    });

    it('rejects a malformed body before it reaches the service', async () => {
      const { nipper } = await buildTools(http);
      const { session, quoted } = await readyToOrder([{ variantId: nipper, quantity: 1 }]);
      const body = orderBodyFrom(quoted, jakarta);

      await placeOrder(http, session, { ...body, contact: { ...body.contact, phone: '12345' } }).expect(400);
      await placeOrder(http, session, { ...body, address: { ...body.address, postalCode: 'ABC' } }).expect(400);
      await placeOrder(http, session, { ...body, items: [] }).expect(400);
    });

    it('redeems the cart’s voucher and takes it off the cart (FR-PROMO-05)', async () => {
      const kit = await masterGradeKit(http);
      const session = newSession();
      await addToCart(http, session, [{ variantId: kit, quantity: 1 }]);
      await http.post('/api/v1/cart/voucher').set('Cookie', session.cookie).send({ code: 'WELCOME10' }).expect(200);
      const usedBefore = (await prisma.voucher.findUniqueOrThrow({ where: { code: 'WELCOME10' } })).usedCount;

      const { body: quoted } = await quote(http, session, { regionId: jakarta, shippingTier: 'REGULAR' }).expect(200);
      expect(quoted.voucher).toMatchObject({ code: 'WELCOME10', isApplied: true, discountIdr: 78_500 });

      const { body: order } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);

      expect(order).toMatchObject({ voucherCode: 'WELCOME10', totals: { discountIdr: 78_500 } });
      expect((await prisma.voucher.findUniqueOrThrow({ where: { code: 'WELCOME10' } })).usedCount).toBe(usedBefore + 1);
      expect(await prisma.cart.findFirst({ where: { sessionId: session.sessionId }, select: { voucherId: true } })).toEqual({
        voucherId: null,
      });
    });
  });

  describe('lookup and cancellation (FR-ORD-02, FR-ORD-04, DoD §13.6)', () => {
    async function placed(): Promise<{ session: GuestSession; orderNumber: string; variantId: string }> {
      const kit = await masterGradeKit(http);
      const { session, quoted } = await readyToOrder([{ variantId: kit, quantity: 2 }]);
      const { body } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);
      return { session, orderNumber: body.orderNumber, variantId: kit };
    }

    it('shows the order to its session, and to anyone with its email', async () => {
      const { session, orderNumber } = await placed();

      await http.get(`/api/v1/orders/${orderNumber}`).set('Cookie', session.cookie).expect(200);

      const stranger = newSession();
      await http.get(`/api/v1/orders/${orderNumber.toLowerCase()}`).set('Cookie', stranger.cookie).query({ email: 'AMURO@example.com' }).expect(200);
    });

    it('404s a stranger with the wrong email or none, exactly as for a missing order', async () => {
      const { orderNumber } = await placed();
      const stranger = newSession();

      const wrong = await http.get(`/api/v1/orders/${orderNumber}`).set('Cookie', stranger.cookie).query({ email: 'char@example.com' }).expect(404);
      const none = await http.get(`/api/v1/orders/${orderNumber}`).set('Cookie', stranger.cookie).expect(404);
      const missing = await http.get('/api/v1/orders/GS-990101-0000').set('Cookie', stranger.cookie).expect(404);

      expect(wrong.body.error.message).toBe(missing.body.error.message);
      expect(none.body.error.message).toBe(missing.body.error.message);
    });

    it('400s something that is not an order number', async () => {
      await http.get('/api/v1/orders/not-an-order').expect(400);
    });

    it('cancels while awaiting payment and gives the stock back (DoD §13.6)', async () => {
      const { variantId } = await placed();
      const kitBefore = await stockOf(variantId);
      const { session, orderNumber } = await placed();
      expect((await stockOf(variantId)).stockReserved).toBe(kitBefore.stockReserved + 2);

      const { body } = await http.post(`/api/v1/orders/${orderNumber}/cancel`).set('Cookie', session.cookie).send({}).expect(200);

      expect(body).toMatchObject({
        status: 'CANCELLED',
        canCancel: false,
        cancelReason: 'Cancelled by the customer before payment.',
      });
      expect(body.timeline.map((entry: { status: string }) => entry.status)).toEqual(['PENDING_PAYMENT', 'CANCELLED']);
      expect((await stockOf(variantId)).stockReserved).toBe(kitBefore.stockReserved);

      const event = await prisma.orderEvent.findFirstOrThrow({ where: { order: { orderNumber }, toStatus: 'CANCELLED' } });
      expect(event).toMatchObject({ fromStatus: 'PENDING_PAYMENT', actorKind: 'GUEST', actorId: session.sessionId });
    });

    it('refuses a second cancel through the state machine', async () => {
      const { session, orderNumber } = await placed();
      await http.post(`/api/v1/orders/${orderNumber}/cancel`).set('Cookie', session.cookie).send({}).expect(200);

      const { body } = await http.post(`/api/v1/orders/${orderNumber}/cancel`).set('Cookie', session.cookie).send({}).expect(409);
      expect(body.error).toMatchObject({ code: 'ILLEGAL_TRANSITION', message: 'This order is already cancelled.' });
    });

    it('lets a guest cancel from another device with the order email, and nobody without it', async () => {
      const { orderNumber } = await placed();
      const stranger = newSession();

      await http.post(`/api/v1/orders/${orderNumber}/cancel`).set('Cookie', stranger.cookie).send({}).expect(404);
      await http
        .post(`/api/v1/orders/${orderNumber}/cancel`)
        .set('Cookie', stranger.cookie)
        .send({ email: 'amuro@example.com' })
        .expect(200);
    });

    it('gives a cancelled order’s voucher use back, so the code works again', async () => {
      const kit = await masterGradeKit(http);
      const session = newSession();
      await addToCart(http, session, [{ variantId: kit, quantity: 1 }]);
      await http.post('/api/v1/cart/voucher').set('Cookie', session.cookie).send({ code: 'FIRSTBUILD' }).expect(200);
      const { body: quoted } = await quote(http, session, { regionId: jakarta, shippingTier: 'REGULAR' });
      const { body: order } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);
      const usedAfterOrder = (await prisma.voucher.findUniqueOrThrow({ where: { code: 'FIRSTBUILD' } })).usedCount;

      // FIRSTBUILD is once per session: spent, it is refused.
      await addToCart(http, session, [{ variantId: kit, quantity: 1 }]);
      await http.post('/api/v1/cart/voucher').set('Cookie', session.cookie).send({ code: 'FIRSTBUILD' }).expect(400);

      await http.post(`/api/v1/orders/${order.orderNumber}/cancel`).set('Cookie', session.cookie).send({}).expect(200);

      expect((await prisma.voucher.findUniqueOrThrow({ where: { code: 'FIRSTBUILD' } })).usedCount).toBe(usedAfterOrder - 1);
      await http.post('/api/v1/cart/voucher').set('Cookie', session.cookie).send({ code: 'FIRSTBUILD' }).expect(200);
    });
  });
});
