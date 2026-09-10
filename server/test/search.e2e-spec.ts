import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './create-test-app.js';

/**
 * Search against the real seeded database (FR-SRCH-02 … FR-SRCH-07).
 *
 * Like the catalogue suite, these assert relationships rather than counts wherever they can — a
 * test pinned to "5 Barbatos kits" fails every time the seed grows and trains people to update
 * the number instead of reading the failure. The exception is DoD §13.2, which *is* a statement
 * about two specific queries returning the same products, so it is written as one.
 */
describe('Search', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  const names = (body: { items: { name: string }[] }): string[] =>
    body.items.map((item) => item.name);

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /search', () => {
    it('finds products by full text (FR-SRCH-02)', async () => {
      const { body } = await http.get('/api/v1/search?q=barbatos').expect(200);

      expect(body.strategy).toBe('FULL_TEXT');
      expect(body.total).toBeGreaterThan(0);
      expect(names(body).every((name) => name.toLowerCase().includes('barbatos'))).toBe(true);
    });

    /** DoD §13.2, the exit criterion for this phase. */
    it('finds the same kits whether or not the query is spelled correctly', async () => {
      const [correct, typo] = await Promise.all([
        http.get('/api/v1/search?q=barbatos').expect(200),
        http.get('/api/v1/search?q=barbatso').expect(200),
      ]);

      expect(correct.body.strategy).toBe('FULL_TEXT');
      expect(typo.body.strategy).toBe('FUZZY');
      expect(typo.body.total).toBeGreaterThan(0);
      expect(names(typo.body).sort()).toEqual(names(correct.body).sort());
    });

    it('offers a correction when the spelling missed (FR-SRCH-05, FR-SRCH-07)', async () => {
      const { body } = await http.get('/api/v1/search?q=barbatso').expect(200);

      expect(body.didYouMean).toBe('barbatos');
    });

    it('offers no correction when the query was exact — a search should not doubt itself', async () => {
      const { body } = await http.get('/api/v1/search?q=barbatos').expect(200);

      expect(body.didYouMean).toBeNull();
    });

    it('resolves a community name through the synonym table (FR-SRCH-04)', async () => {
      // "ibo" appears in no product name. It reaches the Barbatos kits only via the expansion.
      const { body } = await http.get('/api/v1/search?q=ibo').expect(200);

      expect(body.total).toBeGreaterThan(0);
      expect(names(body).some((name) => name.toLowerCase().includes('barbatos'))).toBe(true);
    });

    it('narrows rather than widens when a second word is added', async () => {
      // A synonym widens the term it is attached to; the other terms still have to match.
      const [broad, narrow] = await Promise.all([
        http.get('/api/v1/search?q=barbatos').expect(200),
        http.get('/api/v1/search?q=mg%20barbatos').expect(200),
      ]);

      expect(narrow.body.total).toBeLessThan(broad.body.total);
      expect(narrow.body.total).toBeGreaterThan(0);
    });

    it('applies the catalogue filters to a search (FR-SRCH-06)', async () => {
      const [all, filtered] = await Promise.all([
        http.get('/api/v1/search?q=gundam').expect(200),
        http.get('/api/v1/search?q=gundam&grade=MG').expect(200),
      ]);

      expect(filtered.body.total).toBeLessThan(all.body.total);
      expect(filtered.body.items.every((item: { grade: { code: string } }) => item.grade.code === 'MG')).toBe(true);
    });

    it('defaults to relevance but honours an explicit sort', async () => {
      const { body } = await http.get('/api/v1/search?q=gundam&sort=price_asc&limit=10').expect(200);

      const prices = body.items.map((item: { priceIdr: number }) => item.priceIdr);
      expect(prices).toEqual([...prices].sort((left, right) => left - right));
    });

    it('answers a query that matches nothing without failing (FR-SRCH-07)', async () => {
      const { body } = await http.get('/api/v1/search?q=zzzqqqxxx').expect(200);

      expect(body.strategy).toBe('NONE');
      expect(body.total).toBe(0);
      expect(body.items).toEqual([]);
    });

    it('treats tsquery operators as text rather than syntax', async () => {
      // `to_tsquery` would parse these and throw; `plainto_tsquery` cannot be talked into it.
      for (const query of ['barbatos%20%26%20!gundam', "'%3B%20DROP%20TABLE%20product%3B%20--", '%26%7C!()']) {
        await http.get(`/api/v1/search?q=${query}`).expect(200);
      }
    });

    it('rejects a missing or empty query rather than listing the catalogue', async () => {
      await http.get('/api/v1/search').expect(400);
      await http.get('/api/v1/search?q=').expect(400);
    });
  });

  describe('GET /search/facets', () => {
    it('counts only what the query matched (FR-SRCH-06)', async () => {
      const [searchFacets, allFacets] = await Promise.all([
        http.get('/api/v1/search/facets?q=barbatos').expect(200),
        http.get('/api/v1/products/facets').expect(200),
      ]);

      expect(searchFacets.body.total).toBeGreaterThan(0);
      expect(searchFacets.body.total).toBeLessThan(allFacets.body.total);
    });

    it('still returns every option, including the ones with no matches (FR-CAT-10)', async () => {
      const { body } = await http.get('/api/v1/search/facets?q=barbatos').expect(200);

      // Options that vanish as you tick make the filter set feel unstable, so zero-count
      // options are returned and rendered disabled rather than dropped.
      expect(body.grades.length).toBeGreaterThan(1);
      expect(body.grades.some((option: { count: number }) => option.count === 0)).toBe(true);
    });

    it('takes no sort or page — counts do not paginate', async () => {
      await http.get('/api/v1/search/facets?q=barbatos&sort=newest').expect(400);
      await http.get('/api/v1/search/facets?q=barbatos&page=2').expect(400);
    });
  });

  describe('GET /search/suggest', () => {
    it('matches the last word as a prefix, so a half-typed query still suggests (FR-SRCH-03)', async () => {
      const { body } = await http.get('/api/v1/search/suggest?q=barb').expect(200);

      expect(body.products.length).toBeGreaterThan(0);
      expect(
        body.products.every((item: { name: string }) =>
          item.name.toLowerCase().includes('barbatos'),
        ),
      ).toBe(true);
    });

    it('suggests a part number, which prefix matching alone would lose', async () => {
      // `rx-78-2` is indexed as the lexemes 'rx-78', 'rx', '78' and '2'. Stripping it to
      // `rx782` so that `:*` can be attached matches none of them — so the last token is
      // matched as a whole word as well as a prefix. This is the highest-signal thing anyone
      // types at a Gunpla shop, so it is worth a test of its own.
      const { body } = await http.get('/api/v1/search/suggest?q=rx-78-2').expect(200);

      expect(body.products.length).toBeGreaterThan(0);
      expect(
        body.products.every((item: { name: string }) => item.name.includes('RX-78-2')),
      ).toBe(true);
    });

    it('carries a thumbnail and a price on every row (FR-SRCH-03)', async () => {
      const { body } = await http.get('/api/v1/search/suggest?q=barb').expect(200);

      for (const product of body.products) {
        expect(product.priceIdr).toBeGreaterThan(0);
        expect(product.image).not.toBeNull();
      }
    });

    it('suggests categories as well as products (FR-SRCH-03)', async () => {
      const { body } = await http.get('/api/v1/search/suggest?q=nip').expect(200);

      expect(body.categories.map((category: { name: string }) => category.name)).toContain('Nippers');
    });

    it('holds back below two characters (FR-SRCH-03)', async () => {
      // The debounce is the client's job; the floor is the endpoint's, because a rule that
      // lives only in the browser is one a script can ignore.
      await http.get('/api/v1/search/suggest?q=b').expect(400);
      await http.get('/api/v1/search/suggest?q=ba').expect(200);
    });

    it('caps how many rows it will return', async () => {
      await http.get('/api/v1/search/suggest?q=gundam&limit=50').expect(400);
    });
  });
});
