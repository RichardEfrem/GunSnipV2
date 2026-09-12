import type { PaymentMethod, ShippingTier } from '@gunsnip/shared';
import type { PaymentInstructions } from '../../payments/provider/payment-provider.js';
import type { AuditActor } from '../audit-actor.js';
import type { CustomerSnapshot } from './customer-snapshot.js';

/**
 * Everything one `POST /orders` writes, decided before any of it is written.
 *
 * The service builds this from locked rows with pure functions; the transaction unit writes it
 * without making a single decision of its own. That split is what keeps business rules out of
 * the repository and Prisma out of the service (CLAUDE.md layer rules).
 */
export interface OrderDraft {
  orderNumber: string;
  sessionId: string;
  userId: string | null;
  placedAt: Date;

  customerSnapshot: CustomerSnapshot;
  customerNote: string | null;
  shippingRegionId: string;
  shippingTier: ShippingTier;
  shippingMinDays: number;
  shippingMaxDays: number;

  subtotalIdr: number;
  discountIdr: number;
  shippingIdr: number;
  totalIdr: number;

  items: readonly OrderItemDraft[];
  /** The creation row of the order's history (FR-ORD-06): from nothing to PENDING_PAYMENT. */
  placedBy: AuditActor;
  payment: PaymentDraft;
  /** Present only when the voucher actually took something off (FR-PROMO-05: one at most). */
  redemption: { voucherId: string; amountIdr: number } | null;
}

/** An order line, snapshotted (FR-ORD-05). Nothing here is read back through the variant. */
export interface OrderItemDraft {
  variantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string;
  imageUrlSnapshot: string | null;
  productSlugSnapshot: string;
  unitPriceIdr: number;
  quantity: number;
  lineTotalIdr: number;
}

/**
 * The payment record every order is created with (FR-PAY-01): pending, for the order's total, by
 * the method the customer chose, open until `expiresAt`, carrying the charge the configured
 * `PaymentProvider` opened for it (PRD §11.3).
 */
export interface PaymentDraft {
  /** Which provider opened the charge — 'mock' now, a gateway name later. */
  provider: string;
  method: PaymentMethod;
  amountIdr: number;
  expiresAt: Date;
  /** The provider's own id for the charge: the mock's virtual account number. */
  providerRef: string;
  /** What the confirmation page shows the customer (FR-PAY-03). */
  instructions: PaymentInstructions;
}
