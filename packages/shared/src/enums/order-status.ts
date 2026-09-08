/**
 * Order lifecycle (PRD §8.1). The legal transitions between these live in the server's
 * order state machine, not here — this is only the set of names.
 */
export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PACKING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
