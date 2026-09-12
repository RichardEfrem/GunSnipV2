import { ConflictError } from '../../../common/errors/conflict.error.js';

/**
 * The order would cost something other than what the customer was shown.
 *
 * The client sends the total it displayed, and **it is never charged** (CLAUDE.md
 * non-negotiable #2) — the server prices the order from the database regardless. It is used only
 * to notice that a price, a voucher or a rate moved between the summary being drawn and "Place
 * order" being pressed. Charging the new amount silently is the fee-surprise pattern DESIGN.md
 * §3.7 exists to avoid, so the order stops and the new total is put in front of the customer.
 *
 * Amounts travel as integers and are worded by the storefront (non-negotiable #1).
 */
export class TotalChangedError extends ConflictError {
  override readonly code: string = 'TOTAL_CHANGED';

  constructor(expectedTotalIdr: number, totalIdr: number) {
    super('The total changed since checkout opened. Check the summary and place the order again.', {
      expectedTotalIdr,
      totalIdr,
    });
  }
}
