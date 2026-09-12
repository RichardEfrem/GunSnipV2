import type { OrderStatus, PaymentMethod, PaymentStatus, ShippingTier, ShippingZone } from '@gunsnip/shared';

/**
 * Words for the enums the API sends, used by more than one feature — the cart names a zone,
 * checkout offers tiers and methods, a placed order shows all of them back. One spelling each, so
 * "Virtual account" at checkout is "Virtual account" on the confirmation page (DESIGN.md §5: an
 * action keeps its name through the whole flow).
 *
 * `Record`s over the full unions, so a status added in `@gunsnip/shared` fails the build here
 * until it has a label.
 */

export const SHIPPING_ZONE_LABELS: Record<ShippingZone, string> = {
  JABODETABEK: 'Jabodetabek',
  JAVA: 'Java',
  BALI_NUSA: 'Bali and Nusa Tenggara',
  SUMATRA: 'Sumatra',
  KALIMANTAN: 'Kalimantan',
  SULAWESI: 'Sulawesi',
  MALUKU_PAPUA: 'Maluku and Papua',
};

export const SHIPPING_TIER_LABELS: Record<ShippingTier, string> = {
  REGULAR: 'Regular',
  EXPRESS: 'Express',
  SAME_DAY: 'Same day',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  VIRTUAL_ACCOUNT: 'Virtual account',
  E_WALLET: 'E-wallet',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Awaiting payment',
  PAID: 'Paid',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  REFUNDED: 'Refunded',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  PACKING: 'Packing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  REFUNDED: 'Refunded',
};
