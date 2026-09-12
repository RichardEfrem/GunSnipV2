import type { Prisma } from '../../generated/prisma/client.js';
import type {
  AdminImage,
  AdminProduct,
  AdminProductSummary,
  AdminRequirement,
  AdminVariant,
} from './entities/admin-product.entity.js';
import type { ADMIN_PRODUCT_SELECT, ADMIN_SUMMARY_SELECT } from './product-write.repository.js';

/**
 * Database rows to the back-office shapes.
 *
 * Where `product-mapper.ts` derives what a customer should see, this one mostly does not derive:
 * an operator is shown the stored values. The one exception is `availableQuantity`, because
 * `stock_on_hand − stock_reserved` (PRD §8.3) is never stored anywhere and every reader has to
 * compute it or be wrong.
 */
type ProductRow = Prisma.ProductGetPayload<{ select: typeof ADMIN_PRODUCT_SELECT }>;
type SummaryRow = Prisma.ProductGetPayload<{ select: typeof ADMIN_SUMMARY_SELECT }>;

export function toAdminProduct(row: ProductRow): AdminProduct {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    name: row.name,
    slug: row.slug,
    description: row.description,

    brand: { id: row.brand.id, name: row.brand.name, slug: row.brand.slug },
    category: { id: row.category.id, name: row.category.name, slug: row.category.slug },
    tags: row.tags,

    kit:
      row.type !== 'MODEL_KIT'
        ? null
        : {
            gradeId: row.gradeId,
            scaleId: row.scaleId,
            seriesId: row.seriesId,
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

    tool:
      row.type !== 'TOOL_SUPPLY'
        ? null
        : { toolJob: row.toolJob, attributes: toRecord(row.attributes) },

    variants: row.variants.map(toAdminVariant),
    images: row.images.map(toAdminImage),
    requirements: row.requiredTools.map(toAdminRequirement),

    minPriceIdr: row.minPriceIdr,
    maxPriceIdr: row.maxPriceIdr,
    unitsSold: row.unitsSold,
    reviewCount: row.reviewCount,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAdminProductSummary(row: SummaryRow): AdminProductSummary {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    name: row.name,
    slug: row.slug,
    brandName: row.brand.name,
    categoryName: row.category.name,
    imageUrl: row.images[0]?.url ?? null,
    variantCount: row.variants.length,
    availableQuantity: row.variants
      .filter((variant) => !variant.isArchived)
      .reduce((total, variant) => total + available(variant), 0),
    minPriceIdr: row.minPriceIdr,
    maxPriceIdr: row.maxPriceIdr,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAdminVariant(row: ProductRow['variants'][number]): AdminVariant {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    optionValues: toStringRecord(row.optionValues),
    priceIdr: row.priceIdr,
    compareAtPriceIdr: row.compareAtPriceIdr,
    stockOnHand: row.stockOnHand,
    stockReserved: row.stockReserved,
    availableQuantity: available(row),
    weightGrams: row.weightGrams,
    barcode: row.barcode,
    position: row.position,
    isArchived: row.isArchived,
  };
}

export function toAdminImage(row: ProductRow['images'][number]): AdminImage {
  return {
    id: row.id,
    url: row.url,
    alt: row.alt,
    blurDataUrl: row.blurDataUrl,
    position: row.position,
    isPrimary: row.isPrimary,
  };
}

function toAdminRequirement(row: ProductRow['requiredTools'][number]): AdminRequirement {
  return {
    toolProductId: row.toolProductId,
    toolName: row.tool.name,
    toolSlug: row.tool.slug,
    necessity: row.necessity,
    reason: row.reason,
    position: row.position,
  };
}

function available(variant: { stockOnHand: number; stockReserved: number }): number {
  return Math.max(0, variant.stockOnHand - variant.stockReserved);
}

/** JSONB arrives as Prisma's `JsonValue`; anything that is not an object is an empty one. */
function toRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** `option_values` is `{ colour: 'Silver' }` by contract; non-string values are dropped rather
 *  than coerced, so a malformed row shows as missing instead of as `"[object Object]"`. */
function toStringRecord(value: Prisma.JsonValue): Record<string, string> {
  return Object.fromEntries(
    Object.entries(toRecord(value)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
