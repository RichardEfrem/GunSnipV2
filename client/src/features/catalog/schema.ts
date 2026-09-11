import { z } from 'zod';
import { DIFFICULTIES, NECESSITIES, PRODUCT_TYPES, STOCK_STATES, TOOL_JOBS } from '@gunsnip/shared';

/**
 * The catalogue API's responses, as schemas.
 *
 * Every fetch parses through one of these (CLAUDE.md non-negotiable #4), so a field the API
 * stops sending fails loudly at the boundary instead of arriving as `undefined` three
 * components deep. The inferred types are the only product types the storefront knows — there
 * is no hand-written interface to keep in step with the server's.
 */

const labelledRef = z.object({ name: z.string(), slug: z.string() });
const codedRef = z.object({ code: z.string(), name: z.string() });

const productImage = z.object({
  url: z.string(),
  alt: z.string(),
  blurDataUrl: z.string(),
});

export const productSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  type: z.enum(PRODUCT_TYPES),

  brand: labelledRef,
  grade: codedRef.nullable(),
  scale: codedRef.nullable(),
  series: labelledRef.nullable(),

  image: productImage.nullable(),

  // Money is an integer number of rupiah on the wire as well as in the database (PRD A2) —
  // `int()` is the assertion that nothing upstream turned it into a float.
  priceIdr: z.int(),
  compareAtPriceIdr: z.int().nullable(),
  hasPriceRange: z.boolean(),

  stockState: z.enum(STOCK_STATES),
  availableQuantity: z.int(),

  ratingAverage: z.number().nullable(),
  reviewCount: z.int(),
  unitsSold: z.int(),

  isNew: z.boolean(),
  publishedAt: z.string().nullable(),
});

export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string().nullable(),
  optionValues: z.record(z.string(), z.string()),
  priceIdr: z.int(),
  compareAtPriceIdr: z.int().nullable(),
  stockState: z.enum(STOCK_STATES),
  availableQuantity: z.int(),
});

export const productDetailSchema = productSummarySchema.extend({
  description: z.string().nullable(),
  breadcrumbs: z.array(labelledRef),
  images: z.array(productImage),
  variants: z.array(productVariantSchema),
  kitSpec: z
    .object({
      grade: codedRef.nullable(),
      scale: codedRef.nullable(),
      series: labelledRef.nullable(),
      unitName: z.string().nullable(),
      unitCode: z.string().nullable(),
      runnerCount: z.int().nullable(),
      partCount: z.int().nullable(),
      difficulty: z.enum(DIFFICULTIES).nullable(),
      decalType: z.string().nullable(),
      articulationNotes: z.string().nullable(),
      includes: z.array(z.string()),
      releaseYear: z.int().nullable(),
      runtimeMinutesEst: z.int().nullable(),
    })
    .nullable(),
  toolSpec: z
    .object({
      job: z.enum(TOOL_JOBS).nullable(),
      attributes: z.record(z.string(), z.unknown()),
    })
    .nullable(),
});

export type ProductDetail = z.infer<typeof productDetailSchema>;

/**
 * One row of "What you'll need to build this" (FR-PDP-08).
 *
 * `variantId` is nullable and the block reads it as the difference between a tickable row and
 * an unavailable one — the server picks the variant, so a null here means "nothing on this tool
 * is buyable" rather than "the client failed to choose".
 */
export const buildRequirementSchema = z.object({
  necessity: z.enum(NECESSITIES),
  reason: z.string().nullable(),
  tool: productSummarySchema,
  variantId: z.string().nullable(),
});

export type BuildRequirement = z.infer<typeof buildRequirementSchema>;

export const buildRequirementsSchema = z.array(buildRequirementSchema);

/** The two rails below the product page (FR-PDP-10). */
export const relatedProductsSchema = z.object({
  sameUnit: z.array(productSummarySchema),
  sameSeries: z.array(productSummarySchema),
});

export type RelatedProducts = z.infer<typeof relatedProductsSchema>;

/** Mirrors `Paginated<T>`. A factory, because the item schema differs per endpoint. */
export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int(),
    limit: z.int(),
    total: z.int(),
    totalPages: z.int(),
    hasMore: z.boolean(),
  });
}

export const productPageSchema = paginatedSchema(productSummarySchema);
export type ProductPage = z.infer<typeof productPageSchema>;

export const facetOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.int(),
  isSelected: z.boolean(),
});

export type FacetOption = z.infer<typeof facetOptionSchema>;

export const facetsSchema = z.object({
  total: z.int(),
  grades: z.array(facetOptionSchema),
  scales: z.array(facetOptionSchema),
  series: z.array(facetOptionSchema),
  brands: z.array(facetOptionSchema),
  difficulties: z.array(facetOptionSchema),
  toolJobs: z.array(facetOptionSchema),
  inStockCount: z.int(),
  price: z.object({ minIdr: z.int(), maxIdr: z.int() }),
});

export type Facets = z.infer<typeof facetsSchema>;

/** Recursive, so the type has to be declared before the schema can reference itself. */
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  type: (typeof PRODUCT_TYPES)[number];
  productCount: number;
  children: CategoryNode[];
}

export const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    type: z.enum(PRODUCT_TYPES),
    productCount: z.int(),
    children: z.array(categoryNodeSchema),
  }),
);

export const categoryTreeSchema = z.array(categoryNodeSchema);

export const categoryDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(PRODUCT_TYPES),
  breadcrumbs: z.array(labelledRef),
});

export type CategoryDetail = z.infer<typeof categoryDetailSchema>;

export const homeContentSchema = z.object({
  gradeShortcuts: z.array(
    z.object({ code: z.string(), name: z.string(), productCount: z.int() }),
  ),
  newArrivals: z.array(productSummarySchema),
  mostPopular: z.array(productSummarySchema),
  tools: z.array(productSummarySchema),
  firstBuild: z.array(productSummarySchema),
  banners: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      subtitle: z.string().nullable(),
      imageUrl: z.string(),
      alt: z.string(),
      href: z.string(),
    }),
  ),
  categories: categoryTreeSchema,
});

export type HomeContent = z.infer<typeof homeContentSchema>;
