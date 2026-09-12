import { z } from 'zod';
import { SHIPPING_TIERS, SHIPPING_ZONES, STOCK_STATES, VOUCHER_TYPES } from '@gunsnip/shared';

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

/** What changed since a line was added (FR-CART-04). Worded by `notice-copy.ts`. */
export const cartNoticeSchema = z.union([
  z.object({ kind: z.literal('PRICE_CHANGED'), previousUnitPriceIdr: z.int() }),
  z.object({ kind: z.literal('QUANTITY_REDUCED'), requestedQuantity: z.int() }),
  z.object({ kind: z.literal('OUT_OF_STOCK') }),
  z.object({ kind: z.literal('UNAVAILABLE') }),
]);

export type CartNotice = z.infer<typeof cartNoticeSchema>;

export const cartLineSchema = z.object({
  id: z.string(),
  quantity: z.int(),
  isSelected: z.boolean(),
  isPurchasable: z.boolean(),
  notices: z.array(cartNoticeSchema),

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

/**
 * Why a voucher cannot be used (FR-CART-06). Structured, because two reasons carry a date and
 * one carries money, and both are formatted here rather than on the server. Worded by
 * `voucher-copy.ts`.
 */
export const voucherRejectionSchema = z.union([
  z.object({
    reason: z.enum([
      'NOT_FOUND',
      'INACTIVE',
      'USAGE_LIMIT_REACHED',
      'SESSION_LIMIT_REACHED',
      'NOTHING_SELECTED',
      'NO_ELIGIBLE_ITEMS',
    ]),
  }),
  z.object({ reason: z.literal('NOT_STARTED'), startsAt: z.iso.datetime() }),
  z.object({ reason: z.literal('EXPIRED'), endsAt: z.iso.datetime() }),
  z.object({ reason: z.literal('MIN_SPEND_NOT_MET'), minSpendIdr: z.int(), shortfallIdr: z.int() }),
]);

export type VoucherRejection = z.infer<typeof voucherRejectionSchema>;

/** The `details` of a `VOUCHER_REJECTED` error: the rejection, plus the code it was for. */
export const voucherRejectedDetailsSchema = z.intersection(
  z.object({ code: z.string() }),
  voucherRejectionSchema,
);

export const cartVoucherSchema = z.object({
  code: z.string(),
  type: z.enum(VOUCHER_TYPES),
  description: z.string().nullable(),
  isApplied: z.boolean(),
  discountIdr: z.int(),
  rejection: voucherRejectionSchema.nullable(),
});

export type CartVoucher = z.infer<typeof cartVoucherSchema>;

export const shippingEstimateSchema = z.object({
  zone: z.enum(SHIPPING_ZONES),
  tier: z.enum(SHIPPING_TIERS),
  priceIdr: z.int(),
  minDays: z.int(),
  maxDays: z.int(),
});

export type ShippingEstimate = z.infer<typeof shippingEstimateSchema>;

export const cartTotalsSchema = z.object({
  subtotalIdr: z.int(),
  discountIdr: z.int(),
  shippingIdr: z.int(),
  totalIdr: z.int(),
  lineCount: z.int(),
  selectedQuantity: z.int(),
});

export type CartTotals = z.infer<typeof cartTotalsSchema>;

export const cartSchema = z.object({
  id: z.string(),
  lines: z.array(cartLineSchema),
  voucher: cartVoucherSchema.nullable(),
  shippingEstimate: shippingEstimateSchema.nullable(),
  totals: cartTotalsSchema,
});

export type Cart = z.infer<typeof cartSchema>;

/** What `POST /cart/items` accepts. No price field — the server prices the line. */
export interface AddCartItem {
  variantId: string;
  quantity: number;
}

/** What `PATCH /cart/items/:id` accepts. Either field, or both. */
export interface CartLineChange {
  quantity?: number;
  isSelected?: boolean;
}
