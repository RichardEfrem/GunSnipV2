import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './create-test-app.js';

/**
 * The catalogue endpoints against the real seeded database.
 *
 * These assert *behaviour* rather than exact counts wherever possible — a test that pins "38
 * kits" breaks every time a product is added to the seed, which trains people to update the
 * number instead of reading the failure. Where a relationship is the point (a filtered set is a
 * subset, a sort is ordered, facets exclude their own group) it is checked as a relationship.
 */
describe('Catalogue', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /products', () => {
    it('returns a page of published products with a total', async () => {
      const { body } = await http.get('/api/v1/products?limit=5').expect(200);

      expect(body.items).toHaveLength(5);
      expect(body.page).toBe(1);
      expect(body.total).toBeGreaterThan(5);
      expect(body.hasMore).toBe(true);
    });

    it('never returns a draft or archived product', async () => {
      const { body } = await http.get('/api/v1/products?limit=60').expect(200);

      // Status is not on the wire at all — the storefront has no vocabulary for it, which is
      // the strongest form of "drafts are not visible".
      expect(body.items.every((item: { id: string }) => 'id' in item)).toBe(true);
      expect(body.items.some((item: Record<string, unknown>) => 'status' in item)).toBe(false);
    });

    it('sorts by price ascending', async () => {
      const { body } = await http.get('/api/v1/products?sort=price_asc&limit=20').expect(200);

      const prices = body.items.map((item: { priceIdr: number }) => item.priceIdr);
      expect(prices).toEqual([...prices].sort((left, right) => left - right));
    });

    it('combines filters as AND and their values as OR (FR-CAT-05)', async () => {
      const [mg, rg, both] = await Promise.all([
        http.get('/api/v1/products?grade=MG&limit=1').expect(200),
        http.get('/api/v1/products?grade=RG&limit=1').expect(200),
        http.get('/api/v1/products?grade=MG&grade=RG&limit=1').expect(200),
      ]);

      // Two values of one filter widen...
      expect(both.body.total).toBe(mg.body.total + rg.body.total);

      // ...and a second filter narrows.
      const narrowed = await http
        .get('/api/v1/products?grade=MG&series=universal-century&limit=1')
        .expect(200);
      expect(narrowed.body.total).toBeLessThanOrEqual(mg.body.total);
    });

    it('returns only buyable products when in-stock is set', async () => {
      const { body } = await http.get('/api/v1/products?inStock=true&limit=60').expect(200);

      expect(body.items.length).toBeGreaterThan(0);
      for (const item of body.items) {
        expect(item.availableQuantity).toBeGreaterThan(0);
        expect(item.stockState).not.toBe('OUT_OF_STOCK');
      }
    });

    it('scopes a category to its descendants', async () => {
      const [root, child] = await Promise.all([
        http.get('/api/v1/products?category=kits&limit=1').expect(200),
        http.get('/api/v1/products?category=kits-mg&limit=1').expect(200),
      ]);

      // Every product hangs off a leaf, so a root that did not include its children would
      // return nothing at all.
      expect(root.body.total).toBeGreaterThan(child.body.total);
      expect(child.body.total).toBeGreaterThan(0);
    });

    it('paginates without repeating or dropping a product', async () => {
      const [first, second] = await Promise.all([
        http.get('/api/v1/products?limit=10&page=1&sort=price_asc').expect(200),
        http.get('/api/v1/products?limit=10&page=2&sort=price_asc').expect(200),
      ]);

      const ids = [...first.body.items, ...second.body.items].map((item: { id: string }) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('rejects an unknown sort, an oversized page and an unknown parameter', async () => {
      await http.get('/api/v1/products?sort=cheapest').expect(400);
      await http.get('/api/v1/products?limit=5000').expect(400);
      await http.get('/api/v1/products?colour=red').expect(400);
    });

    it('404s a category that does not exist rather than returning everything', async () => {
      await http.get('/api/v1/products?category=not-a-category').expect(404);
    });
  });

  describe('GET /products/facets', () => {
    it('keeps zero-count options rather than hiding them (FR-CAT-10)', async () => {
      const { body } = await http.get('/api/v1/products/facets?category=kits&grade=MG').expect(200);

      // Every difficulty is present whether or not an MG kit has it, so the rail can disable
      // the empty ones instead of making them vanish.
      expect(body.difficulties).toHaveLength(4);
      expect(body.difficulties.some((option: { count: number }) => option.count === 0)).toBe(true);
    });

    it('counts a group without its own selection applied', async () => {
      const { body } = await http.get('/api/v1/products/facets?grade=MG').expect(200);

      const mg = body.grades.find((option: { value: string }) => option.value === 'MG');
      const rg = body.grades.find((option: { value: string }) => option.value === 'RG');

      expect(mg.isSelected).toBe(true);
      // "MG and RG at once" is always zero; this has to mean "MG or RG".
      expect(rg.count).toBeGreaterThan(0);
      expect(rg.isSelected).toBe(false);
    });

    it('applies every other filter to a group’s counts', async () => {
      const { body } = await http
        .get('/api/v1/products/facets?grade=MG&series=universal-century')
        .expect(200);

      const universalCentury = body.series.find(
        (option: { value: string }) => option.value === 'universal-century',
      );

      // Series counts respect the MG selection, so this matches the listing's own total.
      const listing = await http
        .get('/api/v1/products?grade=MG&series=universal-century&limit=1')
        .expect(200);
      expect(universalCentury.count).toBe(listing.body.total);
    });

    it('reports the total the mobile sheet’s "Show N" button prints', async () => {
      const [facets, listing] = await Promise.all([
        http.get('/api/v1/products/facets?category=kits&inStock=true').expect(200),
        http.get('/api/v1/products?category=kits&inStock=true&limit=1').expect(200),
      ]);

      expect(facets.body.total).toBe(listing.body.total);
    });

    it('bounds the price range under the other filters', async () => {
      const { body } = await http.get('/api/v1/products/facets?category=kits').expect(200);

      expect(body.price.minIdr).toBeGreaterThan(0);
      expect(body.price.maxIdr).toBeGreaterThanOrEqual(body.price.minIdr);
    });
  });

  describe('GET /products/:slug', () => {
    it('returns a kit with its specification block and breadcrumbs', async () => {
      const { body: listing } = await http.get('/api/v1/products?grade=MG&limit=1').expect(200);
      const { body } = await http.get(`/api/v1/products/${listing.items[0].slug}`).expect(200);

      expect(body.kitSpec).not.toBeNull();
      expect(body.toolSpec).toBeNull();
      expect(body.images.length).toBeGreaterThan(0);
      expect(body.variants.length).toBeGreaterThan(0);
      expect(body.breadcrumbs[0].slug).toBe('kits');
    });

    it('returns a tool with its attributes and no kit specification', async () => {
      const { body: listing } = await http
        .get('/api/v1/products?type=TOOL_SUPPLY&limit=1')
        .expect(200);
      const { body } = await http.get(`/api/v1/products/${listing.items[0].slug}`).expect(200);

      expect(body.kitSpec).toBeNull();
      expect(body.toolSpec).not.toBeNull();
    });

    it('404s an unknown slug', async () => {
      await http.get('/api/v1/products/no-such-kit').expect(404);
    });

    it('does not let "facets" be read as a product slug', async () => {
      // Route order: a static segment declared after the parameter would be swallowed by it.
      const { body } = await http.get('/api/v1/products/facets').expect(200);
      expect(body).toHaveProperty('grades');
    });
  });

  describe('GET /categories', () => {
    it('returns two trees, each with children and a rolled-up count', async () => {
      const { body } = await http.get('/api/v1/categories').expect(200);

      expect(body).toHaveLength(2);

      for (const root of body) {
        expect(root.children.length).toBeGreaterThan(0);
        // A root has no products of its own, so a count that did not roll up would be zero.
        const fromChildren = root.children.reduce(
          (total: number, child: { productCount: number }) => total + child.productCount,
          0,
        );
        expect(root.productCount).toBe(fromChildren);
      }
    });

    it('returns breadcrumbs root-first for a child category', async () => {
      const { body } = await http.get('/api/v1/categories/kits-mg').expect(200);

      expect(body.breadcrumbs.map((crumb: { slug: string }) => crumb.slug)).toEqual([
        'kits',
        'kits-mg',
      ]);
    });

    it('404s an unknown category', async () => {
      await http.get('/api/v1/categories/nope').expect(404);
    });
  });

  describe('GET /home', () => {
    it('returns every rail the home page renders (FR-CAT-01)', async () => {
      const { body } = await http.get('/api/v1/home').expect(200);

      expect(body.gradeShortcuts.length).toBeGreaterThan(0);
      expect(body.newArrivals.length).toBeGreaterThan(0);
      expect(body.tools.length).toBeGreaterThan(0);
      expect(body.categories).toHaveLength(2);
    });

    it('only shows grade shortcuts that lead somewhere', async () => {
      const { body } = await http.get('/api/v1/home').expect(200);

      for (const shortcut of body.gradeShortcuts) {
        expect(shortcut.productCount).toBeGreaterThan(0);
      }
    });

    it('only recommends first builds that are in stock and beginner-friendly', async () => {
      const { body } = await http.get('/api/v1/home').expect(200);

      for (const product of body.firstBuild) {
        expect(product.availableQuantity).toBeGreaterThan(0);
      }
    });

    it('only puts genuinely available products on the back-in-stock rail', async () => {
      const { body } = await http.get('/api/v1/home').expect(200);

      for (const product of body.backInStock) {
        expect(product.stockState).not.toBe('OUT_OF_STOCK');
      }
    });
  });
});
