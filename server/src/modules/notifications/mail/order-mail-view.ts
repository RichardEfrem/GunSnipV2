import type { OrderStatus, PaymentMethod } from '@gunsnip/shared';
import type { PaymentInstructions } from '../../payments/provider/payment-provider.js';

/**
 * Everything a transactional mail about an order needs, and nothing else (FR-NOTIF-01).
 *
 * A narrow read rather than the order aggregate. A mail wants the customer's name and what they
 * bought; it has no use for a session id, an internal note or a cancellation reason, and handing
 * it the whole record would make every template a place those could accidentally be printed.
 *
 * Money stays integer minor units all the way here (CLAUDE.md non-negotiable #1) — the templates
 * are the render layer and the only place it becomes a string.
 */
export interface OrderMailView {
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  email: string;

  items: readonly OrderMailLine[];
  totals: OrderMailTotals;

  payment: OrderMailPayment | null;
  shipment: OrderMailShipment | null;

  /**
   * One tokenised link per delivered line (FR-REV-02). Empty for every mail but the delivery
   * one — the invite is what authorises the review, so it is minted and sent together.
   */
  reviewLinks: readonly OrderMailReviewLink[];
}

export interface OrderMailLine {
  name: string;
  variantName: string | null;
  quantity: number;
  lineTotalIdr: number;
}

export interface OrderMailTotals {
  subtotalIdr: number;
  discountIdr: number;
  shippingIdr: number;
  totalIdr: number;
}

export interface OrderMailPayment {
  method: PaymentMethod;
  amountIdr: number;
  expiresAt: Date;
  instructions: PaymentInstructions | null;
}

export interface OrderMailShipment {
  courier: string;
  trackingNumber: string | null;
  estimatedDays: number | null;
}

export interface OrderMailReviewLink {
  productName: string;
  /** Absolute, because a mail client has no origin to resolve a relative path against. */
  url: string;
}
