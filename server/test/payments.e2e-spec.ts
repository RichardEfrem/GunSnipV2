import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppConfig } from '../src/config/app-config.js';
import { validateEnv } from '../src/config/env.schema.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { addToCart, masterGradeKit, newSession } from './cart-helpers.js';
import { jakartaDistrict, orderBodyFrom, placeOrder, quote } from './checkout-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * Payments end to end (PRD §8.2, §8.3, FR-PAY-01 … FR-PAY-07; DoD §13.7, §13.8).
 *
 * Every settlement here goes the way a real one will: the dev endpoint asks the provider for the
 * callback it would have sent and hands it back to `parseCallback`, and the operator endpoint is
 * the one the admin screens will call in Phase 9. Nothing pokes a status into the database.
 */
describe('Payments', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let payments: PaymentsService;
  let adminKey: string;
  let jakarta: string;
  let kitVariantId: string;
  let stockAtStart: { stockOnHand: number; stockReserved: number };

  /**
   * Every spec here buys the same kit, and the ones that settle keep their reservation — that is
   * PRD §8.3 working, not a leak. Rather than depend on how much of the seed the files before
   * this one have already spoken for, the kit is topped up for the duration and put back
   * afterwards, the way the other specs restore a price they moved.
   */
  const HEADROOM = 40;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    payments = app.get(PaymentsService);
    adminKey = app.get(AppConfig).adminKey;
    jakarta = await jakartaDistrict(http);
    kitVariantId = await masterGradeKit(http);
    stockAtStart = await prisma.productVariant.findUniqueOrThrow({
      where: { id: kitVariantId },
      select: { stockOnHand: true, stockReserved: true },
    });
    await prisma.productVariant.update({
      where: { id: kitVariantId },
      data: { stockOnHand: stockAtStart.stockOnHand + HEADROOM },
    });
  });

  afterAll(async () => {
    await prisma.productVariant.update({ where: { id: kitVariantId }, data: stockAtStart });
    await app.close();
  });

  /** One MG Exia, bought and awaiting payment, with everything a spec needs to follow it. */
  async function pendingOrder() {
    const variantId = kitVariantId;
    const session = newSession();

    await addToCart(http, session, [{ variantId, quantity: 1 }]);
    const { body: quoted } = await quote(http, session, { regionId: jakarta, shippingTier: 'REGULAR' }).expect(200);
    const { body: order } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);

    const payment = await prisma.payment.findFirstOrThrow({ where: { order: { orderNumber: order.orderNumber } } });

    return { order, session, variantId, paymentId: payment.id };
  }

  function reservedOf(variantId: string) {
    return prisma.productVariant
      .findUniqueOrThrow({ where: { id: variantId }, select: { stockReserved: true } })
      .then((row) => row.stockReserved);
  }

  function readOrder(orderNumber: string, cookie: string) {
    return http.get(`/api/v1/orders/${orderNumber}`).set('Cookie', cookie).expect(200);
  }

  function simulate(paymentId: string, event: string) {
    return http.post(`/api/v1/dev/payments/${paymentId}/simulate`).send({ event });
  }

  function settleAsOperator(orderNumber: string, status: string) {
    return http.post(`/api/v1/admin/orders/${orderNumber}/payment`).set('x-admin-key', adminKey).send({ status });
  }

  describe('the charge opened with the order (FR-PAY-01, FR-PAY-03)', () => {
    it('is pending, for the order total, with instructions the customer can follow', async () => {
      const { order } = await pendingOrder();

      expect(order.payment).toMatchObject({
        method: 'VIRTUAL_ACCOUNT',
        status: 'PENDING',
        amountIdr: order.totals.totalIdr,
      });
      expect(order.payment.instructions).toMatchObject({
        channel: 'BCA Virtual Account',
        accountNumber: expect.stringMatching(/^8\d{11}$/),
        amountIdr: order.totals.totalIdr,
      });
      expect(order.payment.instructions.steps.length).toBeGreaterThan(0);

      // The window the countdown runs to (FR-PAY-03), a day out by default.
      const hours = (Date.parse(order.payment.expiresAt) - Date.parse(order.placedAt)) / 3_600_000;
      expect(hours).toBeCloseTo(24, 1);
    });

    it('is logged as a gateway would log it (FR-PAY-07)', async () => {
      const { paymentId } = await pendingOrder();

      const events = await prisma.paymentEvent.findMany({ where: { paymentId } });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'CHARGE_CREATED' });
      expect(events[0]?.payload).toMatchObject({ event: 'CHARGE_CREATED', currency: 'IDR', source: 'store' });
    });
  });

  describe('the provider settling a charge (FR-PAY-05, DoD §13.7)', () => {
    it('advances the order to PAID and writes an order_event', async () => {
      const { order, session, variantId, paymentId } = await pendingOrder();
      const reservedBefore = await reservedOf(variantId);

      const { body } = await simulate(paymentId, 'CHARGE_PAID').expect(200);
      expect(body.status).toBe('PAID');

      const { body: paid } = await readOrder(order.orderNumber, session.cookie);
      expect(paid.status).toBe('PAID');
      expect(paid.canCancel).toBe(false);
      expect(paid.payment.status).toBe('PAID');
      // Nothing left to pay, so nothing left to instruct.
      expect(paid.payment.instructions).toBeNull();
      expect(paid.timeline.map((entry: { status: string }) => entry.status)).toEqual(['PENDING_PAYMENT', 'PAID']);

      const events = await prisma.orderEvent.findMany({
        where: { order: { orderNumber: order.orderNumber } },
        orderBy: { createdAt: 'asc' },
      });
      expect(events[1]).toMatchObject({
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'PAID',
        actorKind: 'SYSTEM',
        note: 'Payment received.',
      });

      const row = await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } });
      expect(row.paidAt).toBeInstanceOf(Date);

      // Paid, not yet packed: the units stay reserved until they ship (PRD §8.3).
      expect(await reservedOf(variantId)).toBe(reservedBefore);
    });

    it('takes the same callback twice without settling twice', async () => {
      const { order, paymentId } = await pendingOrder();

      await simulate(paymentId, 'CHARGE_PAID').expect(200);
      // A gateway retrying its webhook is ordinary; it must not be an error.
      await simulate(paymentId, 'CHARGE_PAID').expect(200);

      const orderEvents = await prisma.orderEvent.count({
        where: { order: { orderNumber: order.orderNumber }, toStatus: 'PAID' },
      });
      expect(orderEvents).toBe(1);

      // Both notifications are still logged: the log records what arrived (FR-PAY-07).
      expect(await prisma.paymentEvent.count({ where: { paymentId, type: 'CHARGE_PAID' } })).toBe(2);
    });

    it('refuses to reopen a settled charge', async () => {
      const { paymentId } = await pendingOrder();
      await simulate(paymentId, 'CHARGE_PAID').expect(200);

      const refused = await simulate(paymentId, 'CHARGE_EXPIRED').expect(409);
      expect(refused.body.error.code).toBe('ILLEGAL_TRANSITION');
    });

    it('rejects an event it does not offer', async () => {
      const { paymentId } = await pendingOrder();
      await simulate(paymentId, 'CHARGE_CREATED').expect(400);
      await simulate(paymentId, 'NOT_AN_EVENT').expect(400);
    });
  });

  describe('an operator settling a payment (FR-PAY-04, DoD §13.7)', () => {
    it('marks the order paid from the order screen and records who did it', async () => {
      const { order, session } = await pendingOrder();

      const { body } = await settleAsOperator(order.orderNumber, 'PAID').expect(200);
      expect(body.status).toBe('PAID');

      const { body: paid } = await readOrder(order.orderNumber, session.cookie);
      expect(paid.status).toBe('PAID');

      const event = await prisma.orderEvent.findFirstOrThrow({
        where: { order: { orderNumber: order.orderNumber }, toStatus: 'PAID' },
      });
      expect(event.actorKind).toBe('ADMIN');
    });

    it('cancels the order and gives back its stock when the payment failed', async () => {
      const { order, session, variantId } = await pendingOrder();
      const reservedBefore = await reservedOf(variantId);

      await settleAsOperator(order.orderNumber, 'FAILED').expect(200);

      const { body: cancelled } = await readOrder(order.orderNumber, session.cookie);
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelReason).toBe('The payment did not go through.');
      expect(await reservedOf(variantId)).toBe(reservedBefore - 1);
    });

    it('is behind the admin guard like every other admin route (DoD §13.10)', async () => {
      const { order } = await pendingOrder();

      await http.post(`/api/v1/admin/orders/${order.orderNumber}/payment`).send({ status: 'PAID' }).expect(401);
      // Expiry is the sweep's to decide and a refund is the provider's; neither is a form field.
      await settleAsOperator(order.orderNumber, 'EXPIRED').expect(400);
      // Well-formed and nonexistent, so it is the lookup that refuses rather than the DTO.
      await settleAsOperator('GS-999999-9999', 'PAID').expect(404);
      await settleAsOperator('not-an-order-number', 'PAID').expect(400);
    });
  });

  describe('the expiry sweep (FR-PAY-06, DoD §13.8)', () => {
    /** Moves the window into the past, the way waiting a day would. */
    async function closeWindow(paymentId: string) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
    }

    it('cancels an unpaid order past its window and releases its stock', async () => {
      const { order, session, variantId, paymentId } = await pendingOrder();
      const reservedBefore = await reservedOf(variantId);
      await closeWindow(paymentId);

      // At least this one — anything an earlier spec left due is swept in the same pass.
      expect(await payments.expireDue()).toBeGreaterThanOrEqual(1);

      const { body: expired } = await readOrder(order.orderNumber, session.cookie);
      expect(expired.status).toBe('EXPIRED');
      expect(expired.payment.status).toBe('EXPIRED');
      expect(await reservedOf(variantId)).toBe(reservedBefore - 1);

      const event = await prisma.orderEvent.findFirstOrThrow({
        where: { order: { orderNumber: order.orderNumber }, toStatus: 'EXPIRED' },
      });
      expect(event.actorKind).toBe('SYSTEM');
      expect(event.actorId).toBeNull();
    });

    it('leaves an order whose window is still open alone', async () => {
      const { order, session } = await pendingOrder();

      await payments.expireDue();

      const { body } = await readOrder(order.orderNumber, session.cookie);
      expect(body.status).toBe('PENDING_PAYMENT');
    });

    it('does not touch an order that was paid before the sweep reached it', async () => {
      const { order, session, paymentId } = await pendingOrder();
      await simulate(paymentId, 'CHARGE_PAID').expect(200);
      await closeWindow(paymentId);

      await payments.expireDue();

      const { body } = await readOrder(order.orderNumber, session.cookie);
      expect(body.status).toBe('PAID');
    });

    it('is a no-op the second time it runs', async () => {
      const { order, paymentId } = await pendingOrder();
      await closeWindow(paymentId);

      await payments.expireDue();
      const status = () =>
        prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber }, select: { status: true } });
      expect(await status()).toMatchObject({ status: 'EXPIRED' });

      // A second pass finds nothing left to close on *this* order. Asserted against the order
      // rather than the sweep's count, which also counts anything an earlier spec left due.
      await payments.expireDue();
      expect(await status()).toMatchObject({ status: 'EXPIRED' });
      expect(await prisma.paymentEvent.count({ where: { paymentId, type: 'CHARGE_EXPIRED' } })).toBe(1);
    });
  });

  describe('the dev endpoint gate (FR-PAY-05)', () => {
    it('is not there at all when dev endpoints are off', async () => {
      const closed = await createTestApp((builder) =>
        builder
          .overrideProvider(AppConfig)
          .useValue(new AppConfig(validateEnv({ ...process.env, ENABLE_DEV_ENDPOINTS: 'false' }))),
      );

      try {
        const { paymentId } = await pendingOrder();

        // 404, not 403: production should not admit the route exists.
        await request(closed.getHttpServer())
          .post(`/api/v1/dev/payments/${paymentId}/simulate`)
          .send({ event: 'CHARGE_PAID' })
          .expect(404);
      } finally {
        await closed.close();
      }
    });
  });
});
