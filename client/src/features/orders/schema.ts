import { z } from 'zod';
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, SHIPPING_TIERS } from '@gunsnip/shared';

/**
 * A placed order, as `GET /orders/:orderNumber` and `POST /orders` return it (FR-CO-09, FR-ORD-03).
 *
 * Money is `z.int()` — whole rupiah, never a float (PRD A2). Every figure is the snapshot taken at
 * purchase; nothing here is recomputed in the browser (CLAUDE.md non-negotiable #2).
 */
export const orderItemSchema = z.object({
  id: z.string(),
  /**
   * Set when the line was bought as part of a bundle (FR-CAT-11). Lines sharing a name are the
   * one item the customer chose; the name rather than an id, because a retired bundle takes its
   * id with it and the grouping has to outlive that.
   */
  bundleName: z.string().nullable(),
  productName: z.string(),
  variantName: z.string().nullable(),
  sku: z.string(),
  productSlug: z.string(),
  imageUrl: z.string().nullable(),
  unitPriceIdr: z.int(),
  quantity: z.int(),
  lineTotalIdr: z.int(),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderTimelineEntrySchema = z.object({
  status: z.enum(ORDER_STATUSES),
  at: z.iso.datetime(),
  note: z.string().nullable(),
});

export type OrderTimelineEntry = z.infer<typeof orderTimelineEntrySchema>;

/**
 * How to pay, as the provider worded it (FR-PAY-03). Null once there is nothing left to pay — the
 * server stops sending instructions the moment the charge is settled, expired or failed, so the
 * page has no way to show an account number that would take a customer's money for nothing.
 */
export const paymentInstructionsSchema = z.object({
  channel: z.string(),
  accountNumber: z.string(),
  accountName: z.string(),
  amountIdr: z.int(),
  steps: z.array(z.string()),
});

export type PaymentInstructions = z.infer<typeof paymentInstructionsSchema>;

export const orderSchema = z.object({
  orderNumber: z.string(),
  status: z.enum(ORDER_STATUSES),
  placedAt: z.iso.datetime(),
  canCancel: z.boolean(),
  cancelReason: z.string().nullable(),

  items: z.array(orderItemSchema),
  totals: z.object({
    subtotalIdr: z.int(),
    discountIdr: z.int(),
    shippingIdr: z.int(),
    totalIdr: z.int(),
  }),
  voucherCode: z.string().nullable(),

  contact: z.object({ name: z.string(), email: z.string(), phone: z.string() }),
  address: z.object({
    street: z.string(),
    district: z.string().nullable(),
    city: z.string().nullable(),
    province: z.string(),
    postalCode: z.string(),
    notes: z.string().nullable(),
  }),
  delivery: z.object({ tier: z.enum(SHIPPING_TIERS), minDays: z.int(), maxDays: z.int() }),
  payment: z
    .object({
      method: z.enum(PAYMENT_METHODS),
      status: z.enum(PAYMENT_STATUSES),
      amountIdr: z.int(),
      expiresAt: z.iso.datetime(),
      instructions: paymentInstructionsSchema.nullable(),
    })
    .nullable(),
  timeline: z.array(orderTimelineEntrySchema),
});

export type Order = z.infer<typeof orderSchema>;
