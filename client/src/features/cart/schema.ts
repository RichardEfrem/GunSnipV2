import { z } from 'zod';
import { STOCK_STATES } from '@gunsnip/shared';

/**
 * The cart API's responses (CLAUDE.md non-negotiable #4).
 *
 * Every money field is `z.int()` — the assertion that a total arrived as whole rupiah and was
 * not turned into a float somewhere upstream (PRD A2). The storefront never computes one of
 * these; it renders what the server sent (non-negotiable #2).
 */
const cartImage = z.object({
  url: z.string(),
  alt: z.string(),
  blurDataUrl: z.string(),
});

export const cartLineSchema = z.object({
  id: z.string(),
  quantity: z.int(),
  isSelected: z.boolean(),

  variantId: z.string(),
  sku: z.string(),
  variantName: z.string().nullable(),
  optionValues: z.record(z.string(), z.string()),

  productSlug: z.string(),
  productName: z.string(),
  image: cartImage.nullable(),

  unitPriceIdr: z.int(),
  lineTotalIdr: z.int(),

  stockState: z.enum(STOCK_STATES),
  availableQuantity: z.int(),
});

export type CartLine = z.infer<typeof cartLineSchema>;

export const cartSchema = z.object({
  id: z.string(),
  lines: z.array(cartLineSchema),
  totals: z.object({
    subtotalIdr: z.int(),
    lineCount: z.int(),
    selectedQuantity: z.int(),
  }),
});

export type Cart = z.infer<typeof cartSchema>;

/** What `POST /cart/items` accepts. No price field — the server prices the line. */
export interface AddCartItem {
  variantId: string;
  quantity: number;
}
