import { z } from 'zod';
import { STOCK_STATES } from '@gunsnip/shared';

/** A curated bundle as the storefront renders it (FR-CAT-11). */
const bundleImage = z.object({ url: z.string(), alt: z.string(), blurDataUrl: z.string() });

export const bundleComponentSchema = z.object({
  variantId: z.string(),
  quantity: z.int(),
  productSlug: z.string(),
  productName: z.string(),
  variantName: z.string().nullable(),
  sku: z.string(),
  /** What this component costs on its own — what the bundle is being compared against. */
  catalogueUnitPriceIdr: z.int(),
  availableQuantity: z.int(),
  image: bundleImage.nullable(),
});

export type BundleComponent = z.infer<typeof bundleComponentSchema>;

export const bundleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceIdr: z.int(),
  /** The components' catalogue total. Null when there is no saving to show (FR-PROMO-03). */
  compareAtPriceIdr: z.int().nullable(),
  savingIdr: z.int(),
  /** Zero when any component is out of stock — a bundle is only as available as its scarcest part. */
  availableQuantity: z.int(),
  stockState: z.enum(STOCK_STATES),
  isPurchasable: z.boolean(),
  image: bundleImage.nullable(),
  components: z.array(bundleComponentSchema),
});

export type Bundle = z.infer<typeof bundleSchema>;

export const bundleListSchema = z.array(bundleSchema);
