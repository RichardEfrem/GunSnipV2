import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { addToCart, buildTools, newSession } from './cart-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * FR-CART-04 end to end: change the catalogue under a cart, read the cart, and check the change
 * is surfaced rather than applied silently.
 *
 * These edit a seeded variant's price and stock, which is only safe because the suite runs
 * against its own database (`global-setup.ts`). Each test restores the variant afterwards so the
 * specs that follow see the seed as written.
 */
describe('Cart revalidation', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;

  let nipper: string;
  let original: { priceIdr: number; stockOnHand: number; stockReserved: number; isArchived: boolean };

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    ({ nipper } = await buildTools(http));
    original = await prisma.productVariant.findUniqueOrThrow({
      where: { id: nipper },
      select: { priceIdr: true, stockOnHand: true, stockReserved: true, isArchived: true },
    });
  });

  afterEach(async () => {
    await prisma.productVariant.update({ where: { id: nipper }, data: original });
  });

  afterAll(async () => {
    await app.close();
  });

  async function readCart(cookie: string) {
    return (await http.get('/api/v1/cart').set('Cookie', cookie).expect(200)).body;
  }

  it('says the price changed, and charges the new one (FR-CART-04, non-negotiable #2)', async () => {
    const session = newSession();
    await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

    await prisma.productVariant.update({ where: { id: nipper }, data: { priceIdr: original.priceIdr + 20_000 } });

    const cart = await readCart(session.cookie);

    expect(cart.lines[0].notices).toEqual([{ kind: 'PRICE_CHANGED', previousUnitPriceIdr: original.priceIdr }]);
    expect(cart.lines[0].unitPriceIdr).toBe(original.priceIdr + 20_000);
    expect(cart.totals.subtotalIdr).toBe(original.priceIdr + 20_000);
  });

  it('keeps saying so across reads — a read never consumes the notice', async () => {
    const session = newSession();
    await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);
    await prisma.productVariant.update({ where: { id: nipper }, data: { priceIdr: original.priceIdr - 10_000 } });

    await readCart(session.cookie);
    const second = await readCart(session.cookie);

    expect(second.lines[0].notices).toHaveLength(1);
  });

  it('retires the price notice once the customer changes the quantity at the new price', async () => {
    const session = newSession();
    const { body: added } = await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);
    await prisma.productVariant.update({ where: { id: nipper }, data: { priceIdr: original.priceIdr + 5_000 } });

    const { body } = await http
      .patch(`/api/v1/cart/items/${added.lines[0].id}`)
      .set('Cookie', session.cookie)
      .send({ quantity: 2 })
      .expect(200);

    expect(body.lines[0].notices).toEqual([]);
  });

  it('reduces a quantity to what is left, says so, and does not write the reduction', async () => {
    const session = newSession();
    const { body: added } = await addToCart(http, session, [{ variantId: nipper, quantity: 3 }]);

    await prisma.productVariant.update({
      where: { id: nipper },
      data: { stockOnHand: original.stockReserved + 2 },
    });

    const cart = await readCart(session.cookie);

    expect(cart.lines[0]).toMatchObject({
      quantity: 2,
      lineTotalIdr: original.priceIdr * 2,
      notices: [{ kind: 'QUANTITY_REDUCED', requestedQuantity: 3 }],
    });

    // The row still holds what the customer asked for; only the view is reduced.
    const row = await prisma.cartItem.findUniqueOrThrow({ where: { id: added.lines[0].id } });
    expect(row.quantity).toBe(3);
  });

  it('keeps an out-of-stock line in the cart but out of the total', async () => {
    const session = newSession();
    await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

    await prisma.productVariant.update({ where: { id: nipper }, data: { stockOnHand: original.stockReserved } });

    const cart = await readCart(session.cookie);

    expect(cart.lines[0]).toMatchObject({
      isSelected: true,
      isPurchasable: false,
      notices: [{ kind: 'OUT_OF_STOCK' }],
    });
    expect(cart.totals).toMatchObject({ subtotalIdr: 0, shippingIdr: 0, totalIdr: 0, lineCount: 1 });
  });

  it('does not delete an out-of-stock line with "Delete selected" — it was never shown ticked', async () => {
    const session = newSession();
    await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);
    await prisma.productVariant.update({ where: { id: nipper }, data: { stockOnHand: original.stockReserved } });

    const { body } = await http.delete('/api/v1/cart/items/selected').set('Cookie', session.cookie).expect(200);

    expect(body.lines).toHaveLength(1);
  });

  it('marks an archived variant unavailable', async () => {
    const session = newSession();
    await addToCart(http, session, [{ variantId: nipper, quantity: 1 }]);

    await prisma.productVariant.update({ where: { id: nipper }, data: { isArchived: true } });

    const cart = await readCart(session.cookie);

    expect(cart.lines[0]).toMatchObject({ isPurchasable: false, notices: [{ kind: 'UNAVAILABLE' }] });
    expect(cart.totals.subtotalIdr).toBe(0);
  });
});
