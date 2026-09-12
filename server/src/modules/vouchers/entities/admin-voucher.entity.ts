import type { VoucherType } from '@gunsnip/shared';

/**
 * A voucher as the back office sees it (FR-ADM-10).
 *
 * Carries the usage counter FR-ADM-10 asks for, and `redemptionCount` beside it. They are not
 * the same number and the difference matters: `usedCount` is the live counter the order
 * transaction increments and a cancellation decrements, while `redemptionCount` is how many
 * redemption rows survive. A gap between them means orders were cancelled, which is worth seeing
 * rather than hiding behind one figure.
 */
export interface AdminVoucher {
  id: string;
  code: string;
  type: VoucherType;
  description: string | null;

  percentOff: number | null;
  amountIdr: number | null;
  minSpendIdr: number | null;
  maxDiscountIdr: number | null;

  /** ISO 8601, UTC. Formatted in Asia/Jakarta at the render layer. */
  startsAt: string;
  endsAt: string;

  usageLimit: number | null;
  perSessionLimit: number | null;
  usedCount: number;
  redemptionCount: number;
  isActive: boolean;

  /** Both empty means the whole catalogue. */
  categoryIds: readonly string[];
  productIds: readonly string[];

  createdAt: string;
}
