import { ConflictError } from '../../../common/errors/conflict.error.js';

/**
 * Not enough of a variant to reserve what was asked for (FR-CO-08).
 *
 * FR-CO-08 asks for "a specific message naming the line", so the product name is part of the
 * error rather than something the client has to look up from an id — the storefront shows the
 * message as it stands, and `details` carries the numbers for anything that wants to branch.
 */
export class InsufficientStockError extends ConflictError {
  override readonly code: string = 'INSUFFICIENT_STOCK';

  constructor(productName: string, variantId: string, requested: number, available: number) {
    super(available <= 0 ? `${productName} is out of stock.` : `Only ${available} of ${productName} left.`, {
      variantId,
      productName,
      requested,
      available: Math.max(0, available),
    });
  }
}
