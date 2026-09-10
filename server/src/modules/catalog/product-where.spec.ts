import { describe, expect, it } from 'vitest';
import { buildProductOrder } from './product-order.js';
import { buildProductWhere } from './product-where.js';

/**
 * The filter predicate and the sort order.
 *
 * Worth testing directly because both are shared: the listing grid and the facet counts use the
 * same `where`, so a change that narrows one silently narrows the other, and every sort has to
 * carry a tiebreaker or offset pagination starts dropping and repeating products between pages.
 */

const AVAILABLE = { isArchived: false, stockOnHand: { gt: 0 } };
const context = { availableVariant: AVAILABLE };

describe('buildProductWhere', () => {
  it('only ever exposes published products', () => {
    expect(buildProductWhere({}, context).status).toBe('PUBLISHED');
  });

  it('ORs the values within one filter (FR-CAT-05)', () => {
    const where = buildProductWhere({ grade: ['MG', 'RG'] }, context);

    expect(where.grade).toEqual({ code: { in: ['MG', 'RG'] } });
  });

  it('ANDs separate filters by setting them side by side (FR-CAT-05)', () => {
    const where = buildProductWhere({ grade: ['MG'], series: ['universal-century'] }, context);

    expect(where.grade).toEqual({ code: { in: ['MG'] } });
    expect(where.series).toEqual({ slug: { in: ['universal-century'] } });
  });

  it('ignores a filter that arrived empty', () => {
    // `?grade=` means "no grade filter", not "match the empty string".
    expect(buildProductWhere({ grade: [] }, context).grade).toBeUndefined();
  });

  it('distinguishes an unmatched category from no category at all', () => {
    // An empty id list has to produce nothing. Treating it as "unfiltered" would answer a typo
    // in a shared URL with the whole catalogue.
    expect(buildProductWhere({}, { ...context, categoryIds: [] }).categoryId).toEqual({ in: [] });
    expect(buildProductWhere({}, context).categoryId).toBeUndefined();
  });

  it('ranges price against the cheapest variant', () => {
    const where = buildProductWhere({ minPrice: 100_000, maxPrice: 500_000 }, context);

    expect(where.minPriceIdr).toEqual({ gte: 100_000, lte: 500_000 });
  });

  it('accepts an open-ended price range', () => {
    expect(buildProductWhere({ minPrice: 100_000 }, context).minPriceIdr).toEqual({
      gte: 100_000,
      lte: undefined,
    });
  });

  it('requires a buyable variant when in-stock is on, and adds nothing when it is off', () => {
    expect(buildProductWhere({ inStock: true }, context).variants).toEqual({ some: AVAILABLE });
    expect(buildProductWhere({ inStock: false }, context).variants).toBeUndefined();
    expect(buildProductWhere({}, context).variants).toBeUndefined();
  });

  it('omits exactly one group when counting that group’s facets (FR-CAT-10)', () => {
    const where = buildProductWhere(
      { grade: ['MG'], series: ['universal-century'], inStock: true },
      { ...context, omit: 'grade' },
    );

    // Its own selection is dropped so "and RG as well" is countable...
    expect(where.grade).toBeUndefined();
    // ...while every other filter still applies, so the number describes the visible list.
    expect(where.series).toEqual({ slug: { in: ['universal-century'] } });
    expect(where.variants).toEqual({ some: AVAILABLE });
  });

  it('can omit the in-stock and price filters too', () => {
    expect(
      buildProductWhere({ inStock: true }, { ...context, omit: 'inStock' }).variants,
    ).toBeUndefined();
    expect(
      buildProductWhere({ minPrice: 1 }, { ...context, omit: 'price' }).minPriceIdr,
    ).toBeUndefined();
  });
});

describe('buildProductOrder', () => {
  it('defaults to newest', () => {
    expect(buildProductOrder()).toEqual(buildProductOrder('newest'));
  });

  it('sorts price by the same column the card prints', () => {
    expect(buildProductOrder('price_asc')[0]).toEqual({ minPriceIdr: 'asc' });
    expect(buildProductOrder('price_desc')[0]).toEqual({ minPriceIdr: 'desc' });
  });

  it('breaks ties on id for every sort', () => {
    // Without a unique last key, Postgres may order equal rows differently per query, and a
    // product then appears on two pages or on none.
    for (const sort of ['relevance', 'newest', 'price_asc', 'price_desc', 'best_selling', 'top_rated'] as const) {
      expect(buildProductOrder(sort).at(-1)).toEqual({ id: 'asc' });
    }
  });

  it('ranks a hundred four-star reviews above a single five-star one', () => {
    expect(buildProductOrder('top_rated')).toEqual([
      { ratingAverageTenths: 'desc' },
      { reviewCount: 'desc' },
      { id: 'asc' },
    ]);
  });
});
