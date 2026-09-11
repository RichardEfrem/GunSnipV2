import { Injectable } from '@nestjs/common';
import type { ProductSort } from '@gunsnip/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ProductFilterDto } from './dto/product-filter.dto.js';
import { buildProductOrder } from './product-order.js';
import { buildProductWhere, type FacetKey, type ProductWhereContext } from './product-where.js';

/**
 * All Prisma access for the product aggregate (CLAUDE.md). Services depend on this; nothing
 * else imports `PrismaService` in this module.
 *
 * Deliberately thin on decisions: it owns *how* to ask the database, and the catalogue service
 * owns *what* to ask. The one judgement it does make is which columns a card needs versus a
 * page, because that is a query concern.
 */

/**
 * Everything a product card renders (DESIGN.md §3.4), and nothing more.
 *
 * Exported because the build-requirements query selects tools with it too (FR-PDP-08): those
 * rows go through `toProductSummary` like any other card, and sharing the select is what
 * guarantees they can.
 */
export const SUMMARY_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  publishedAt: true,
  unitsSold: true,
  reviewCount: true,
  ratingAverageTenths: true,
  brand: { select: { name: true, slug: true } },
  grade: { select: { code: true, name: true } },
  scale: { select: { code: true, name: true } },
  series: { select: { name: true, slug: true } },
  // Only the primary shot. A grid of 24 cards has no use for the other 48 images, and pulling
  // them would triple the response for nothing visible.
  images: {
    where: { isPrimary: true },
    select: { url: true, alt: true, blurDataUrl: true },
    take: 1,
  },
  variants: {
    where: { isArchived: false },
    select: {
      id: true,
      sku: true,
      name: true,
      optionValues: true,
      priceIdr: true,
      compareAtPriceIdr: true,
      stockOnHand: true,
      stockReserved: true,
      isArchived: true,
      position: true,
    },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.ProductSelect;

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  description: true,
  unitName: true,
  unitCode: true,
  runnerCount: true,
  partCount: true,
  difficulty: true,
  decalType: true,
  articulationNotes: true,
  includes: true,
  releaseYear: true,
  runtimeMinutesEst: true,
  toolJob: true,
  attributes: true,
  images: {
    select: { url: true, alt: true, blurDataUrl: true },
    orderBy: { position: 'asc' },
  },
  category: {
    select: { name: true, slug: true, parent: { select: { name: true, slug: true } } },
  },
} satisfies Prisma.ProductSelect;

export type ProductSummaryRow = Prisma.ProductGetPayload<{ select: typeof SUMMARY_SELECT }>;
export type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof DETAIL_SELECT }>;
export type VariantRow = ProductSummaryRow['variants'][number];

/**
 * What a catalogue query is restricted to *before* any filter applies.
 *
 * One object rather than two parameters because both restrictions travel together through every
 * method here and through the whole of `FacetService` — the counts beside the filter rail have
 * to be computed over the same scope the grid is, and a positional argument that some call sites
 * pass and others forget is exactly how a facet count comes to disagree with its own list.
 */
export interface CatalogScope {
  /** A category and its descendants (FR-CAT-03). */
  categoryIds?: readonly string[];
  /** The products a text search matched (FR-SRCH-06). */
  productIds?: readonly string[];
}

/**
 * The product the related rails are computed *around* — just the columns that decide what
 * counts as a sibling, so a caller can pass a detail row without the repository depending on
 * the whole of it.
 */
export interface SiblingSubject {
  id: string;
  unitName: string | null;
  seriesId: string | null;
}

/** `listRanked`'s input: a listing whose order is supplied rather than computed. */
export interface ListRankedQuery {
  filter: ProductFilterDto;
  scope: CatalogScope;
  /** Candidate ids, best match first. */
  rankedIds: readonly string[];
  skip: number;
  take: number;
}

export interface ListProductsQuery {
  filter: ProductFilterDto;
  scope: CatalogScope;
  sort?: ProductSort;
  skip: number;
  take: number;
}

/** One facet group's counts: how many products each value would leave (FR-CAT-10). */
export interface FacetCount {
  value: string;
  count: number;
}

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Page of results and the matching total, in one round trip.
   *
   * `$transaction` not for atomicity — nothing is written — but so both statements see the same
   * snapshot. Counting outside it would let a publish between the two queries produce a total
   * that disagrees with the page, which shows up as a numbered page that renders empty.
   */
  async list(query: ListProductsQuery): Promise<{ rows: ProductSummaryRow[]; total: number }> {
    const where = this.whereFor(query.filter, query.scope);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: SUMMARY_SELECT,
        orderBy: buildProductOrder(query.sort),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { rows, total };
  }

  /**
   * A page of an already-ranked candidate set, with the filter rail applied and the ranking
   * preserved (FR-SRCH-06).
   *
   * Relevance order comes from `ts_rank`, computed in the search repository's raw query, and
   * Prisma cannot order by an expression it did not build — there is no `orderBy` that says
   * "the order of this array". So the ranking is applied here instead, in three cheap steps:
   * ask which candidates survive the filters (ids only), intersect that with the ranked list to
   * get both the order and the true total, then load full rows for the one page being shown.
   *
   * The middle step is the only one that touches every candidate, and it is a set membership
   * test over a list the search repository has already capped at `MAX_CANDIDATES`. That cap is
   * what makes this honest rather than a table scan wearing a pagination costume.
   */
  async listRanked(query: ListRankedQuery): Promise<{ rows: ProductSummaryRow[]; total: number }> {
    const surviving = await this.prisma.product.findMany({
      where: this.whereFor(query.filter, query.scope),
      select: { id: true },
    });

    const survivingIds = new Set(surviving.map((row) => row.id));
    const ordered = query.rankedIds.filter((id) => survivingIds.has(id));
    const pageIds = ordered.slice(query.skip, query.skip + query.take);

    if (pageIds.length === 0) return { rows: [], total: ordered.length };

    const rows = await this.prisma.product.findMany({
      where: { id: { in: pageIds } },
      select: SUMMARY_SELECT,
    });

    // `IN` has no order of its own, so the rank order is restored from the id list rather than
    // trusted to come back the way it went out.
    const byId = new Map(rows.map((row) => [row.id, row]));

    return {
      rows: pageIds.flatMap((id) => {
        const row = byId.get(id);
        return row === undefined ? [] : [row];
      }),
      total: ordered.length,
    };
  }

  async findBySlug(slug: string): Promise<ProductDetailRow | null> {
    return this.prisma.product.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: DETAIL_SELECT,
    });
  }

  /** Total under the current filter — the "218 kits" heading and the sheet's live count. */
  async count(filter: ProductFilterDto, scope: CatalogScope): Promise<number> {
    return this.prisma.product.count({ where: this.whereFor(filter, scope) });
  }

  async countInStock(filter: ProductFilterDto, scope: CatalogScope): Promise<number> {
    return this.prisma.product.count({
      where: {
        ...this.whereFor(filter, { ...scope, omit: 'inStock' }),
        variants: { some: this.availableVariant },
      },
    });
  }

  /**
   * Counts per value for one facet group, with that group's own selections excluded.
   *
   * Excluding them is what makes a filter rail usable: with MG ticked, the count beside RG has
   * to mean "and RG as well", not "MG and RG at once", which is always zero. Every *other*
   * filter still applies, so the numbers describe the list actually on screen.
   */
  async facetCounts(
    filter: ProductFilterDto,
    field: 'gradeId' | 'scaleId' | 'seriesId' | 'brandId' | 'difficulty' | 'toolJob',
    omit: FacetKey,
    scope: CatalogScope,
  ): Promise<Map<string, number>> {
    const groups = await this.prisma.product.groupBy({
      by: [field],
      where: this.whereFor(filter, { ...scope, omit }),
      _count: { _all: true },
    });

    const counts = new Map<string, number>();

    for (const group of groups) {
      const key = group[field];
      // Kits have no tool job and tools have no grade; those nulls are not a facet value.
      if (typeof key === 'string') counts.set(key, group._count._all);
    }

    return counts;
  }

  /** The price span the slider covers, under every filter except price itself. */
  async priceBounds(
    filter: ProductFilterDto,
    scope: CatalogScope,
  ): Promise<{ minIdr: number; maxIdr: number }> {
    const result = await this.prisma.product.aggregate({
      where: this.whereFor(filter, { ...scope, omit: 'price' }),
      _min: { minPriceIdr: true },
      _max: { maxPriceIdr: true },
    });

    return {
      minIdr: result._min.minPriceIdr ?? 0,
      maxIdr: result._max.maxPriceIdr ?? 0,
    };
  }

  /**
   * The home page's "Most popular" rail (FR-CAT-01), ranked by an evidence-weighted rating.
   *
   * `(v·R + m·C) / (v + m)` — v is the review count, R the product's mean rating, C the
   * catalogue's mean rating and m the evidence floor the service supplies. A product with few
   * reviews is pulled toward C and a well-reviewed one keeps its own average, which is the
   * whole point: the plain `top_rated` sort lets one five-star review outrank two hundred
   * four-and-a-half-star ones, and on a rail of ten that is all you would ever see.
   *
   * Raw SQL because the ranking is an expression over two columns and a catalogue-wide
   * aggregate, and Prisma cannot `orderBy` something it did not build — the same constraint
   * `listRanked` works around for `ts_rank`. Ranking then hydrating is two round trips rather
   * than one, and it keeps the card's column list in `SUMMARY_SELECT` instead of restating
   * thirty columns in SQL that would silently drift from it.
   *
   * Kits only — tools have their own rail, and a popular nipper appearing in both would waste
   * a row. Out-of-stock kits are *not* excluded: a sold-out hit is still what is popular, the
   * card says so plainly, and filtering on stock would make the rail's contents jump around
   * with every reservation.
   */
  async findMostPopular(evidenceFloor: number, take: number): Promise<ProductSummaryRow[]> {
    const ranked = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH rated AS (
        SELECT id, rating_average_tenths, review_count
        FROM product
        WHERE status = 'PUBLISHED' AND type = 'MODEL_KIT' AND review_count > 0
      ),
      catalogue AS (SELECT AVG(rating_average_tenths) AS mean_tenths FROM rated)
      SELECT r.id
      FROM rated r, catalogue c
      ORDER BY (r.review_count * r.rating_average_tenths + ${evidenceFloor} * c.mean_tenths)
                 / (r.review_count + ${evidenceFloor})
               DESC,
               r.review_count DESC,
               r.id ASC
      LIMIT ${take}
    `;

    const ids = ranked.map((row) => row.id);

    if (ids.length === 0) return [];

    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: SUMMARY_SELECT,
    });

    // `IN` has no order of its own, so the score order is restored from the id list rather than
    // trusted to come back the way it went out — the same reason `listRanked` does it.
    const byId = new Map(rows.map((row) => [row.id, row]));

    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [row];
    });
  }

  /**
   * The few columns the related rails key off, by slug.
   *
   * A separate, tiny read rather than reusing `findBySlug`: the rails are their own endpoint
   * with their own cache lifetime, and making them load a full detail row — every image, every
   * variant, the whole spec block — to learn two foreign keys would be the expensive way to
   * ask a cheap question.
   */
  async findSiblingSubject(slug: string): Promise<SiblingSubject | null> {
    return this.prisma.product.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true, unitName: true, seriesId: true },
    });
  }

  /**
   * The same mobile suit at other grades — the "also available as MG, RG" rail (FR-PDP-10).
   *
   * Keyed on `unitName`, not `unitCode`. The code is a model number and a lineage shares one:
   * Barbatos, Barbatos Lupus and Barbatos Lupus Rex are all ASW-G-08, and offering the Lupus
   * Rex as another way to buy the Barbatos is wrong — they are different robots. The name
   * carries the suffix that separates them, so it is the honest key for "the same thing".
   */
  async findSameUnit(product: SiblingSubject, take: number): Promise<ProductSummaryRow[]> {
    if (product.unitName === null) return [];

    return this.prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        unitName: product.unitName,
        id: { not: product.id },
      },
      select: SUMMARY_SELECT,
      // Cheapest first: the rail's use is "the same kit, smaller", so price is the axis being
      // compared and grade order would bury the entry-level option at the end.
      orderBy: [{ minPriceIdr: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  /**
   * Other kits from the same series, excluding anything the "also available as" rail already
   * shows — the same card in two rails reads as a bug, and the more specific rail wins.
   */
  async findSameSeries(
    product: SiblingSubject,
    excludeIds: readonly string[],
    take: number,
  ): Promise<ProductSummaryRow[]> {
    if (product.seriesId === null) return [];

    return this.prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        seriesId: product.seriesId,
        id: { notIn: [product.id, ...excludeIds] },
      },
      select: SUMMARY_SELECT,
      orderBy: [{ unitsSold: 'desc' }, { id: 'asc' }],
      take,
    });
  }

  /** A rail: newest, best selling or whatever the sort says, with no filters but visibility. */
  async findRail(filter: ProductFilterDto, sort: ProductSort, take: number): Promise<ProductSummaryRow[]> {
    return this.prisma.product.findMany({
      where: this.whereFor(filter, {}),
      select: SUMMARY_SELECT,
      orderBy: buildProductOrder(sort),
      take,
    });
  }

  private whereFor(
    filter: ProductFilterDto,
    context: Omit<ProductWhereContext, 'availableVariant'>,
  ): Prisma.ProductWhereInput {
    return buildProductWhere(filter, { ...context, availableVariant: this.availableVariant });
  }

  /**
   * A variant a customer could buy: not archived, and with stock left after reservations
   * (PRD §8.3). `fields.stockReserved` is Prisma's column reference — the comparison happens in
   * Postgres, so availability is never computed from a stale row read into memory first.
   */
  private get availableVariant(): Prisma.ProductVariantWhereInput {
    return {
      isArchived: false,
      stockOnHand: { gt: this.prisma.productVariant.fields.stockReserved },
    };
  }
}
