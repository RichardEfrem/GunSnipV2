import type { VoucherEvaluation } from '../vouchers/entities/voucher-evaluation.entity.js';
import { evaluateVoucher } from '../vouchers/voucher-rules.js';
import type { BasketVoucher } from './entities/basket.entity.js';
import type { OrderLine } from './order-lines.js';

/**
 * What an order costs (FR-CO-05, PRD §8.3).
 *
 * The one function both the checkout summary and the order itself are priced by, so the total the
 * customer is shown and the total the order records are the same computation over the same
 * inputs — not two implementations that agree today. The order transaction calls it with the
 * variant and voucher rows locked; the quote calls it without.
 *
 * Pure, because price calculation is a mandatory unit-test target (CLAUDE.md Testing). Integer
 * arithmetic throughout: every input is whole rupiah (PRD A2), so there is no rounding step here —
 * the voucher rules round their one percentage down, and nothing else divides.
 */
export interface OrderPricing {
  subtotalIdr: number;
  discountIdr: number;
  shippingIdr: number;
  /** `subtotalIdr − discountIdr + shippingIdr`, the same three columns the order row stores. */
  totalIdr: number;
  /** The voucher's verdict against this exact order, or null when the cart has none. */
  voucher: VoucherEvaluation | null;
}

export function priceOrder(
  lines: readonly OrderLine[],
  shippingIdr: number,
  voucher: BasketVoucher | null,
  now: Date,
): OrderPricing {
  const subtotalIdr = lines.reduce((total, line) => total + line.lineTotalIdr, 0);
  // Nothing to ship means no shipping, whatever rate the caller looked up.
  const chargedShippingIdr = lines.length === 0 ? 0 : shippingIdr;

  // Checked against the real shipping, not the cart's estimate: a free-shipping voucher waives
  // what this address actually costs (FR-PROMO-01).
  const evaluation =
    voucher === null
      ? null
      : evaluateVoucher(
          voucher.terms,
          {
            shippingIdr: chargedShippingIdr,
            lines: lines.map((line) => ({
              productId: line.basketLine.productId,
              categoryIds: line.basketLine.categoryIds,
              lineTotalIdr: line.lineTotalIdr,
            })),
          },
          { sessionRedemptions: voucher.sessionRedemptions },
          now,
        );

  // The rules already bound a discount by what it discounts; this is the last line of defence
  // against a total below zero, not the rule.
  const discountIdr = Math.min(
    evaluation?.isValid === true ? evaluation.discountIdr : 0,
    subtotalIdr + chargedShippingIdr,
  );

  return {
    subtotalIdr,
    discountIdr,
    shippingIdr: chargedShippingIdr,
    totalIdr: subtotalIdr - discountIdr + chargedShippingIdr,
    voucher: evaluation,
  };
}
