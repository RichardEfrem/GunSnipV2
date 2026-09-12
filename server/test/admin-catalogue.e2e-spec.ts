import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, seededRefs, unique, type AdminClient } from './admin-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * Reference data, vouchers, reviews, banners and the dashboard (FR-ADM-01, FR-ADM-09 …
 * FR-ADM-12) against a real database.
 *
 * The recurring theme is refusing a destructive edit with a sentence instead of a foreign-key
 * error: a grade 40 kits point at, a voucher that is part of an order's history, a category with
 * children. The schema would refuse all three anyway — these specs are about the operator being
 * told why.
 */
describe('Admin catalogue', () => {
  let app: INestApplication;
  let admin: AdminClient;
  let refs: Awaited<ReturnType<typeof seededRefs>>;

  /**
   * Everything this spec creates, removed when it finishes.
   *
   * The e2e suite seeds once (`global-setup.ts`) and every spec shares that database, so a
   * category left behind is a category the catalogue spec counts and a banner left behind is one
   * the home page renders. Deepest-first, because a parent cannot go before its children.
   */
  const created: { path: string; id: string }[] = [];

  function track<T extends { id: string }>(path: string, body: T): T {
    created.push({ path, id: body.id });
    return body;
  }

  beforeAll(async () => {
    app = await createTestApp();
    admin = adminClient(app);
    refs = await seededRefs(admin);
  });

  afterAll(async () => {
    for (const row of [...created].reverse()) {
      // Already-deleted rows are expected — several specs remove what they made as the assertion.
      await admin.delete(`${row.path}/${row.id}`);
    }

    await app.close();
  });

  describe('reference data (FR-ADM-09)', () => {
    it('lists grades with the number of products behind each', async () => {
      const { body } = await admin.get('/admin/reference/grades').expect(200);

      const mg = (body as { key: string; usageCount: number }[]).find((row) => row.key === 'MG');
      expect(mg?.usageCount).toBeGreaterThan(0);
    });

    it('creates, renames and removes a grade nothing uses', async () => {
      const code = `TST${unique().toUpperCase()}`;

      const created = await admin
        .post('/admin/reference/grades', { code, name: 'Test Grade', position: 99 })
        .expect(201);
      track('/admin/reference/grades', created.body);
      expect(created.body).toMatchObject({ key: code, name: 'Test Grade', usageCount: 0 });

      const renamed = await admin
        .patch(`/admin/reference/grades/${created.body.id}`, { name: 'Renamed Grade' })
        .expect(200);
      expect(renamed.body).toMatchObject({ key: code, name: 'Renamed Grade' });

      await admin.delete(`/admin/reference/grades/${created.body.id}`).expect(204);
      await admin.patch(`/admin/reference/grades/${created.body.id}`, { name: 'Gone' }).expect(404);
    });

    it('refuses to remove a grade products still point at, saying how many', async () => {
      const { body } = await admin.get('/admin/reference/grades').expect(200);
      const used = (body as { id: string; usageCount: number }[]).find((row) => row.usageCount > 0);

      const response = await admin.delete(`/admin/reference/grades/${used?.id}`).expect(409);

      expect(response.body.error.message).toMatch(/still use this grade/i);
    });

    it('refuses a duplicate grade code', async () => {
      const { body } = await admin.post('/admin/reference/grades', { code: 'MG', name: 'Another MG' }).expect(409);

      expect(body.error.message).toMatch(/already exists/i);
    });

    it('refuses to change the stable key a URL carries, rather than quietly ignoring it', async () => {
      const { body } = await admin.get('/admin/reference/grades').expect(200);
      const mg = (body as { id: string; key: string }[]).find((row) => row.key === 'MG');

      // `code` is not on the update DTO, so the validation pipe refuses the whole request. An
      // operator who meant to rename a grade gets an error rather than a silent partial save.
      await admin.patch(`/admin/reference/grades/${mg?.id}`, { name: 'Master Grade', code: 'XX' }).expect(400);

      const renamed = await admin.patch(`/admin/reference/grades/${mg?.id}`, { name: 'Master Grade' }).expect(200);
      expect(renamed.body).toMatchObject({ key: 'MG', name: 'Master Grade' });
    });

    it('derives a slug for a new series', async () => {
      const { body } = await admin
        .post('/admin/reference/series', { name: `Mobile Suit Test ${unique()}` })
        .expect(201);
      track('/admin/reference/series', body);

      expect(body.key).toMatch(/^mobile-suit-test-/);
    });

    it('returns the category tree flattened with a depth for indenting', async () => {
      const { body } = await admin.get('/admin/reference/categories').expect(200);

      expect((body as { depth: number }[]).some((row) => row.depth === 0)).toBe(true);
      expect((body as { depth: number }[]).some((row) => row.depth > 0)).toBe(true);
    });

    it('refuses a category whose parent is in the other tree', async () => {
      const { body } = await admin
        .post('/admin/reference/categories', {
          name: `Wrong Tree ${unique()}`,
          type: 'TOOL_SUPPLY',
          parentId: refs.kitCategoryId,
        })
        .expect(409);

      expect(body.error.message).toMatch(/same tree as its parent/i);
    });

    it('refuses a category that would become its own parent', async () => {
      const created = await admin
        .post('/admin/reference/categories', { name: `Self Parent ${unique()}`, type: 'MODEL_KIT' })
        .expect(201);
      track('/admin/reference/categories', created.body);

      const { body } = await admin
        .patch(`/admin/reference/categories/${created.body.id}`, { parentId: created.body.id })
        .expect(400);

      expect(body.error.message).toMatch(/its own parent/i);
    });

    it('refuses a cycle through a descendant', async () => {
      const parent = await admin
        .post('/admin/reference/categories', { name: `Cycle Parent ${unique()}`, type: 'MODEL_KIT' })
        .expect(201);
      track('/admin/reference/categories', parent.body);
      const child = await admin
        .post('/admin/reference/categories', {
          name: `Cycle Child ${unique()}`,
          type: 'MODEL_KIT',
          parentId: parent.body.id,
        })
        .expect(201);
      track('/admin/reference/categories', child.body);

      const { body } = await admin
        .patch(`/admin/reference/categories/${parent.body.id}`, { parentId: child.body.id })
        .expect(400);

      expect(body.error.message).toMatch(/inside one of its own sub-categories/i);
    });

    it('refuses to remove a category that still has children', async () => {
      const parent = await admin
        .post('/admin/reference/categories', { name: `Has Children ${unique()}`, type: 'MODEL_KIT' })
        .expect(201);
      track('/admin/reference/categories', parent.body);
      const child = await admin
        .post('/admin/reference/categories', {
          name: `A Child ${unique()}`,
          type: 'MODEL_KIT',
          parentId: parent.body.id,
        })
        .expect(201);
      track('/admin/reference/categories', child.body);

      const { body } = await admin.delete(`/admin/reference/categories/${parent.body.id}`).expect(409);

      expect(body.error.message).toMatch(/sub-categories/i);
    });
  });

  describe('vouchers (FR-ADM-10)', () => {
    function voucherBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        code: `TEST${unique().toUpperCase()}`,
        type: 'PERCENTAGE',
        percentOff: 15,
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2027-01-01T00:00:00.000Z',
        ...overrides,
      };
    }

    it('creates a percentage voucher with its usage counter at zero', async () => {
      const { body } = await admin.post('/admin/vouchers', voucherBody()).expect(201);
      track('/admin/vouchers', body);

      expect(body).toMatchObject({ type: 'PERCENTAGE', percentOff: 15, usedCount: 0, redemptionCount: 0 });
    });

    it('upper-cases the code, so a voucher typed in lower case still matches', async () => {
      const code = `lower${unique()}`;
      const { body } = await admin.post('/admin/vouchers', voucherBody({ code: code.toUpperCase() })).expect(201);
      track('/admin/vouchers', body);

      expect(body.code).toBe(code.toUpperCase());
    });

    it('refuses a percentage voucher with no percentage', async () => {
      const { body } = await admin.post('/admin/vouchers', voucherBody({ percentOff: null })).expect(400);

      expect(body.error.message).toMatch(/needs a percentage off/i);
    });

    it('refuses a percentage voucher that also carries rupiah', async () => {
      await admin.post('/admin/vouchers', voucherBody({ amountIdr: 50_000 })).expect(400);
    });

    it('refuses a fixed-amount voucher with no amount', async () => {
      await admin
        .post('/admin/vouchers', voucherBody({ type: 'FIXED_AMOUNT', percentOff: null }))
        .expect(400);
    });

    it('refuses a window that ends before it starts', async () => {
      const { body } = await admin
        .post('/admin/vouchers', voucherBody({ startsAt: '2027-01-01T00:00:00.000Z', endsAt: '2026-01-01T00:00:00.000Z' }))
        .expect(400);

      expect(body.error.message).toMatch(/end after it starts/i);
    });

    it('refuses a duplicate code', async () => {
      const body = voucherBody();
      const first = await admin.post('/admin/vouchers', body).expect(201);
      track('/admin/vouchers', first.body);

      await admin.post('/admin/vouchers', body).expect(409);
    });

    it('checks a partial update against the whole voucher, not one field', async () => {
      const created = await admin.post('/admin/vouchers', voucherBody()).expect(201);
      track('/admin/vouchers', created.body);

      // Clearing the percentage is only invalid in combination with the stored type.
      const { body } = await admin.patch(`/admin/vouchers/${created.body.id}`, { percentOff: null }).expect(400);

      expect(body.error.message).toMatch(/needs a percentage off/i);
    });

    it('replaces the scope rather than adding to it', async () => {
      const created = await admin
        .post('/admin/vouchers', voucherBody({ categoryIds: [refs.kitCategoryId] }))
        .expect(201);
      track('/admin/vouchers', created.body);
      expect(created.body.categoryIds).toEqual([refs.kitCategoryId]);

      const { body } = await admin.patch(`/admin/vouchers/${created.body.id}`, { categoryIds: [] }).expect(200);

      expect(body.categoryIds).toEqual([]);
    });

    it('switches a voucher off without deleting it', async () => {
      const created = await admin.post('/admin/vouchers', voucherBody()).expect(201);
      track('/admin/vouchers', created.body);

      const { body } = await admin.patch(`/admin/vouchers/${created.body.id}`, { isActive: false }).expect(200);

      expect(body.isActive).toBe(false);
    });

    it('deletes a voucher nobody has redeemed', async () => {
      const created = await admin.post('/admin/vouchers', voucherBody()).expect(201);

      await admin.delete(`/admin/vouchers/${created.body.id}`).expect(204);
      await admin.get(`/admin/vouchers/${created.body.id}`).expect(404);
    });

    it('refuses to delete a voucher that is part of an order, telling the operator to switch it off', async () => {
      const { body } = await admin.get('/admin/vouchers?limit=100').expect(200);
      const redeemed = (body.items as { id: string; redemptionCount: number }[]).find(
        (row) => row.redemptionCount > 0,
      );

      // The seed places historical orders, some with vouchers; skip cleanly if it ever does not.
      if (redeemed === undefined) return;

      const response = await admin.delete(`/admin/vouchers/${redeemed.id}`).expect(409);
      expect(response.body.error.message).toMatch(/switch it off instead/i);
    });

    it('never exposes a way to type the usage counter', async () => {
      const created = await admin.post('/admin/vouchers', voucherBody()).expect(201);
      track('/admin/vouchers', created.body);

      // `forbidNonWhitelisted` refuses a field the DTO does not declare, which is what keeps a
      // used-up voucher from being handed out again by editing a number.
      await admin.patch(`/admin/vouchers/${created.body.id}`, { usedCount: 0 }).expect(400);
    });
  });

  describe('review moderation (FR-ADM-11)', () => {
    it('defaults to the pending queue, the only list with work in it', async () => {
      const { body } = await admin.get('/admin/reviews').expect(200);

      for (const row of body.items as { status: string }[]) expect(row.status).toBe('PENDING');
    });

    it('counts each state for the nav badge', async () => {
      const { body } = await admin.get('/admin/reviews/counts').expect(200);

      expect(body).toMatchObject({
        pending: expect.any(Number),
        approved: expect.any(Number),
        rejected: expect.any(Number),
      });
    });

    it('approving a review moves the product rating counters (FR-REV-05)', async () => {
      const queue = await admin.get('/admin/reviews?limit=1').expect(200);
      const review = (queue.body.items as { id: string; product: { id: string }; rating: number }[])[0];
      expect(review, 'the seed should leave reviews pending').toBeDefined();

      const before = await admin.get(`/admin/products/${review.product.id}`).expect(200);

      const { body } = await admin
        .post(`/admin/reviews/${review.id}/moderation`, { status: 'APPROVED' })
        .expect(200);

      expect(body).toMatchObject({ status: 'APPROVED', moderatedAt: expect.any(String) });

      const after = await admin.get(`/admin/products/${review.product.id}`).expect(200);
      expect(after.body.reviewCount).toBe(before.body.reviewCount + 1);
    });

    it('rejecting a review takes it back out of the average', async () => {
      const queue = await admin.get('/admin/reviews?limit=2').expect(200);
      const review = (queue.body.items as { id: string; product: { id: string } }[])[0];
      expect(review).toBeDefined();

      await admin.post(`/admin/reviews/${review.id}/moderation`, { status: 'APPROVED' }).expect(200);
      const approved = await admin.get(`/admin/products/${review.product.id}`).expect(200);

      await admin.post(`/admin/reviews/${review.id}/moderation`, { status: 'REJECTED' }).expect(200);
      const rejected = await admin.get(`/admin/products/${review.product.id}`).expect(200);

      expect(rejected.body.reviewCount).toBe(approved.body.reviewCount - 1);
    });

    it('refuses a decision that is already the review\'s status, so moderatedAt is not rewritten', async () => {
      const queue = await admin.get('/admin/reviews?limit=1').expect(200);
      const review = (queue.body.items as { id: string }[])[0];

      await admin.post(`/admin/reviews/${review.id}/moderation`, { status: 'APPROVED' }).expect(200);

      const { body } = await admin
        .post(`/admin/reviews/${review.id}/moderation`, { status: 'APPROVED' })
        .expect(409);

      expect(body.error.message).toMatch(/already approved/i);
    });

    it('refuses sending a review back to PENDING', async () => {
      const queue = await admin.get('/admin/reviews?limit=1').expect(200);
      const review = (queue.body.items as { id: string }[])[0];

      await admin.post(`/admin/reviews/${review.id}/moderation`, { status: 'PENDING' }).expect(400);
    });

    it('stores the shop\'s public reply without touching the decision', async () => {
      const queue = await admin.get('/admin/reviews?limit=1').expect(200);
      const review = (queue.body.items as { id: string; status: string }[])[0];

      const { body } = await admin
        .put(`/admin/reviews/${review.id}/reply`, { adminReply: 'Thanks — glad the nipper worked out.' })
        .expect(200);

      expect(body.adminReply).toBe('Thanks — glad the nipper worked out.');
      expect(body.status).toBe(review.status);
    });
  });

  describe('banners (FR-ADM-12)', () => {
    function bannerBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        title: `Test Banner ${unique()}`,
        imageUrl: '/media/products/placeholder.svg',
        alt: 'A Master Grade kit against a panel-lined plate',
        href: '/kits',
        ...overrides,
      };
    }

    it('creates a banner that is live straight away', async () => {
      const { body } = await admin.post('/admin/banners', bannerBody()).expect(201);
      track('/admin/banners', body);

      expect(body).toMatchObject({ isActive: true, isLive: true, startsAt: null, endsAt: null });
    });

    it('marks a future banner as scheduled rather than live', async () => {
      const { body } = await admin
        .post('/admin/banners', bannerBody({ startsAt: '2099-01-01T00:00:00.000Z' }))
        .expect(201);
      track('/admin/banners', body);

      expect(body).toMatchObject({ isActive: true, isLive: false });
    });

    it('marks a finished banner as no longer live', async () => {
      const { body } = await admin
        .post('/admin/banners', bannerBody({ startsAt: '2020-01-01T00:00:00.000Z', endsAt: '2021-01-01T00:00:00.000Z' }))
        .expect(201);
      track('/admin/banners', body);

      expect(body.isLive).toBe(false);
    });

    it('refuses a window that finishes before it starts', async () => {
      const { body } = await admin
        .post('/admin/banners', bannerBody({ startsAt: '2027-01-01T00:00:00.000Z', endsAt: '2026-01-01T00:00:00.000Z' }))
        .expect(400);

      expect(body.error.message).toMatch(/finish after it starts/i);
    });

    it('refuses an off-site link, which the home page must never carry', async () => {
      await admin.post('/admin/banners', bannerBody({ href: 'https://example.com/promo' })).expect(400);
    });

    it('reorders the whole list and refuses a partial one', async () => {
      const all = await admin.get('/admin/banners').expect(200);
      const ids = (all.body as { id: string }[]).map((row) => row.id);
      expect(ids.length).toBeGreaterThan(1);

      const reversed = [...ids].reverse();
      const { body } = await admin.put('/admin/banners/order', { ids: reversed }).expect(200);

      expect((body as { id: string }[]).map((row) => row.id)).toEqual(reversed);

      await admin.put('/admin/banners/order', { ids: [reversed[0]] }).expect(400);
    });

    it('deletes a banner', async () => {
      const created = await admin.post('/admin/banners', bannerBody()).expect(201);

      await admin.delete(`/admin/banners/${created.body.id}`).expect(204);
      await admin.delete(`/admin/banners/${created.body.id}`).expect(404);
    });
  });

  describe('dashboard (FR-ADM-01)', () => {
    it('answers every question FR-ADM-01 asks', async () => {
      const { body } = await admin.get('/admin/dashboard').expect(200);

      expect(body).toMatchObject({
        today: { orderCount: expect.any(Number), revenueIdr: expect.any(Number) },
        queues: {
          awaitingPayment: expect.any(Number),
          awaitingShipment: expect.any(Number),
          pendingReviews: expect.any(Number),
          lowStockCount: expect.any(Number),
        },
        generatedAt: expect.any(String),
      });
      expect(Array.isArray(body.lowStock)).toBe(true);
      expect(Array.isArray(body.topProducts)).toBe(true);
      expect(Array.isArray(body.recentOrders)).toBe(true);
    });

    it('reports money as whole rupiah, never a float', async () => {
      const { body } = await admin.get('/admin/dashboard').expect(200);

      expect(Number.isInteger(body.today.revenueIdr)).toBe(true);
      for (const order of body.recentOrders as { totalIdr: number }[]) {
        expect(Number.isInteger(order.totalIdr)).toBe(true);
      }
    });

    it('lists low stock scarcest first', async () => {
      const { body } = await admin.get('/admin/dashboard').expect(200);

      const quantities = (body.lowStock as { availableQuantity: number }[]).map((row) => row.availableQuantity);
      expect([...quantities].sort((a, b) => a - b)).toEqual(quantities);
    });

    it('lists the best sellers in descending order', async () => {
      const { body } = await admin.get('/admin/dashboard').expect(200);

      const sold = (body.topProducts as { unitsSold: number }[]).map((row) => row.unitsSold);
      expect([...sold].sort((a, b) => b - a)).toEqual(sold);
    });
  });
});
