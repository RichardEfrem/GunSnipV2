import { z } from 'zod';
import { ADDRESS_REGION_LEVELS, SHIPPING_TIERS, SHIPPING_ZONES } from '@gunsnip/shared';
import { cartNoticeSchema, cartVoucherSchema } from '@/features/cart/schema';

/**
 * The checkout API's responses (CLAUDE.md non-negotiable #4).
 *
 * Notices and vouchers reuse the cart's schemas on purpose: the server builds the checkout lines
 * with the cart's own revalidation and voucher verdict, so they are the same shapes, and two
 * schemas for one shape would be two things to keep in step.
 */
export const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.enum(ADDRESS_REGION_LEVELS),
  postalCode: z.string().nullable(),
  hasChildren: z.boolean(),
});

export type Region = z.infer<typeof regionSchema>;

export const regionListSchema = z.array(regionSchema);

export const shippingOptionSchema = z.object({
  tier: z.enum(SHIPPING_TIERS),
  priceIdr: z.int(),
  minDays: z.int(),
  maxDays: z.int(),
});

export type ShippingOption = z.infer<typeof shippingOptionSchema>;

export const checkoutLineSchema = z.object({
  /**
   * The cart line this quotes — what `POST /orders` sends back to confirm it. A variant id no
   * longer identifies one line: a bundle can put the same variant in the cart twice, at a
   * different price (FR-CAT-11).
   */
  cartLineId: z.string(),
  variantId: z.string(),
  /** Set when the line is part of a bundle, so the summary can group and name it. */
  bundle: z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable(),
  sku: z.string(),
  productName: z.string(),
  productSlug: z.string(),
  variantName: z.string().nullable(),
  image: z.object({ url: z.string(), alt: z.string(), blurDataUrl: z.string() }).nullable(),
  quantity: z.int(),
  unitPriceIdr: z.int(),
  lineTotalIdr: z.int(),
  notices: z.array(cartNoticeSchema),
});

export type CheckoutLine = z.infer<typeof checkoutLineSchema>;

export const checkoutQuoteSchema = z.object({
  lines: z.array(checkoutLineSchema),
  unavailableCount: z.int(),
  voucher: cartVoucherSchema.nullable(),
  delivery: z
    .object({
      regionId: z.string(),
      zone: z.enum(SHIPPING_ZONES).nullable(),
      isComplete: z.boolean(),
      options: z.array(shippingOptionSchema),
      selected: shippingOptionSchema.nullable(),
    })
    .nullable(),
  totals: z.object({
    subtotalIdr: z.int(),
    discountIdr: z.int(),
    shippingIdr: z.int(),
    totalIdr: z.int(),
    itemCount: z.int(),
  }),
});

export type CheckoutQuote = z.infer<typeof checkoutQuoteSchema>;

/** `details` of a `TOTAL_CHANGED` refusal — the new total, worded by `order-error-message.ts`. */
export const totalChangedDetailsSchema = z.object({ expectedTotalIdr: z.int(), totalIdr: z.int() });

/** `details` of a `RATE_LIMITED` refusal — the wait, worded by `order-error-message.ts`. */
export const rateLimitedDetailsSchema = z.object({ retryAfterSeconds: z.int().positive() });
