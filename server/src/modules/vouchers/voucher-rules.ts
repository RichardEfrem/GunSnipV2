import type {
  VoucherBasket,
  VoucherBasketLine,
  VoucherEvaluation,
  VoucherRejection,
} from './entities/voucher-evaluation.entity.js';
import type { VoucherScope, VoucherTerms } from './entities/voucher-terms.entity.js';

/**
 * Whether a voucher applies to a basket, and what it takes off (FR-PROMO-01, FR-PROMO-02).
 *
 * Pure, and in its own file, because voucher validation is a mandatory unit-test target
 * (CLAUDE.md Testing) and because the cart and checkout must reach the same answer: Phase 7
 * calls this again inside the order transaction, and a second implementation there would be a
 * second opinion about money.
 *
 * The rules run in a fixed order, cheapest-to-fix last. A voucher that has expired says so even
 * when the basket is also too small, because no amount of adding to the cart will help.
 *
 * Integer arithmetic throughout. A percentage rounds **down**, so the store never gives away
 * more than the stated percentage — the one direction a rounding error cannot be allowed to go.
 */
export interface VoucherUsage {
  /** How many times this actor has already redeemed the voucher on a placed order. */
  sessionRedemptions: number;
}

export function evaluateVoucher(
  terms: VoucherTerms,
  basket: VoucherBasket,
  usage: VoucherUsage,
  now: Date,
): VoucherEvaluation {
  const rejection = firstRejection(terms, basket, usage, now);
  if (rejection !== null) return { isValid: false, rejection };

  const eligibleSubtotal = sumLines(eligibleLines(terms.scope, basket.lines));

  return { isValid: true, discountIdr: discountFor(terms, eligibleSubtotal, basket.shippingIdr) };
}

function firstRejection(
  terms: VoucherTerms,
  basket: VoucherBasket,
  usage: VoucherUsage,
  now: Date,
): VoucherRejection | null {
  // A voucher whose value is missing or nonsensical cannot be honoured, and to the customer it
  // is indistinguishable from one the operator switched off.
  if (!terms.isActive || !isWellFormed(terms)) return { reason: 'INACTIVE' };

  if (now < terms.startsAt) return { reason: 'NOT_STARTED', startsAt: terms.startsAt.toISOString() };
  if (now >= terms.endsAt) return { reason: 'EXPIRED', endsAt: terms.endsAt.toISOString() };

  if (terms.usageLimit !== null && terms.usedCount >= terms.usageLimit) {
    return { reason: 'USAGE_LIMIT_REACHED' };
  }

  if (terms.perSessionLimit !== null && usage.sessionRedemptions >= terms.perSessionLimit) {
    return { reason: 'SESSION_LIMIT_REACHED' };
  }

  if (basket.lines.length === 0) return { reason: 'NOTHING_SELECTED' };

  const eligible = eligibleLines(terms.scope, basket.lines);
  if (eligible.length === 0) return { reason: 'NO_ELIGIBLE_ITEMS' };

  // Minimum spend is measured on what the voucher covers. A Master Grade voucher with a
  // Rp 500.000 minimum is not met by Rp 490.000 of kits plus a Rp 50.000 nipper.
  const eligibleSubtotal = sumLines(eligible);

  if (terms.minSpendIdr !== null && eligibleSubtotal < terms.minSpendIdr) {
    return {
      reason: 'MIN_SPEND_NOT_MET',
      minSpendIdr: terms.minSpendIdr,
      shortfallIdr: terms.minSpendIdr - eligibleSubtotal,
    };
  }

  return null;
}

/**
 * The amount off. Never more than the thing it discounts: a percentage or a fixed amount is
 * bounded by the eligible subtotal, free shipping by the shipping.
 */
function discountFor(terms: VoucherTerms, eligibleSubtotal: number, shippingIdr: number): number {
  switch (terms.type) {
    case 'PERCENTAGE': {
      const percentOff = terms.percentOff ?? 0;
      const raw = Math.floor((eligibleSubtotal * percentOff) / 100);
      return Math.min(raw, terms.maxDiscountIdr ?? raw, eligibleSubtotal);
    }

    case 'FIXED_AMOUNT':
      return Math.min(terms.amountIdr ?? 0, eligibleSubtotal);

    case 'FREE_SHIPPING':
      // `amountIdr` caps the waiver when set ("free shipping up to Rp 20.000"); unset means all
      // of it. `maxDiscountIdr` is honoured too, so a cap set in either column holds.
      return Math.min(
        shippingIdr,
        terms.amountIdr ?? shippingIdr,
        terms.maxDiscountIdr ?? shippingIdr,
      );
  }
}

/** A percentage needs 1–100; a fixed amount needs a positive amount. Free shipping needs neither. */
function isWellFormed(terms: VoucherTerms): boolean {
  switch (terms.type) {
    case 'PERCENTAGE':
      return terms.percentOff !== null && terms.percentOff > 0 && terms.percentOff <= 100;
    case 'FIXED_AMOUNT':
      return terms.amountIdr !== null && terms.amountIdr > 0;
    case 'FREE_SHIPPING':
      return true;
  }
}

/** Empty scope covers everything (FR-PROMO-02); otherwise a product or category match. */
function eligibleLines(
  scope: VoucherScope,
  lines: readonly VoucherBasketLine[],
): readonly VoucherBasketLine[] {
  if (scope.categoryIds.size === 0 && scope.productIds.size === 0) return lines;

  return lines.filter(
    (line) =>
      scope.productIds.has(line.productId) ||
      line.categoryIds.some((categoryId) => scope.categoryIds.has(categoryId)),
  );
}

function sumLines(lines: readonly VoucherBasketLine[]): number {
  return lines.reduce((total, line) => total + line.lineTotalIdr, 0);
}
