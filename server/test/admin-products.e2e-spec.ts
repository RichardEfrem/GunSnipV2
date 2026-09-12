import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, seededRefs, unique, type AdminClient } from './admin-helpers.js';
import { createTestApp } from './create-test-app.js';

/**
 * Product CRUD, variants, images and requirements (FR-ADM-02 … FR-ADM-06), against a real
 * database.
 *
 * The exit criterion for Phase 9 is DoD §13.9 — create a product with variants and images in
 * admin, see it live on the storefront — so the last block here walks exactly that, ending on
 * the storefront's own endpoints rather than the admin ones.
 */
describe('Admin products', () => {
  let app: INestApplication;
  let admin: AdminClient;
  let refs: Awaited<ReturnType<typeof seededRefs>>;

  /**
   * Every product this spec publishes, archived when it finishes.
   *
   * The e2e suite seeds once (`global-setup.ts`) and every spec shares that database, so a
   * published product left behind is one the catalogue spec counts — and which of the two specs
   * runs first would decide whether the suite passes. Drafts need no cleanup: they are invisible
   * to the storefront by definition, which is the whole point of the status.
   *
   * Archived rather than deleted because there is no delete: a product is referenced by every
   * order that bought it, and FR-ORD-05 makes those snapshots permanent.
   */
  const published: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    admin = adminClient(app);
    refs = await seededRefs(admin);
  });

  afterAll(async () => {
    for (const id of published) {
      await admin.put(`/admin/products/${id}/status`, { status: 'ARCHIVED' });
    }

    await app.close();
  });

  /** The created product, loosely typed — a spec asserts on the fields it names, not a contract. */
  interface CreatedProduct {
    id: string;
    slug: string;
    requirements: unknown[];
  }

  async function createKit(overrides: Record<string, unknown> = {}): Promise<CreatedProduct> {
    const suffix = unique();

    const { body } = await admin
      .post('/admin/products', {
        type: 'MODEL_KIT',
        name: `MG Test Kit ${suffix}`,
        brandId: refs.brandId,
        categoryId: refs.kitCategoryId,
        kit: { gradeId: refs.gradeId, scaleId: refs.scaleId, unitCode: `TST-${suffix}` },
        ...overrides,
      })
      .expect(201);

    return body;
  }

  describe('creation (FR-ADM-02)', () => {
    it('creates a kit as a draft, never live by accident', async () => {
      const product = await createKit();

      expect(product).toMatchObject({ type: 'MODEL_KIT', status: 'DRAFT', publishedAt: null });
    });

    it('derives a slug from the name when none is given', async () => {
      const { body } = await admin
        .post('/admin/products', {
          type: 'MODEL_KIT',
          name: 'MG Gundam Épyon EW Slug Test',
          brandId: refs.brandId,
          categoryId: refs.kitCategoryId,
        })
        .expect(201);

      expect(body.slug).toBe('mg-gundam-epyon-ew-slug-test');
    });

    it('makes a colliding slug unique rather than failing', async () => {
      const name = `MG Collision ${unique()}`;
      const first = await admin
        .post('/admin/products', { type: 'MODEL_KIT', name, brandId: refs.brandId, categoryId: refs.kitCategoryId })
        .expect(201);
      const second = await admin
        .post('/admin/products', { type: 'MODEL_KIT', name, brandId: refs.brandId, categoryId: refs.kitCategoryId })
        .expect(201);

      expect(second.body.slug).toBe(`${first.body.slug}-2`);
    });

    it('refuses tool fields on a kit', async () => {
      const { body } = await admin
        .post('/admin/products', {
          type: 'MODEL_KIT',
          name: `MG Wrong Fields ${unique()}`,
          brandId: refs.brandId,
          categoryId: refs.kitCategoryId,
          tool: { toolJob: 'CUTTING' },
        })
        .expect(409);

      expect(body.error.message).toMatch(/do not belong on a model kit/i);
    });

    it('refuses kit fields on a tool', async () => {
      await admin
        .post('/admin/products', {
          type: 'TOOL_SUPPLY',
          name: `Test Nipper ${unique()}`,
          brandId: refs.brandId,
          categoryId: refs.toolCategoryId,
          kit: { runnerCount: 4 },
        })
        .expect(409);
    });

    it('copies the grade tool defaults onto a new kit (PRD §5.3)', async () => {
      const product = await createKit();

      // The seed curates defaults per grade; MG has them, so a new MG kit arrives with the
      // nipper requirement already attached rather than needing it added by hand.
      expect(product.requirements.length).toBeGreaterThan(0);
    });

    it('skips the grade defaults when asked to', async () => {
      const product = await createKit({ applyGradeDefaults: false });

      expect(product.requirements).toHaveLength(0);
    });
  });

  describe('publishing (FR-ADM-02)', () => {
    it('refuses to publish a product with nothing to sell', async () => {
      const product = await createKit();

      const { body } = await admin.put(`/admin/products/${product.id}/status`, { status: 'PUBLISHED' }).expect(400);

      expect(body.error.message).toMatch(/at least one variant/i);
    });

    it('refuses to publish a product with no image, whose card would render empty', async () => {
      const product = await createKit();
      await admin
        .post(`/admin/products/${product.id}/variants`, { sku: `TST-${unique()}`.toUpperCase(), priceIdr: 500_000 })
        .expect(201);

      const { body } = await admin.put(`/admin/products/${product.id}/status`, { status: 'PUBLISHED' }).expect(400);

      expect(body.error.message).toMatch(/at least one image/i);
    });
  });

  describe('variants (FR-ADM-03)', () => {
    it('adds a variant and updates the product price range', async () => {
      const product = await createKit();

      const { body } = await admin
        .post(`/admin/products/${product.id}/variants`, {
          sku: `TSTV-${unique()}`.toUpperCase(),
          priceIdr: 750_000,
          openingStock: 6,
        })
        .expect(201);

      expect(body.minPriceIdr).toBe(750_000);
      expect(body.maxPriceIdr).toBe(750_000);
      expect(body.variants[0]).toMatchObject({ stockOnHand: 6, stockReserved: 0, availableQuantity: 6 });
    });

    it('widens the range as cheaper and dearer variants arrive', async () => {
      const product = await createKit();

      await admin
        .post(`/admin/products/${product.id}/variants`, { sku: `TSTA-${unique()}`.toUpperCase(), priceIdr: 750_000 })
        .expect(201);
      const { body } = await admin
        .post(`/admin/products/${product.id}/variants`, { sku: `TSTB-${unique()}`.toUpperCase(), priceIdr: 450_000 })
        .expect(201);

      expect(body).toMatchObject({ minPriceIdr: 450_000, maxPriceIdr: 750_000 });
    });

    it('drops an archived variant out of the price range', async () => {
      const product = await createKit();
      const withOne = await admin
        .post(`/admin/products/${product.id}/variants`, { sku: `TSTC-${unique()}`.toUpperCase(), priceIdr: 450_000 })
        .expect(201);
      const withTwo = await admin
        .post(`/admin/products/${product.id}/variants`, { sku: `TSTD-${unique()}`.toUpperCase(), priceIdr: 9_900_000 })
        .expect(201);

      expect(withTwo.body.maxPriceIdr).toBe(9_900_000);

      const dear = (withTwo.body.variants as { id: string; priceIdr: number }[]).find(
        (variant) => variant.priceIdr === 9_900_000,
      );
      const { body } = await admin.patch(`/admin/variants/${dear?.id}`, { isArchived: true }).expect(200);

      expect(body.maxPriceIdr).toBe(450_000);
      expect(withOne.body.minPriceIdr).toBe(450_000);
    });

    it('refuses a duplicate SKU', async () => {
      const product = await createKit();
      const sku = `TSTE-${unique()}`.toUpperCase();

      await admin.post(`/admin/products/${product.id}/variants`, { sku, priceIdr: 450_000 }).expect(201);

      const { body } = await admin
        .post(`/admin/products/${product.id}/variants`, { sku, priceIdr: 500_000 })
        .expect(409);

      expect(body.error.message).toMatch(/already belongs to another variant/i);
    });

    it('refuses a struck-through price below the price being charged (FR-PROMO-03)', async () => {
      const product = await createKit();

      const { body } = await admin
        .post(`/admin/products/${product.id}/variants`, {
          sku: `TSTF-${unique()}`.toUpperCase(),
          priceIdr: 500_000,
          compareAtPriceIdr: 400_000,
        })
        .expect(400);

      expect(body.error.message).toMatch(/higher than the price being charged/i);
    });

    it('writes an opening balance as a RESTOCK movement, so the first units are explained', async () => {
      const product = await createKit();
      const { body } = await admin
        .post(`/admin/products/${product.id}/variants`, {
          sku: `TSTG-${unique()}`.toUpperCase(),
          priceIdr: 450_000,
          openingStock: 12,
        })
        .expect(201);

      const variantId = (body.variants as { id: string }[])[0].id;
      const movements = await admin.get(`/admin/variants/${variantId}/movements`).expect(200);

      expect(movements.body.items[0]).toMatchObject({ delta: 12, reason: 'RESTOCK', actorKind: 'ADMIN' });
    });
  });

  describe('build requirements (FR-ADM-06)', () => {
    it('refuses a requirement that names something other than a tool', async () => {
      const kit = await createKit();
      const otherKit = await createKit();

      const { body } = await admin
        .put(`/admin/products/${kit.id}/requirements`, {
          requirements: [{ toolProductId: otherKit.id, necessity: 'REQUIRED' }],
        })
        .expect(400);

      expect(body.error.message).toMatch(/has to name a tool/i);
    });

    it('refuses a kit that requires itself', async () => {
      const kit = await createKit();

      await admin
        .put(`/admin/products/${kit.id}/requirements`, {
          requirements: [{ toolProductId: kit.id, necessity: 'REQUIRED' }],
        })
        .expect(400);
    });

    it('refuses the same tool listed twice', async () => {
      const kit = await createKit();
      const tools = await admin.get('/admin/products?type=TOOL_SUPPLY&limit=1').expect(200);
      const toolId = (tools.body.items as { id: string }[])[0].id;

      const { body } = await admin
        .put(`/admin/products/${kit.id}/requirements`, {
          requirements: [
            { toolProductId: toolId, necessity: 'REQUIRED' },
            { toolProductId: toolId, necessity: 'RECOMMENDED' },
          ],
        })
        .expect(400);

      expect(body.error.message).toMatch(/listed more than once/i);
    });

    it('replaces the list wholesale, in the order sent', async () => {
      const kit = await createKit();
      const tools = await admin.get('/admin/products?type=TOOL_SUPPLY&limit=2').expect(200);
      const [first, second] = tools.body.items as { id: string }[];

      const { body } = await admin
        .put(`/admin/products/${kit.id}/requirements`, {
          requirements: [
            { toolProductId: second.id, necessity: 'REQUIRED', reason: 'You cannot cut runners without it.' },
            { toolProductId: first.id, necessity: 'RECOMMENDED' },
          ],
        })
        .expect(200);

      expect(body.requirements.map((row: { toolProductId: string }) => row.toolProductId)).toEqual([
        second.id,
        first.id,
      ]);
      expect(body.requirements[0]).toMatchObject({ necessity: 'REQUIRED', position: 0 });
    });

    it('refuses build requirements on a tool', async () => {
      const { body: tool } = await admin
        .post('/admin/products', {
          type: 'TOOL_SUPPLY',
          name: `Test Tool ${unique()}`,
          brandId: refs.brandId,
          categoryId: refs.toolCategoryId,
        })
        .expect(201);

      await admin.put(`/admin/products/${tool.id}/requirements`, { requirements: [] }).expect(409);
    });
  });

  describe('listing (FR-ADM-02)', () => {
    it('shows drafts, which the storefront never does', async () => {
      const product = await createKit();

      const { body } = await admin.get('/admin/products?status=DRAFT&limit=100').expect(200);

      expect((body.items as { id: string }[]).some((row) => row.id === product.id)).toBe(true);
    });

    it('finds a product by SKU', async () => {
      const product = await createKit();
      const sku = `TSTH-${unique()}`.toUpperCase();
      await admin.post(`/admin/products/${product.id}/variants`, { sku, priceIdr: 450_000 }).expect(201);

      const { body } = await admin.get(`/admin/products?q=${sku}`).expect(200);

      expect((body.items as { id: string }[])[0].id).toBe(product.id);
    });

    it('pages with a cursor and never repeats a row', async () => {
      const first = await admin.get('/admin/products?limit=5').expect(200);
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await admin
        .get(`/admin/products?limit=5&cursor=${encodeURIComponent(first.body.nextCursor)}`)
        .expect(200);

      const firstIds = (first.body.items as { id: string }[]).map((row) => row.id);
      const secondIds = (second.body.items as { id: string }[]).map((row) => row.id);

      expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    });

    it('rejects a cursor that cannot be read, rather than silently starting over', async () => {
      const { body } = await admin.get('/admin/products?cursor=not-a-real-cursor').expect(400);

      expect(body.error.message).toMatch(/no longer valid/i);
    });
  });

  /** DoD §13.9 — the phase's exit criterion, ending on the storefront's own endpoints. */
  describe('DoD §13.9: a product created in admin appears on the storefront', () => {
    it('goes from nothing to a live, buyable product', async () => {
      const suffix = unique();
      const http = request(app.getHttpServer());

      const { body: created } = await admin
        .post('/admin/products', {
          type: 'MODEL_KIT',
          name: `MG Exit Criterion ${suffix}`,
          description: 'Created by the Phase 9 exit criterion.',
          brandId: refs.brandId,
          categoryId: refs.kitCategoryId,
          kit: { gradeId: refs.gradeId, scaleId: refs.scaleId, unitName: 'Exit Criterion Gundam' },
        })
        .expect(201);

      // Invisible while it is a draft.
      await http.get(`/api/v1/products/${created.slug}`).expect(404);

      await admin
        .post(`/admin/products/${created.id}/variants`, {
          sku: `EXIT-${suffix}`.toUpperCase(),
          priceIdr: 1_250_000,
          openingStock: 8,
        })
        .expect(201);

      await admin
        .raw()
        .post(`/api/v1/admin/products/${created.id}/images`)
        .set('x-admin-key', admin.key)
        .field('alt', 'The Exit Criterion Gundam posed against a panel-lined plate')
        .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'), {
          filename: 'exit.svg',
          contentType: 'image/svg+xml',
        })
        .expect(201);

      const { body: live } = await admin
        .put(`/admin/products/${created.id}/status`, { status: 'PUBLISHED' })
        .expect(200);
      published.push(created.id);

      expect(live.publishedAt).toEqual(expect.any(String));

      // Live on the storefront, with the price and stock admin gave it.
      const { body: storefront } = await http.get(`/api/v1/products/${created.slug}`).expect(200);

      expect(storefront).toMatchObject({
        name: `MG Exit Criterion ${suffix}`,
        priceIdr: 1_250_000,
        stockState: 'IN_STOCK',
        availableQuantity: 8,
      });
      expect(storefront.images).toHaveLength(1);
      expect(storefront.images[0].alt).toMatch(/panel-lined plate/);

      // And reachable through the listing, not only by its own slug.
      const { body: listing } = await http.get(`/api/v1/products?limit=60&sort=newest`).expect(200);
      expect((listing.items as { slug: string }[]).some((row) => row.slug === storefront.slug)).toBe(true);

      // Archiving takes it back off the storefront, which is what the cleanup relies on.
      await admin.put(`/admin/products/${created.id}/status`, { status: 'ARCHIVED' }).expect(200);
      await http.get(`/api/v1/products/${created.slug}`).expect(404);
    });
  });
});
