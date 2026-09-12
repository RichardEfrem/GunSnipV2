import type { VoucherRejection } from '../entities/voucher-evaluation.entity.js';
import { ValidationError } from '../../../common/errors/validation.error.js';

/**
 * A voucher that cannot be applied, and exactly why (FR-CART-06).
 *
 * A `ValidationError` — the request was well-formed and the rule is what failed — so it maps to
 * 400 through the existing filter entry. `details` carries the structured rejection rather than
 * a finished sentence, because several reasons carry an amount or a date and those are
 * formatted by the storefront (CLAUDE.md non-negotiable #1).
 */
export class VoucherRejectedError extends ValidationError {
  override readonly code: string = 'VOUCHER_REJECTED';

  constructor(
    readonly voucherCode: string,
    readonly rejection: VoucherRejection,
  ) {
    super(`Voucher ${voucherCode} cannot be applied: ${rejection.reason}.`, {
      code: voucherCode,
      ...rejection,
    });
  }
}
