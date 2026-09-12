import { ConflictError } from '../../../common/errors/conflict.error.js';

/**
 * The order names a line the cart no longer holds as it did when checkout was shown — removed,
 * deselected or reduced in another tab. Placing it anyway would be ordering something the
 * customer has since changed their mind about, so the order stops and checkout re-reads the cart.
 */
export class CartChangedError extends ConflictError {
  override readonly code: string = 'CART_CHANGED';

  constructor(line: { cartLineId?: string; variantId?: string }) {
    super('Your cart changed since checkout opened. Check the summary and place the order again.', {
      ...(line.cartLineId === undefined ? {} : { cartLineId: line.cartLineId }),
      ...(line.variantId === undefined ? {} : { variantId: line.variantId }),
    });
  }
}
