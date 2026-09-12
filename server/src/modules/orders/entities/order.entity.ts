import type { OrderStatus, PaymentMethod, PaymentStatus, ShippingTier } from '@gunsnip/shared';
import type { PaymentInstructions } from '../../payments/provider/payment-provider.js';

/**
 * An order as the confirmation and order-detail pages render it (FR-CO-09, FR-ORD-03).
 *
 * Every line is the **snapshot** taken at purchase (FR-ORD-05) — nothing here reads through to
 * the catalogue, so a renamed kit or a price change never alters a past order. Money is whole
 * rupiah; dates are ISO strings in UTC, formatted in Asia/Jakarta by the storefront.
 */
export interface OrderView {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  /**
   * Whether the buyer may cancel it now (FR-ORD-04). Asked of the state machine on the server so
   * the storefront never has to know which statuses allow it.
   */
  canCancel: boolean;
  cancelReason: string | null;

  items: readonly OrderItemView[];
  totals: OrderTotals;
  /** The voucher redeemed on this order, if any. One at most (FR-PROMO-05). */
  voucherCode: string | null;

  contact: { name: string; email: string; phone: string };
  address: OrderAddress;
  delivery: { tier: ShippingTier; minDays: number; maxDays: number };
  /** Null only for an order that predates payment records — none do, but the relation is optional. */
  payment: OrderPayment | null;
  /** Every status change, oldest first (FR-ORD-06) — what the status timeline is drawn from. */
  timeline: readonly OrderTimelineEntry[];
}

export interface OrderItemView {
  id: string;
  productName: string;
  variantName: string | null;
  sku: string;
  productSlug: string;
  imageUrl: string | null;
  unitPriceIdr: number;
  quantity: number;
  lineTotalIdr: number;
}

export interface OrderTotals {
  subtotalIdr: number;
  discountIdr: number;
  shippingIdr: number;
  totalIdr: number;
}

export interface OrderAddress {
  street: string;
  district: string | null;
  city: string | null;
  province: string;
  postalCode: string;
  /** The customer's delivery note, when they left one. */
  notes: string | null;
}

export interface OrderPayment {
  method: PaymentMethod;
  status: PaymentStatus;
  amountIdr: number;
  /** When the window closes. The confirmation page counts down to it (FR-PAY-03). */
  expiresAt: string;
  /** How to pay, as the provider worded it (FR-PAY-03). Null once there is nothing left to pay. */
  instructions: PaymentInstructions | null;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  at: string;
  note: string | null;
}
