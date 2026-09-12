import type { Prisma } from '../../generated/prisma/client.js';
import type { VoucherTerms } from './entities/voucher-terms.entity.js';

/**
 * How a voucher row becomes `VoucherTerms` — the select and the mapping, in one place.
 *
 * Shared by `VoucherRepository`, which reads a voucher for the cart, and by the order
 * transaction, which reads the same voucher again *after locking its row* so the usage limit
 * cannot be overtaken by a concurrent order (FR-PROMO-02). Two copies of this select would be two
 * opinions about what a voucher's terms are.
 */
export const VOUCHER_TERMS_SELECT = {
  id: true,
  code: true,
  type: true,
  description: true,
  percentOff: true,
  amountIdr: true,
  minSpendIdr: true,
  maxDiscountIdr: true,
  startsAt: true,
  endsAt: true,
  usageLimit: true,
  perSessionLimit: true,
  usedCount: true,
  isActive: true,
  categories: { select: { id: true } },
  products: { select: { id: true } },
} satisfies Prisma.VoucherSelect;

type TermsRow = Prisma.VoucherGetPayload<{ select: typeof VOUCHER_TERMS_SELECT }>;

export function toVoucherTerms(row: TermsRow): VoucherTerms {
  const { categories, products, ...terms } = row;

  return {
    ...terms,
    scope: {
      categoryIds: new Set(categories.map((category) => category.id)),
      productIds: new Set(products.map((product) => product.id)),
    },
  };
}
