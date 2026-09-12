import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, type AdminClient } from './admin-helpers.js';
import { addToCart, newSession, type GuestSession } from './cart-helpers.js';
import { jakartaDistrict, orderBodyFrom, placeOrder, quote } from './checkout-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * Order fulfilment and stock adjustment (FR-ADM-05, FR-ADM-07, FR-ADM-08) against a real
 * database.
 *
 * The centre of it is dispatch. Until Phase 9 an order reserved stock and nothing ever gave it
 * back except a cancellation — `stock_on_hand` only ever went up. Shipping is where the goods
 * physically leave, so it is where both counters drop together and where `ORDER_FULFILLED`
 * finally gets written; that is the invariant these specs exist to hold.
 */
describe('Admin fulfilment', () => {
  let app: INestApplication;
  let admin: AdminClient;
  let http: ReturnType<typeof request>;
  let regionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    admin = adminClient(app);
    http = request(app.getHttpServer());
    regionId = await jakartaDistrict(http);
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * A published, in-stock variant with room to spare, and the product that owns it.
   *
   * Resolved from the seeded catalogue rather than hard-coded, so these specs survive a reseed —
   * and through the *admin* product list, because only that view carries the stock columns.
   */
  async function sellableVariant(): Promise<{ variantId: string; productId: string; slug: string }> {
    const { body } = await admin.get('/admin/products?status=PUBLISHED&type=MODEL_KIT&limit=20').expect(200);

    for (const summary of body.items as { id: string; slug: string }[]) {
      const detail = await admin.get(`/admin/products/${summary.id}`).expect(200);
      const variant = (detail.body.variants as { id: string; isArchived: boolean; availableQuantity: number }[]).find(
        (row) => !row.isArchived && row.availableQuantity >= 6,
      );

      if (variant !== undefined) {
        return { variantId: variant.id, productId: summary.id, slug: summary.slug };
      }
    }

    throw new Error('No seeded variant with six in stock — the seed should always provide one.');
  }

  /** The variant's stored levels, which only the admin product view exposes. */
  async function levels(productId: string, variantId: string): Promise<{ stockOnHand: number; stockReserved: number }> {
    const { body } = await admin.get(`/admin/products/${productId}`).expect(200);
    const variant = (body.variants as { id: string; stockOnHand: number; stockReserved: number }[]).find(
      (row) => row.id === variantId,
    );

    expect(variant, 'the variant should be on its own product').toBeDefined();

    return { stockOnHand: variant?.stockOnHand ?? 0, stockReserved: variant?.stockReserved ?? 0 };
  }

  /** Places a real order through cart → quote → checkout, the way the storefront does. */
  async function orderFor(variantId: string, quantity = 2): Promise<{ orderNumber: string; session: GuestSession }> {
    const session = newSession();

    await addToCart(http, session, [{ variantId, quantity }]);
    const quoted = await quote(http, session, { regionId }).expect(200);
    const { body } = await placeOrder(http, session, orderBodyFrom(quoted.body, regionId)).expect(201);

    return { orderNumber: body.orderNumber, session };
  }

  describe('order list (FR-ADM-07)', () => {
    it('lists orders newest first, with the customer and total', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      const { body } = await admin.get('/admin/orders?limit=10').expect(200);

      expect((body.items as { orderNumber: string }[])[0].orderNumber).toBe(orderNumber);
      expect(body.items[0]).toMatchObject({
        status: 'PENDING_PAYMENT',
        customerEmail: expect.any(String),
        totalIdr: expect.any(Number),
      });
    });

    it('filters by status', async () => {
      const { body } = await admin.get('/admin/orders?status=PENDING_PAYMENT&limit=10').expect(200);

      for (const row of body.items as { status: string }[]) expect(row.status).toBe('PENDING_PAYMENT');
    });

    it('finds an order by number', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      const { body } = await admin.get(`/admin/orders?q=${orderNumber}`).expect(200);

      expect((body.items as { orderNumber: string }[])).toHaveLength(1);
      expect(body.items[0].orderNumber).toBe(orderNumber);
    });

    it('finds an order by customer email, which lives inside the snapshot', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      const detail = await admin.get(`/admin/orders/${orderNumber}`).expect(200);
      const { body } = await admin.get(`/admin/orders?q=${detail.body.contact.email}`).expect(200);

      expect((body.items as { orderNumber: string }[]).some((row) => row.orderNumber === orderNumber)).toBe(true);
    });
  });

  describe('order detail (FR-ADM-08)', () => {
    it('offers only the transitions the state machine allows from here', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      const { body } = await admin.get(`/admin/orders/${orderNumber}`).expect(200);

      // PRD §8.1: an unpaid order can only be paid, cancelled or expired.
      expect(body.nextStatuses).toEqual(['PAID', 'CANCELLED', 'EXPIRED']);
    });

    it('carries the operator-only fields the customer view withholds', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      const { body } = await admin.get(`/admin/orders/${orderNumber}`).expect(200);

      expect(body).toMatchObject({ internalNote: null, shipment: null, sessionId: expect.any(String) });
      expect(body.timeline[0]).toMatchObject({ status: 'PENDING_PAYMENT', actorKind: 'GUEST' });
    });

    it('stores an internal note, which is never on the customer view', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber, session } = await orderFor(variantId, 1);

      await admin.put(`/admin/orders/${orderNumber}/note`, { internalNote: 'Ring before delivery.' }).expect(200);

      const operator = await admin.get(`/admin/orders/${orderNumber}`).expect(200);
      expect(operator.body.internalNote).toBe('Ring before delivery.');

      const customer = await http
        .get(`/api/v1/orders/${orderNumber}`)
        .set('Cookie', session.cookie)
        .expect(200);
      expect(customer.body).not.toHaveProperty('internalNote');
    });
  });

  describe('advancing an order (FR-ADM-08)', () => {
    it('refuses to move an order to PAID, which is the payment endpoint\'s job', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      const { body } = await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'PAID' }).expect(409);

      expect(body.error.message).toMatch(/mark the payment paid/i);
    });

    it('refuses an illegal transition, from the state machine rather than a branch', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      // PENDING_PAYMENT → SHIPPED is not in the map.
      const { body } = await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'SHIPPED' }).expect(409);

      expect(body.error.code).toBe('ILLEGAL_TRANSITION');
    });

    it('refuses to ship without a courier — there would be nowhere to track it', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      await admin.post(`/admin/orders/${orderNumber}/payment`, { status: 'PAID' }).expect(200);
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'PACKING' }).expect(200);

      const { body } = await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'SHIPPED' }).expect(409);

      expect(body.error.message).toMatch(/add the courier/i);
    });

    it('walks the whole lifecycle, writing an event for each step (FR-ORD-06)', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      await admin.post(`/admin/orders/${orderNumber}/payment`, { status: 'PAID' }).expect(200);
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'PACKING' }).expect(200);
      await admin.put(`/admin/orders/${orderNumber}/shipment`, { courier: 'JNE', trackingNumber: 'JNE123456' }).expect(200);
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'SHIPPED' }).expect(200);
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'DELIVERED' }).expect(200);

      const { body } = await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'COMPLETED' }).expect(200);

      expect(body.status).toBe('COMPLETED');
      expect(body.nextStatuses).toEqual([]);
      expect((body.timeline as { status: string }[]).map((entry) => entry.status)).toEqual([
        'PENDING_PAYMENT',
        'PAID',
        'PACKING',
        'SHIPPED',
        'DELIVERED',
        'COMPLETED',
      ]);
      expect(body.shipment).toMatchObject({
        courier: 'JNE',
        trackingNumber: 'JNE123456',
        shippedAt: expect.any(String),
        deliveredAt: expect.any(String),
      });
      // Attributed to the operator, not the guest who placed it.
      expect((body.timeline as { actorKind: string }[]).at(-1)?.actorKind).toBe('ADMIN');
    });

    it('records the operator\'s own note on the event when one is given', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      await admin.post(`/admin/orders/${orderNumber}/payment`, { status: 'PAID' }).expect(200);
      const { body } = await admin
        .post(`/admin/orders/${orderNumber}/status`, { status: 'PACKING', note: 'Boxed with the bubble wrap.' })
        .expect(200);

      expect((body.timeline as { note: string }[]).at(-1)?.note).toBe('Boxed with the bubble wrap.');
    });
  });

  describe('dispatch consumes stock (PRD §8.3)', () => {
    it('drops both counters together and writes an ORDER_FULFILLED movement', async () => {
      const { variantId, productId } = await sellableVariant();
      const before = await levels(productId, variantId);

      const { orderNumber } = await orderFor(variantId, 2);

      // Placing an order only reserves: the shelf is untouched.
      const reserved = await levels(productId, variantId);
      expect(reserved.stockOnHand).toBe(before.stockOnHand);
      expect(reserved.stockReserved).toBe(before.stockReserved + 2);

      await admin.post(`/admin/orders/${orderNumber}/payment`, { status: 'PAID' }).expect(200);
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'PACKING' }).expect(200);
      await admin.put(`/admin/orders/${orderNumber}/shipment`, { courier: 'JNE' }).expect(200);
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'SHIPPED' }).expect(200);

      // Dispatch: the goods have left, so both counters drop by the same amount.
      const shipped = await levels(productId, variantId);
      expect(shipped.stockOnHand).toBe(before.stockOnHand - 2);
      expect(shipped.stockReserved).toBe(before.stockReserved);

      const movements = await admin.get(`/admin/variants/${variantId}/movements?limit=5`).expect(200);
      expect(movements.body.items[0]).toMatchObject({
        delta: -2,
        reason: 'ORDER_FULFILLED',
        orderNumber,
        actorKind: 'ADMIN',
      });
    });

    it('leaves availability unchanged at dispatch — those units were already spoken for', async () => {
      const { variantId, slug } = await sellableVariant();

      const { orderNumber } = await orderFor(variantId, 1);
      const afterOrder = await http.get(`/api/v1/products/${slug}`).expect(200);
      const availableAfterOrder = (afterOrder.body.variants as { id: string; availableQuantity: number }[]).find(
        (row) => row.id === variantId,
      )?.availableQuantity;

      await admin.post(`/admin/orders/${orderNumber}/payment`, { status: 'PAID' }).expect(200);
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'PACKING' }).expect(200);
      await admin.put(`/admin/orders/${orderNumber}/shipment`, { courier: 'JNE' }).expect(200);
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'SHIPPED' }).expect(200);

      const afterShip = await http.get(`/api/v1/products/${slug}`).expect(200);
      const availableAfterShip = (afterShip.body.variants as { id: string; availableQuantity: number }[]).find(
        (row) => row.id === variantId,
      )?.availableQuantity;

      expect(availableAfterShip).toBe(availableAfterOrder);
    });
  });

  describe('cancelling (FR-ADM-08)', () => {
    it('needs a reason and gives the reservation back', async () => {
      const { variantId, productId } = await sellableVariant();
      const before = await levels(productId, variantId);
      const { orderNumber } = await orderFor(variantId, 2);

      expect((await levels(productId, variantId)).stockReserved).toBe(before.stockReserved + 2);

      const { body } = await admin
        .post(`/admin/orders/${orderNumber}/cancel`, { reason: 'Out of stock at the warehouse.' })
        .expect(200);

      expect(body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Out of stock at the warehouse.' });
      expect((await levels(productId, variantId)).stockReserved).toBe(before.stockReserved);
      // The shelf never changed: the units were never dispatched.
      expect((await levels(productId, variantId)).stockOnHand).toBe(before.stockOnHand);
    });

    it('refuses cancelling through the generic status route', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      const { body } = await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'CANCELLED' }).expect(409);

      expect(body.error.message).toMatch(/needs a reason/i);
    });

    it('refuses an empty reason', async () => {
      const { variantId } = await sellableVariant();
      const { orderNumber } = await orderFor(variantId, 1);

      await admin.post(`/admin/orders/${orderNumber}/cancel`, { reason: '' }).expect(400);
    });
  });

  describe('stock adjustment (FR-ADM-05)', () => {
    it('adds stock and records the reason', async () => {
      const { variantId, productId } = await sellableVariant();
      const before = await levels(productId, variantId);

      const { body } = await admin
        .post(`/admin/variants/${variantId}/stock`, { delta: 10, reason: 'RESTOCK', note: 'Pallet from Bandai.' })
        .expect(200);

      expect(body.stockOnHand).toBe(before.stockOnHand + 10);

      const movements = await admin.get(`/admin/variants/${variantId}/movements?limit=1`).expect(200);
      expect(movements.body.items[0]).toMatchObject({
        delta: 10,
        reason: 'RESTOCK',
        note: 'Pallet from Bandai.',
        actorKind: 'ADMIN',
        orderNumber: null,
      });
    });

    it('writes stock down and leaves reservations alone', async () => {
      const { variantId, productId } = await sellableVariant();
      await admin.post(`/admin/variants/${variantId}/stock`, { delta: 20, reason: 'RESTOCK' }).expect(200);
      const before = await levels(productId, variantId);

      const { body } = await admin
        .post(`/admin/variants/${variantId}/stock`, { delta: -3, reason: 'DAMAGE', note: 'Crushed boxes.' })
        .expect(200);

      expect(body.stockOnHand).toBe(before.stockOnHand - 3);
      expect(body.stockReserved).toBe(before.stockReserved);
    });

    it('refuses to write off units reserved for placed orders', async () => {
      const { variantId, productId } = await sellableVariant();
      const before = await levels(productId, variantId);
      await orderFor(variantId, 2);

      const free = before.stockOnHand - before.stockReserved - 2;

      const { body } = await admin
        .post(`/admin/variants/${variantId}/stock`, { delta: -(free + 1), reason: 'CORRECTION' })
        .expect(400);

      expect(body.error.message).toMatch(/reserved for placed orders/i);
    });

    it('requires a reason (FR-ADM-05)', async () => {
      const { variantId } = await sellableVariant();

      await admin.post(`/admin/variants/${variantId}/stock`, { delta: 5 }).expect(400);
    });

    it('refuses a zero adjustment', async () => {
      const { variantId } = await sellableVariant();

      await admin.post(`/admin/variants/${variantId}/stock`, { delta: 0, reason: 'CORRECTION' }).expect(400);
    });

    it('404s on a variant that does not exist', async () => {
      await admin
        .post('/admin/variants/00000000-0000-4000-8000-000000000000/stock', { delta: 1, reason: 'RESTOCK' })
        .expect(404);
    });
  });
});
