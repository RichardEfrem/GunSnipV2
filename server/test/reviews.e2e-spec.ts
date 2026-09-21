import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { adminClient, type AdminClient } from './admin-helpers.js';
import { addToCart, masterGradeKit, newSession, type GuestSession } from './cart-helpers.js';
import { jakartaDistrict, orderBodyFrom, placeOrder, quote } from './checkout-helpers.js';
import { createTestApp } from './create-test-app.js';
import { pngFixture } from './image-fixtures.js';

/**
 * Reviews end to end (FR-REV-01 … FR-REV-06), against a real database.
 *
 * The loop that matters is the one that cannot be faked: an order is delivered, which mints a
 * tokenised invite; the invite authorises exactly one review of exactly the thing that was
 * bought; the review is invisible until a moderator approves it; and approving it moves the
 * rating the whole catalogue quotes. Every step is the one the storefront and back office use.
 */
describe('Reviews', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let admin: AdminClient;
  let prisma: PrismaService;
  let jakarta: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    admin = adminClient(app);
    prisma = app.get(PrismaService);
    jakarta = await jakartaDistrict(http);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Buys a kit and walks it all the way to delivered, which is what issues the invite. */
  async function deliveredOrder(): Promise<{ orderNumber: string; session: GuestSession; variantId: string }> {
    const variantId = await masterGradeKit(http);
    const session = newSession();

    await addToCart(http, session, [{ variantId, quantity: 1 }]);
    const { body: quoted } = await quote(http, session, { regionId: jakarta, shippingTier: 'REGULAR' }).expect(200);
    const { body: order } = await placeOrder(http, session, orderBodyFrom(quoted, jakarta)).expect(201);

    await admin.post(`/admin/orders/${order.orderNumber}/payment`, { status: 'PAID' }).expect(200);
    await admin.post(`/admin/orders/${order.orderNumber}/status`, { status: 'PACKING' }).expect(200);
    await admin.put(`/admin/orders/${order.orderNumber}/shipment`, { courier: 'JNE' }).expect(200);
    await admin.post(`/admin/orders/${order.orderNumber}/status`, { status: 'SHIPPED' }).expect(200);
    await admin.post(`/admin/orders/${order.orderNumber}/status`, { status: 'DELIVERED' }).expect(200);

    return { orderNumber: order.orderNumber, session, variantId };
  }

  async function inviteTokenFor(orderNumber: string): Promise<string> {
    const invite = await prisma.reviewInvite.findFirstOrThrow({
      where: { orderItem: { order: { orderNumber } } },
      select: { token: true },
    });

    return invite.token;
  }

  describe('the invite (FR-REV-02)', () => {
    it('is minted when the order is delivered, one per line', async () => {
      const { orderNumber } = await deliveredOrder();

      const invites = await prisma.reviewInvite.findMany({
        where: { orderItem: { order: { orderNumber } } },
      });

      expect(invites).toHaveLength(1);
      expect(invites[0]?.usedAt).toBeNull();
      expect(invites[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('is not minted twice when delivery is recorded again', async () => {
      const { orderNumber } = await deliveredOrder();
      const first = await prisma.reviewInvite.count({ where: { orderItem: { order: { orderNumber } } } });

      // COMPLETED and back is not a legal move, so re-notifying is the closest thing an operator
      // can do — and it must not hand out a second live credential for the same purchase.
      await admin.post(`/admin/orders/${orderNumber}/status`, { status: 'COMPLETED' }).expect(200);

      expect(await prisma.reviewInvite.count({ where: { orderItem: { order: { orderNumber } } } })).toBe(first);
    });

    it('resolves to the product it authorises, and says whether to ask the build questions', async () => {
      const { orderNumber } = await deliveredOrder();
      const token = await inviteTokenFor(orderNumber);

      const { body } = await http.get(`/api/v1/reviews/invites/${token}`).expect(200);

      expect(body).toMatchObject({ token, orderNumber, isKit: true });
      expect(body.product.slug).toBe('mg-1-100-gundam-exia');
      expect(body.suggestedAuthorName).toBe('Amuro Ray');
    });

    it('404s a token nobody issued', async () => {
      await http.get(`/api/v1/reviews/invites/${randomUUID()}`).expect(404);
    });
  });

  describe('photos (FR-REV-01)', () => {
    let png: Buffer;

    beforeAll(async () => {
      png = await pngFixture();
    });

    function uploadPhoto(token: string): request.Test {
      return http
        .post('/api/v1/reviews/photos')
        .field('token', token)
        .attach('file', png, { filename: 'build.png', contentType: 'image/png' });
    }

    // One delivered order for the whole block: every spec buys from the same seeded stock, and a
    // refused submission does not spend the invite, so the refusal and the success can share it.
    it('accepts only photos uploaded here, compressed, against a live invite', async () => {
      const { orderNumber, session } = await deliveredOrder();
      const token = await inviteTokenFor(orderNumber);

      const review = (photos: { url: string; alt: string }[]) =>
        http.post('/api/v1/reviews').set('Cookie', session.cookie).send({
          token,
          rating: 5,
          authorName: 'Amuro',
          title: 'Look at this',
          body: 'Photo of the finished build, panel lined and top coated.',
          photos,
        });

      const { body: refused } = await review([
        { url: 'https://elsewhere.example/exia.jpg', alt: "Someone else's Exia" },
      ]).expect(400);
      expect(refused.error.message).toMatch(/uploaded here first/);

      const { body: photo } = await uploadPhoto(token).expect(201);
      expect(photo.url).toMatch(/^\/media\/uploads\/reviews\/[0-9a-f-]{36}\.webp$/);
      await http.get(photo.url).expect(200).expect('Content-Type', 'image/webp');

      const { body } = await review([{ url: photo.url, alt: 'The finished Exia, panel lined' }]).expect(201);

      const photos = await prisma.reviewPhoto.findMany({ where: { reviewId: body.id } });
      expect(photos.map((row) => row.url)).toEqual([photo.url]);
    });

    it('refuses an upload without a usable invite', async () => {
      await uploadPhoto(randomUUID()).expect(404);
    });
  });

  describe('submitting (FR-REV-01, FR-REV-03, FR-REV-04)', () => {
    it('accepts a review against the invite and marks it a verified purchase', async () => {
      const { orderNumber, session } = await deliveredOrder();
      const token = await inviteTokenFor(orderNumber);

      const { body } = await http
        .post('/api/v1/reviews')
        .set('Cookie', session.cookie)
        .send({
          token,
          rating: 5,
          authorName: 'Amuro',
          title: 'Superb kit',
          body: 'Panel lines are crisp and the articulation is excellent throughout.',
          buildTimeMinutes: 480,
          experiencedDifficulty: 'INTERMEDIATE',
          toolsUsed: ['God Hand nipper'],
        })
        .expect(201);

      expect(body.status).toBe('PENDING');

      const review = await prisma.review.findUniqueOrThrow({ where: { id: body.id } });
      expect(review.isVerifiedPurchase).toBe(true);
      expect(review.buildTimeMinutes).toBe(480);
      expect(review.status).toBe('PENDING');
    });

    it('spends the invite, so one purchase is one review', async () => {
      const { orderNumber, session } = await deliveredOrder();
      const token = await inviteTokenFor(orderNumber);

      const submit = () =>
        http.post('/api/v1/reviews').set('Cookie', session.cookie).send({
          token,
          rating: 4,
          authorName: 'Amuro',
          title: 'Good kit',
          body: 'Well engineered and a pleasant weekend build from start to finish.',
        });

      await submit().expect(201);
      await submit().expect(409);
    });

    it('refuses a review with no invite at all', async () => {
      await http
        .post('/api/v1/reviews')
        .send({
          token: randomUUID(),
          rating: 5,
          authorName: 'Nobody',
          title: 'Never bought it',
          body: 'This review should not be accepted by the server under any circumstances.',
        })
        .expect(404);
    });

    it('validates the body rather than storing whatever arrives', async () => {
      const { orderNumber, session } = await deliveredOrder();
      const token = await inviteTokenFor(orderNumber);

      await http
        .post('/api/v1/reviews')
        .set('Cookie', session.cookie)
        .send({ token, rating: 9, authorName: 'A', title: 'x', body: 'short' })
        .expect(400);
    });
  });

  describe('on the product page (FR-REV-05, FR-REV-06)', () => {
    const SLUG = 'mg-1-100-gundam-exia';

    /**
     * The seeded product carrying the most approved reviews, so the sorting, paging and histogram
     * specs have a real distribution to work against rather than whatever the specs above
     * happened to leave behind.
     */
    let busiest: string;

    beforeAll(async () => {
      const [row] = await prisma.review.groupBy({
        by: ['productId'],
        where: { status: 'APPROVED' },
        _count: { _all: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 1,
      });

      const product = await prisma.product.findUniqueOrThrow({
        where: { id: row?.productId ?? '' },
        select: { slug: true },
      });

      busiest = product.slug;
    });

    it('hides a review until it is approved, then shows it', async () => {
      const { orderNumber, session } = await deliveredOrder();
      const token = await inviteTokenFor(orderNumber);

      const { body: created } = await http
        .post('/api/v1/reviews')
        .set('Cookie', session.cookie)
        .send({
          token,
          rating: 5,
          authorName: 'Amuro Moderated',
          title: 'Worth every rupiah',
          body: 'The inner frame alone justifies the price; a genuinely satisfying build.',
        })
        .expect(201);

      const before = await http.get(`/api/v1/products/${SLUG}/reviews`).expect(200);
      const isListed = (page: { body: { items: { id: string }[] } }): boolean =>
        page.body.items.some((item) => item.id === created.id);

      expect(isListed(before)).toBe(false);

      await admin.post(`/admin/reviews/${created.id}/moderation`, { status: 'APPROVED' }).expect(200);

      const after = await http.get(`/api/v1/products/${SLUG}/reviews?sort=newest`).expect(200);
      expect(isListed(after)).toBe(true);
    });

    it('summarises every approved review, not just the page being shown', async () => {
      const { body } = await http.get(`/api/v1/products/${busiest}/reviews?limit=1`).expect(200);

      expect(body.items).toHaveLength(1);
      expect(body.summary.count).toBeGreaterThan(1);
      expect(body.summary.histogram).toHaveLength(5);
      expect(body.summary.histogram.map((bucket: { rating: number }) => bucket.rating)).toEqual([5, 4, 3, 2, 1]);

      const counted = body.summary.histogram.reduce(
        (total: number, bucket: { count: number }) => total + bucket.count,
        0,
      );
      expect(counted).toBe(body.summary.count);
    });

    it('sorts by highest and lowest', async () => {
      const highest = await http.get(`/api/v1/products/${busiest}/reviews?sort=highest&limit=20`).expect(200);
      const lowest = await http.get(`/api/v1/products/${busiest}/reviews?sort=lowest&limit=20`).expect(200);

      const ratings = (page: { body: { items: { rating: number }[] } }): number[] =>
        page.body.items.map((item) => item.rating);

      expect(ratings(highest)).toEqual([...ratings(highest)].sort((a, b) => b - a));
      expect(ratings(lowest)).toEqual([...ratings(lowest)].sort((a, b) => a - b));
    });

    it('pages without repeating or skipping a review', async () => {
      const first = await http.get(`/api/v1/products/${busiest}/reviews?sort=highest&limit=3`).expect(200);
      expect(first.body.nextCursor).not.toBeNull();

      const second = await http
        .get(
          `/api/v1/products/${busiest}/reviews?sort=highest&limit=3&cursor=${encodeURIComponent(first.body.nextCursor)}`,
        )
        .expect(200);

      const ids = new Set(first.body.items.map((item: { id: string }) => item.id));
      for (const item of second.body.items as { id: string }[]) expect(ids.has(item.id)).toBe(false);
    });

    it('filters to reviews with photos', async () => {
      const { body } = await http.get(`/api/v1/products/${busiest}/reviews?withPhotos=true&limit=20`).expect(200);

      for (const item of body.items as { photos: unknown[] }[]) expect(item.photos.length).toBeGreaterThan(0);
    });

    it('never leaks who wrote a review', async () => {
      const { body } = await http.get(`/api/v1/products/${busiest}/reviews?limit=5`).expect(200);

      for (const item of body.items as Record<string, unknown>[]) {
        expect(item).not.toHaveProperty('sessionId');
        expect(item).not.toHaveProperty('userId');
        expect(item).not.toHaveProperty('status');
      }
    });

    it('404s a product that does not exist', async () => {
      await http.get('/api/v1/products/not-a-product/reviews').expect(404);
    });
  });
});
