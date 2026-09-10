/**
 * The payment lifecycle as logged to `payment_event` (FR-PAY-07).
 *
 * Named after gateway webhook events rather than after our own status values, because that log
 * is shaped like a real gateway's payload — swapping `MockPaymentProvider` for a live gateway
 * should change what writes these rows, not what they look like.
 */
export const PAYMENT_EVENT_TYPES = [
  'CHARGE_CREATED',
  'CHARGE_PAID',
  'CHARGE_FAILED',
  'CHARGE_EXPIRED',
  'CHARGE_REFUNDED',
] as const;

export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];
