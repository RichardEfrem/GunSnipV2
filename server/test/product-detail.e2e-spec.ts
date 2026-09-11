import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './create-test-app.js';

/**
 * The product page's own endpoints (FR-PDP-08, FR-PDP-10) against the seeded database.
 *
 * Assertions are relationships rather than counts: a test that pins "7 requirements" breaks
 * every time the seed gains a tool, which teaches people to update the number instead of
 * reading the failure.
 */
describe('Product detail endpoints', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  /** A Master Grade kit: waterslide decals, so its requirements span all three necessities. */
  const KIT = 'mg-1-100-nu-gundam-verka';

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /products/:slug/requirements', () => {
    it('lists the tools a kit needs (FR-PDP-08)', async () => {
      const { body } = await http.get(`/api/v1/products/${KIT}/requirements`).expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);

      for (const requirement of body) {
        expect(['REQUIRED', 'RECOMMENDED', 'OPTIONAL']).toContain(requirement.necessity);
        // The tool arrives as a full card, so the block's price cannot disagree with the
        // tool's own page.
        expect(requirement.tool).toHaveProperty('slug');
        expect(Number.isInteger(requirement.tool.priceIdr)).toBe(true);
      }
    });

    it('orders required before recommended before optional (DESIGN.md §3.5)', async () => {
      const { body } = await http.get(`/api/v1/products/${KIT}/requirements`).expect(200);

      const order = ['REQUIRED', 'RECOMMENDED', 'OPTIONAL'];
      const ranks = body.map((requirement: { necessity: string }) =>
        order.indexOf(requirement.necessity),
      );

      expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
    });

    it('names a buyable variant for every in-stock tool, so "Add selected" has something to add', async () => {
      const { body } = await http.get(`/api/v1/products/${KIT}/requirements`).expect(200);

      const inStock = body.filter(
        (requirement: { tool: { stockState: string } }) =>
          requirement.tool.stockState !== 'OUT_OF_STOCK',
      );

      expect(inStock.length).toBeGreaterThan(0);
      for (const requirement of inStock) {
        expect(requirement.variantId).toEqual(expect.any(String));
      }
    });

    it('returns an empty list for a tool rather than an error', async () => {
      const { body: tools } = await http
        .get('/api/v1/products?type=TOOL_SUPPLY&limit=1')
        .expect(200);

      const tool = tools.items[0];
      expect(tool).toBeDefined();

      const { body } = await http.get(`/api/v1/products/${tool.slug}/requirements`).expect(200);
      expect(body).toEqual([]);
    });

    it('404s on an unknown slug', async () => {
      await http.get('/api/v1/products/not-a-real-kit/requirements').expect(404);
    });
  });

  describe('GET /products/:slug/related', () => {
    it('returns the same unit at other grades and other kits from the series (FR-PDP-10)', async () => {
      const { body } = await http.get('/api/v1/products/mg-1-100-barbatos/related').expect(200);

      expect(body.sameUnit.length).toBeGreaterThan(0);
      // Every sibling is a different product...
      for (const product of body.sameUnit) {
        expect(product.slug).not.toBe('mg-1-100-barbatos');
      }
    });

    it('never repeats a product across the two rails', async () => {
      const { body } = await http.get('/api/v1/products/mg-1-100-barbatos/related').expect(200);

      const unitIds = new Set(body.sameUnit.map((product: { id: string }) => product.id));
      const overlap = body.sameSeries.filter((product: { id: string }) => unitIds.has(product.id));

      expect(overlap).toEqual([]);
    });

    it('keeps a different unit out of "also available as" even when the model number matches', async () => {
      // Barbatos, Barbatos Lupus and Barbatos Lupus Rex all share unit_code ASW-G-08. They are
      // different robots, so only the exact unit belongs in this rail (see `findSameUnit`).
      const { body } = await http.get('/api/v1/products/mg-1-100-barbatos/related').expect(200);

      for (const product of body.sameUnit) {
        expect(product.name).not.toMatch(/Lupus/i);
      }
    });

    it('404s on an unknown slug', async () => {
      await http.get('/api/v1/products/not-a-real-kit/related').expect(404);
    });
  });
});
