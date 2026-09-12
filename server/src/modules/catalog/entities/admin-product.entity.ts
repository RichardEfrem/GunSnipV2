import type {
  DecalType,
  Difficulty,
  Necessity,
  ProductStatus,
  ProductType,
  ToolJob,
} from '@gunsnip/shared';

/**
 * A product as the back office sees it (FR-ADM-02).
 *
 * Deliberately **not** `ProductDetail`. The storefront entity answers "what should a customer
 * see", and computes it: a card's price is the cheapest *sellable* variant, its stock state is
 * derived, archived variants are filtered out entirely. An operator needs the opposite — the
 * stored values, archived rows included, with nothing smoothed over. Reusing the storefront
 * shape here would mean an operator could not see the variant they had just archived.
 */
export interface AdminProduct {
  id: string;
  type: ProductType;
  status: ProductStatus;
  name: string;
  slug: string;
  description: string | null;

  brand: AdminRef;
  category: AdminRef;
  tags: readonly string[];

  /** Null on tools. */
  kit: AdminKitFields | null;
  tool: AdminToolFields | null;

  variants: readonly AdminVariant[];
  images: readonly AdminImage[];
  requirements: readonly AdminRequirement[];

  /** The denormalised range, so the operator sees what the sorts are actually using. */
  minPriceIdr: number;
  maxPriceIdr: number;
  unitsSold: number;
  reviewCount: number;
  /** ISO 8601, UTC. Null while the product has never been published. */
  publishedAt: string | null;
  updatedAt: string;
}

/** One row of the product list — enough to find a product, not enough to edit it. */
export interface AdminProductSummary {
  id: string;
  type: ProductType;
  status: ProductStatus;
  name: string;
  slug: string;
  brandName: string;
  categoryName: string;
  imageUrl: string | null;
  variantCount: number;
  /** Summed across non-archived variants — what the operator would call "in stock". */
  availableQuantity: number;
  minPriceIdr: number;
  maxPriceIdr: number;
  updatedAt: string;
}

export interface AdminRef {
  id: string;
  name: string;
  slug: string;
}

export interface AdminKitFields {
  gradeId: string | null;
  scaleId: string | null;
  seriesId: string | null;
  unitName: string | null;
  unitCode: string | null;
  runnerCount: number | null;
  partCount: number | null;
  difficulty: Difficulty | null;
  decalType: DecalType | null;
  articulationNotes: string | null;
  includes: readonly string[];
  releaseYear: number | null;
  runtimeMinutesEst: number | null;
}

export interface AdminToolFields {
  toolJob: ToolJob | null;
  attributes: Record<string, unknown>;
}

export interface AdminVariant {
  id: string;
  sku: string;
  name: string | null;
  optionValues: Record<string, string>;
  priceIdr: number;
  compareAtPriceIdr: number | null;
  stockOnHand: number;
  stockReserved: number;
  /** Derived, never stored (PRD §8.3). */
  availableQuantity: number;
  weightGrams: number;
  barcode: string | null;
  position: number;
  isArchived: boolean;
}

export interface AdminImage {
  id: string;
  url: string;
  alt: string;
  blurDataUrl: string;
  position: number;
  isPrimary: boolean;
}

export interface AdminRequirement {
  toolProductId: string;
  toolName: string;
  toolSlug: string;
  necessity: Necessity;
  reason: string | null;
  position: number;
}
