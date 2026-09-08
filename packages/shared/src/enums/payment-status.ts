/** Payment lifecycle (PRD §8.2). Transitions live in the server's payment state machine. */
export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
