import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { addToCart, newSession, type GuestSession } from './cart-helpers.js';
import { jakartaDistrict, orderBodyFrom, placeOrder, quote } from './checkout-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * Curated bundles, bought as a single line item (FR-CAT-11), against a real database.
 *
 * The thing worth proving here is not that a bundle can be added — it is that the bundle price
 * survives the whole path. A bundle is one line to the customer and one row per component
 * underneath, and the components' allocated prices have to add back up to the advertised price in
 * the cart, in the checkout quote, and on the order that is finally written. Three places, one
 * number; if the allocation drifts anywhere the customer is charged something nobody quoted.
 */
describe('Bundles (FR-CAT-11)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let jakarta: string;

  interface Bundle {
    id: string;
    slug: string;
    name: string;
    priceIdr: number;
    compareAtPriceIdr: number | null;
    savingIdr: number;
    availableQuantity: number;
    isPurchasable: boolean;
    components: { variantId: string; quantity: number; catalogueUnitPriceIdr: number }[];
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    jakarta = await jakartaDistrict(http);
  });

  afterAll(async () => {
    await app.close();
  });

  async function starter(): Promise<Bundle> {
    const { body } = await http.get('/api/v1/bundles').expect(200);
    const match = (body as Bundle[]).find((bundle) => bundle.components.length > 1);
    expect(match, 'no seeded bundle with more than one component').toBeDefined();

    return match as Bundle;
  }

  function addBundle(session: GuestSession, slug: string, quantity?: number) {
    return http.post('/api/v1/cart/bundles').set('Cookie', session.cookie).send({ slug, quantity });
  }

  function cartOf(session: GuestSession) {
    return http.get('/api/v1/cart').set('Cookie', session.cookie).expect(200);
  }

  describe('the catalogue', () => {
    it('lists live bundles with their components and a computed saving', async () => {
      const bundle = await starter();

      expect(bundle.components.length).toBeGreaterThan(1);
      expect(bundle.savingIdr).toBeGreaterThan(0);
      // Never hand-typed (FR-PROMO-03): the compare-at is the components' catalogue total.
      const parts = bundle.components.reduce(
        (total, component) => total + component.catalogueUnitPriceIdr * component.quantity,
        0,
      );
      expect(bundle.compareAtPriceIdr).toBe(parts);
      expect(bundle.savingIdr).toBe(parts - bundle.priceIdr);
    });

    it('serves one by slug and 404s an unknown one', async () => {
      const bundle = await starter();

      await http.get(`/api/v1/bundles/${bundle.slug}`).expect(200);
      await http.get('/api/v1/bundles/not-a-bundle').expect(404);
    });
  });

  describe('in the cart', () => {
    it('adds one line per component, all tagged with the bundle and priced to its total', async () => {
      const bundle = await starter();
      const session = newSession();

      await addBundle(session, bundle.slug).expect(201);
      const { body: cart } = await cartOf(session);

      const bundled = cart.lines.filter((line: { bundle: unknown }) => line.bundle !== null);
      expect(bundled).toHaveLength(bundle.components.length);

      // The whole point: the components add up to the advertised price, not to their own.
      const total = bundled.reduce((sum: number, line: { lineTotalIdr: number }) => sum + line.lineTotalIdr, 0);
      expect(total).toBe(bundle.priceIdr);
      expect(cart.totals.subtotalIdr).toBe(bundle.priceIdr);

      for (const line of bundled) {
        expect(line.bundle).toMatchObject({ id: bundle.id, name: bundle.name, quantity: 1 });
        expect(line.bundle.groupTotalIdr).toBe(bundle.priceIdr);
      }
    });

    it('keeps a loose copy of a bundled variant as its own line, at its own price', async () => {
      const bundle = await starter();
      const component = bundle.components[0]!;
      const session = newSession();

      await addBundle(session, bundle.slug).expect(201);
      await addToCart(http, session, [{ variantId: component.variantId, quantity: 1 }]);

      const { body: cart } = await cartOf(session);
      const sameVariant = cart.lines.filter(
        (line: { variantId: string }) => line.variantId === component.variantId,
      );

      expect(sameVariant).toHaveLength(2);
      expect(sameVariant.filter((line: { bundle: unknown }) => line.bundle === null)).toHaveLength(1);

      const loose = sameVariant.find((line: { bundle: unknown }) => line.bundle === null);
      expect(loose.unitPriceIdr).toBe(component.catalogueUnitPriceIdr);
      expect(cart.totals.subtotalIdr).toBe(bundle.priceIdr + component.catalogueUnitPriceIdr);
    });

    it('raises the whole group when the same bundle is added again', async () => {
      const bundle = await starter();
      const session = newSession();

      await addBundle(session, bundle.slug).expect(201);
      await addBundle(session, bundle.slug).expect(201);

      const { body: cart } = await cartOf(session);
      const bundled = cart.lines.filter((line: { bundle: unknown }) => line.bundle !== null);

      expect(bundled).toHaveLength(bundle.components.length);
      expect(bundled[0].bundle.quantity).toBe(2);
      expect(cart.totals.subtotalIdr).toBe(bundle.priceIdr * 2);
    });

    it('changes the quantity of every component when one of them is changed', async () => {
      const bundle = await starter();
      const session = newSession();

      await addBundle(session, bundle.slug).expect(201);
      const { body: before } = await cartOf(session);
      const line = before.lines.find((candidate: { bundle: unknown }) => candidate.bundle !== null);

      await http
        .patch(`/api/v1/cart/items/${line.id}`)
        .set('Cookie', session.cookie)
        .send({ quantity: 2 })
        .expect(200);

      const { body: after } = await cartOf(session);
      const bundled = after.lines.filter((candidate: { bundle: unknown }) => candidate.bundle !== null);

      expect(bundled.every((candidate: { bundle: { quantity: number } }) => candidate.bundle.quantity === 2)).toBe(true);
      expect(after.totals.subtotalIdr).toBe(bundle.priceIdr * 2);
    });

    it('removes the whole bundle when one component is removed', async () => {
      const bundle = await starter();
      const session = newSession();

      await addBundle(session, bundle.slug).expect(201);
      const { body: before } = await cartOf(session);
      const line = before.lines.find((candidate: { bundle: unknown }) => candidate.bundle !== null);

      await http.delete(`/api/v1/cart/items/${line.id}`).set('Cookie', session.cookie).expect(200);

      const { body: after } = await cartOf(session);
      expect(after.lines).toHaveLength(0);
    });

    it('refuses a bundle that is not live', async () => {
      const session = newSession();
      await addBundle(session, 'not-a-bundle').expect(404);
    });
  });

  describe('through checkout', () => {
    it('carries the bundle price onto the order, one row per component', async () => {
      const bundle = await starter();
      const session = newSession();

      await addBundle(session, bundle.slug).expect(201);
      const { body: quoted } = await quote(http, session, {
        regionId: jakarta,
        shippingTier: 'REGULAR',
      }).expect(200);

      // The quote agrees with the cart before a rupiah is charged.
      expect(quoted.totals.subtotalIdr).toBe(bundle.priceIdr);
      expect(quoted.lines).toHaveLength(bundle.components.length);
      expect(quoted.lines.every((line: { bundle: unknown }) => line.bundle !== null)).toBe(true);

      const { body: order } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);

      expect(order.totals.subtotalIdr).toBe(bundle.priceIdr);

      const rows = await prisma.orderItem.findMany({
        where: { order: { orderNumber: order.orderNumber } },
        select: { bundleId: true, bundleNameSnapshot: true, lineTotalIdr: true, variantId: true },
      });

      expect(rows).toHaveLength(bundle.components.length);
      expect(rows.every((row) => row.bundleId === bundle.id)).toBe(true);
      expect(rows.every((row) => row.bundleNameSnapshot === bundle.name)).toBe(true);
      expect(rows.reduce((total, row) => total + row.lineTotalIdr, 0)).toBe(bundle.priceIdr);

      // And the customer sees it as the one item they chose.
      expect(order.items.every((item: { bundleName: string | null }) => item.bundleName === bundle.name)).toBe(true);
    });

    it('reserves stock for every component, not for a bundle that does not exist on a shelf', async () => {
      const bundle = await starter();
      const session = newSession();

      const before = await prisma.productVariant.findMany({
        where: { id: { in: bundle.components.map((component) => component.variantId) } },
        select: { id: true, stockReserved: true },
      });

      await addBundle(session, bundle.slug).expect(201);
      const { body: quoted } = await quote(http, session, {
        regionId: jakarta,
        shippingTier: 'REGULAR',
      }).expect(200);
      await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);

      const after = await prisma.productVariant.findMany({
        where: { id: { in: bundle.components.map((component) => component.variantId) } },
        select: { id: true, stockReserved: true },
      });

      const reservedBefore = new Map(before.map((row) => [row.id, row.stockReserved]));
      for (const row of after) {
        const component = bundle.components.find((candidate) => candidate.variantId === row.id)!;
        expect(row.stockReserved).toBe((reservedBefore.get(row.id) ?? 0) + component.quantity);
      }
    });
  });
});
