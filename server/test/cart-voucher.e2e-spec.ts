import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addToCart, buildTools, masterGradeKit, newSession, type GuestSession } from './cart-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * Vouchers on the cart (FR-CART-06, FR-PROMO-01, FR-PROMO-02, FR-PROMO-05), against the seeded
 * codes. The rules themselves are unit-tested in `voucher-rules.spec.ts`; this proves the wiring —
 * that a rejection reaches the client with its reason, and that an applied voucher is re-checked
 * against the cart as the cart changes.
 */
describe('Cart vouchers', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  // Not async: it returns supertest's chainable request, so the caller can add `.expect(…)`.
  function apply(session: GuestSession, code: string) {
    return http.post('/api/v1/cart/voucher').set('Cookie', session.cookie).send({ code });
  }

  async function sessionWith(...variants: string[]): Promise<GuestSession> {
    const session = newSession();
    await addToCart(
      http,
      session,
      variants.map((variantId) => ({ variantId, quantity: 1 })),
    );
    return session;
  }

  it('applies a percentage voucher, normalising what was typed (WELCOME10: 10% of Rp 385.000)', async () => {
    const { nipper } = await buildTools(http);
    const session = await sessionWith(nipper);

    const { body } = await apply(session, '  welcome10 ').expect(200);

    expect(body.voucher).toMatchObject({ code: 'WELCOME10', isApplied: true, discountIdr: 38_500, rejection: null });
    expect(body.totals.discountIdr).toBe(38_500);
    expect(body.totals.totalIdr).toBe(body.totals.subtotalIdr - 38_500 + body.totals.shippingIdr);
  });

  it('says how much more to spend when below the minimum, and does not attach the code', async () => {
    const { liner } = await buildTools(http);
    const session = await sessionWith(liner);

    const { body } = await apply(session, 'WELCOME10').expect(400);

    expect(body.error.code).toBe('VOUCHER_REJECTED');
    expect(body.error.details).toEqual({
      code: 'WELCOME10',
      reason: 'MIN_SPEND_NOT_MET',
      minSpendIdr: 250_000,
      shortfallIdr: 155_000,
    });

    const { body: cart } = await http.get('/api/v1/cart').set('Cookie', session.cookie).expect(200);
    expect(cart.voucher).toBeNull();
  });

  it.each([
    ['NOPE123', 'NOT_FOUND'],
    ['STAFFONLY', 'INACTIVE'],
    ['LEBARAN2025', 'EXPIRED'],
    ['FLASH50', 'USAGE_LIMIT_REACHED'],
  ])('rejects %s with reason %s', async (code, reason) => {
    const { nipper } = await buildTools(http);
    const session = await sessionWith(nipper);

    const { body } = await apply(session, code).expect(400);

    expect(body.error.details).toMatchObject({ code, reason });
  });

  it('includes the end date on an expired voucher, for the storefront to format', async () => {
    const { nipper } = await buildTools(http);

    const { body } = await apply(await sessionWith(nipper), 'LEBARAN2025').expect(400);

    expect(new Date(body.error.details.endsAt).getTime()).toBeLessThan(Date.now());
  });

  it('rejects a scoped voucher when nothing in the cart is in scope (MASTERGRADE20 on a nipper)', async () => {
    const { nipper } = await buildTools(http);

    const { body } = await apply(await sessionWith(nipper), 'MASTERGRADE20').expect(400);

    expect(body.error.details.reason).toBe('NO_ELIGIBLE_ITEMS');
  });

  it('discounts only the lines in scope (MASTERGRADE20: 20% of the Rp 785.000 kit, not the nipper)', async () => {
    const { nipper } = await buildTools(http);
    const kit = await masterGradeKit(http);

    const { body } = await apply(await sessionWith(kit, nipper), 'MASTERGRADE20').expect(200);

    expect(body.totals.discountIdr).toBe(157_000);
  });

  it('waives the shipping estimate with a free-shipping voucher (GRATISONGKIR)', async () => {
    const kit = await masterGradeKit(http);

    const { body } = await apply(await sessionWith(kit), 'GRATISONGKIR').expect(200);

    expect(body.totals.discountIdr).toBe(body.totals.shippingIdr);
    expect(body.totals.totalIdr).toBe(body.totals.subtotalIdr);
  });

  it('rejects a voucher on an empty cart without creating one', async () => {
    const { body } = await apply(newSession(), 'WELCOME10').expect(400);

    expect(body.error.details.reason).toBe('NOTHING_SELECTED');
  });

  it('keeps an applied voucher when the cart stops qualifying, says why, and restores it', async () => {
    const { nipper, liner } = await buildTools(http);
    const session = await sessionWith(nipper, liner);
    const { body: applied } = await apply(session, 'WELCOME10').expect(200);
    const nipperLine = applied.lines.find((line: { variantId: string }) => line.variantId === nipper);

    // Rp 95.000 left selected — below WELCOME10's Rp 250.000 minimum.
    const { body: below } = await http
      .patch(`/api/v1/cart/items/${nipperLine.id}`)
      .set('Cookie', session.cookie)
      .send({ isSelected: false })
      .expect(200);

    expect(below.voucher).toMatchObject({
      code: 'WELCOME10',
      isApplied: false,
      discountIdr: 0,
      rejection: { reason: 'MIN_SPEND_NOT_MET', shortfallIdr: 155_000 },
    });
    expect(below.totals.discountIdr).toBe(0);

    const { body: restored } = await http
      .patch(`/api/v1/cart/items/${nipperLine.id}`)
      .set('Cookie', session.cookie)
      .send({ isSelected: true })
      .expect(200);

    expect(restored.voucher.isApplied).toBe(true);
  });

  it('replaces one voucher with another — one per order (FR-PROMO-05)', async () => {
    const kit = await masterGradeKit(http);
    const session = await sessionWith(kit);

    await apply(session, 'WELCOME10').expect(200);
    const { body } = await apply(session, 'FIRSTBUILD').expect(200);

    expect(body.voucher.code).toBe('FIRSTBUILD');
    expect(body.totals.discountIdr).toBe(50_000);
  });

  it('removes a voucher', async () => {
    const { nipper } = await buildTools(http);
    const session = await sessionWith(nipper);
    await apply(session, 'WELCOME10').expect(200);

    const { body } = await http.delete('/api/v1/cart/voucher').set('Cookie', session.cookie).expect(200);

    expect(body.voucher).toBeNull();
    expect(body.totals.discountIdr).toBe(0);
  });

  it('400s on a malformed code before looking anything up', async () => {
    await apply(newSession(), 'DROP TABLE;').expect(400);
  });
});
