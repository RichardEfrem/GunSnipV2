import { LOW_STOCK_THRESHOLD, type StockState } from '@gunsnip/shared';
import type { ProductDetail, ProductVariantSummary } from './entities/product-detail.entity.js';
import type { ProductSummary } from './entities/product-summary.entity.js';
import type { ProductDetailRow, ProductSummaryRow, VariantRow } from './product.repository.js';

/**
 * Database rows to the shapes the storefront consumes.
 *
 * Its real job is the derivations the client must never make for itself: availability, stock
 * state and the displayed price. All three are computed from columns a client cannot see, and
 * a client that guessed at them would be wrong the moment someone else placed an order.
 */

/** Published within this window earns the "New" badge (DESIGN.md §4.3). */
const NEW_FOR_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toProductSummary(row: ProductSummaryRow, now: number = Date.now()): ProductSummary {
  const sellable = row.variants.filter((variant) => !variant.isArchived);
  const cheapest = cheapestVariant(sellable);
  const availableQuantity = totalAvailable(sellable);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,

    brand: { name: row.brand.name, slug: row.brand.slug },
    grade: row.grade === null ? null : { code: row.grade.code, name: row.grade.name },
    scale: row.scale === null ? null : { code: row.scale.code, name: row.scale.name },
    series: row.series === null ? null : { name: row.series.name, slug: row.series.slug },

    image:
      row.images[0] === undefined
        ? null
        : {
            url: row.images[0].url,
            alt: row.images[0].alt,
            blurDataUrl: row.images[0].blurDataUrl,
          },

    // The cheapest sellable variant, not `minPriceIdr`: the denormalised column includes
    // archived variants and is there for sorting, while this is the price the card prints and
    // has to match a variant someone can actually put in a basket.
    priceIdr: cheapest?.priceIdr ?? 0,
    compareAtPriceIdr: cheapest?.compareAtPriceIdr ?? null,
    hasPriceRange: hasPriceRange(sellable),

    stockState: toStockState(availableQuantity),
    availableQuantity,

    ratingAverage: row.reviewCount === 0 ? null : row.ratingAverageTenths / 10,
    reviewCount: row.reviewCount,
    unitsSold: row.unitsSold,

    isNew: row.publishedAt !== null && now - row.publishedAt.getTime() < NEW_FOR_DAYS * DAY_MS,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

export function toProductDetail(row: ProductDetailRow, now: number = Date.now()): ProductDetail {
  const sellable = row.variants.filter((variant) => !variant.isArchived);

  return {
    ...toProductSummary(row, now),
    description: row.description,
    breadcrumbs: breadcrumbsFor(row),
    images: row.images.map((image) => ({
      url: image.url,
      alt: image.alt,
      blurDataUrl: image.blurDataUrl,
    })),
    variants: sellable.map(toVariantSummary),
    kitSpec:
      row.type !== 'MODEL_KIT'
        ? null
        : {
            grade: row.grade === null ? null : { code: row.grade.code, name: row.grade.name },
            scale: row.scale === null ? null : { code: row.scale.code, name: row.scale.name },
            series: row.series === null ? null : { name: row.series.name, slug: row.series.slug },
            unitName: row.unitName,
            unitCode: row.unitCode,
            runnerCount: row.runnerCount,
            partCount: row.partCount,
            difficulty: row.difficulty,
            decalType: row.decalType,
            articulationNotes: row.articulationNotes,
            includes: row.includes,
            releaseYear: row.releaseYear,
            runtimeMinutesEst: row.runtimeMinutesEst,
          },
    toolSpec:
      row.type !== 'TOOL_SUPPLY'
        ? null
        : { job: row.toolJob, attributes: toAttributes(row.attributes) },
  };
}

function toVariantSummary(variant: VariantRow): ProductVariantSummary {
  const available = availableOf(variant);

  return {
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    optionValues: toOptionValues(variant.optionValues),
    priceIdr: variant.priceIdr,
    compareAtPriceIdr: variant.compareAtPriceIdr,
    stockState: toStockState(available),
    availableQuantity: available,
  };
}

/** Root first, this product's category last (FR-CAT-03). Two levels, so at most two crumbs. */
function breadcrumbsFor(row: ProductDetailRow): { name: string; slug: string }[] {
  const { category } = row;
  const parent = category.parent;

  return parent === null
    ? [{ name: category.name, slug: category.slug }]
    : [
        { name: parent.name, slug: parent.slug },
        { name: category.name, slug: category.slug },
      ];
}

/** PRD §8.3: what is on hand less what orders have already spoken for. Never stored. */
export function availableOf(variant: Pick<VariantRow, 'stockOnHand' | 'stockReserved'>): number {
  return Math.max(0, variant.stockOnHand - variant.stockReserved);
}

function totalAvailable(variants: readonly VariantRow[]): number {
  return variants.reduce((total, variant) => total + availableOf(variant), 0);
}

/**
 * PREORDER is not derivable from stock and is not returned here — PRD §14 Q1 leaves preorder
 * open, so nothing sets it yet. The union carries the case so adding it later is a service
 * change rather than a contract change.
 */
export function toStockState(availableQuantity: number): StockState {
  if (availableQuantity <= 0) return 'OUT_OF_STOCK';
  return availableQuantity <= LOW_STOCK_THRESHOLD ? 'LOW_STOCK' : 'IN_STOCK';
}

/** Cheapest first; the card quotes this one and "From" is decided by whether others differ. */
function cheapestVariant(variants: readonly VariantRow[]): VariantRow | undefined {
  return [...variants].sort((left, right) => left.priceIdr - right.priceIdr)[0];
}

function hasPriceRange(variants: readonly VariantRow[]): boolean {
  return new Set(variants.map((variant) => variant.priceIdr)).size > 1;
}

/**
 * `option_values` and `attributes` are JSONB, so Prisma types them as `JsonValue` — a union
 * that includes `null` and arrays. Narrowing here rather than casting means a malformed row
 * renders as empty instead of crashing a page, which is the right failure for display data.
 */
function toOptionValues(value: unknown): Record<string, string> {
  const record = toAttributes(value);
  const entries = Object.entries(record).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return Object.fromEntries(entries);
}

function toAttributes(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
