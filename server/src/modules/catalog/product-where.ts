import type { Prisma } from '../../generated/prisma/client.js';
import type { ProductFilterDto } from './dto/product-filter.dto.js';

/**
 * Turns a filter into a Prisma predicate (FR-CAT-04, FR-CAT-05).
 *
 * Repository-internal: it deals in Prisma types, so nothing above the repository imports it.
 * It is a pure function of the filter and the context it is given, which is what lets the
 * listing and the facet counts share one definition — the count beside "Master Grade" has to be
 * computed against exactly the predicate the grid uses, and two implementations would disagree
 * the first time a filter was added to one of them.
 *
 * The combination rule (FR-CAT-05): values *within* one filter are OR'd, because `IN` is an OR;
 * separate filters are AND'd, because they are separate keys on one `where` object. Ticking MG
 * and RG widens the result, ticking MG and "in stock" narrows it.
 */

/** The filters a facet count can exclude — one per group in the rail. */
export type FacetKey = 'grade' | 'scale' | 'series' | 'brand' | 'difficulty' | 'toolJob' | 'inStock' | 'price';

export interface ProductWhereContext {
  /**
   * The requested category and every descendant, pre-resolved. An empty array means the
   * category was named but matched nothing, which has to produce no results rather than all of
   * them — `undefined` means no category filter at all, and the two are not the same.
   */
  categoryIds?: readonly string[];

  /**
   * A variant a customer could actually buy. Supplied by the repository rather than defined
   * here because "available" compares two columns — `stock_on_hand > stock_reserved` (PRD §8.3)
   * — and Prisma spells a column reference as `prisma.productVariant.fields.stockReserved`,
   * which only exists on the client instance.
   */
  availableVariant: Prisma.ProductVariantWhereInput;

  /**
   * The candidate products a text search produced, already ranked (FR-SRCH-06).
   *
   * Present only on a search. It narrows the same predicate every other filter narrows, which
   * is what lets the results page run the Phase 3 filter rail unchanged — a grade tickbox does
   * not know or care that the set it is narrowing came from a tsquery rather than a category.
   *
   * An empty array means the search matched nothing and must stay matching nothing, exactly as
   * an empty `categoryIds` does. `undefined` means this is not a search at all.
   */
  productIds?: readonly string[];

  /** Facet counting omits one filter at a time; this is the one to leave out. */
  omit?: FacetKey;
}

export function buildProductWhere(
  filter: ProductFilterDto,
  context: ProductWhereContext,
): Prisma.ProductWhereInput {
  const { omit } = context;
  const kept = <T>(key: FacetKey, value: T): T | undefined => (omit === key ? undefined : value);

  return {
    // The storefront never sees a draft or an archived product. This is the one condition no
    // caller may override, which is why it is set here rather than passed in.
    status: 'PUBLISHED',
    type: filter.type,
    id: context.productIds === undefined ? undefined : { in: [...context.productIds] },
    categoryId: context.categoryIds === undefined ? undefined : { in: [...context.categoryIds] },

    grade: kept('grade', inCodes(filter.grade)),
    scale: kept('scale', inCodes(filter.scale)),
    series: kept('series', inSlugs(filter.series)),
    brand: kept('brand', inSlugs(filter.brand)),

    difficulty: kept('difficulty', inValues<Prisma.EnumDifficultyNullableFilter>(filter.difficulty)),
    toolJob: kept('toolJob', inValues<Prisma.EnumToolJobNullableFilter>(filter.toolJob)),

    minPriceIdr: kept('price', priceRange(filter)),

    variants:
      omit === 'inStock' || filter.inStock !== true ? undefined : { some: context.availableVariant },
  };
}

/**
 * Price filters the *cheapest* variant, not any variant: someone capping their budget at
 * Rp 300.000 wants products they can buy for that, and a kit whose entry-level variant is
 * Rp 250.000 qualifies even if a deluxe one costs Rp 900.000.
 */
function priceRange(filter: ProductFilterDto): Prisma.IntFilter | undefined {
  if (filter.minPrice === undefined && filter.maxPrice === undefined) return undefined;

  return { gte: filter.minPrice, lte: filter.maxPrice };
}

/**
 * `undefined` rather than an empty clause when nothing is selected, so `?grade=` filters
 * nothing instead of matching nothing. Prisma drops undefined keys, which is what keeps the
 * object above readable — every filter is one line whether or not it is active.
 */
function inCodes(codes: readonly string[] | undefined): { code: { in: string[] } } | undefined {
  return isEmpty(codes) ? undefined : { code: { in: [...codes] } };
}

function inSlugs(slugs: readonly string[] | undefined): { slug: { in: string[] } } | undefined {
  return isEmpty(slugs) ? undefined : { slug: { in: [...slugs] } };
}

/**
 * Postgres enums. The DTO has already checked each value against the shared union, so the cast
 * narrows strings the validator has proven are members — it is not a claim made on faith.
 */
function inValues<T extends { in?: unknown }>(values: readonly string[] | undefined): T | undefined {
  return isEmpty(values) ? undefined : ({ in: [...values] } as T);
}

function isEmpty(values: readonly string[] | undefined): values is undefined {
  return values === undefined || values.length === 0;
}
