import type { CheckoutLine } from './entities/checkout-quote.entity.js';
import type { QuotedLine } from './order-lines.js';

/** A quoted line to the shape the checkout summary renders (DESIGN.md §3.7). */
export function toCheckoutLine({ basketLine, quantity, lineTotalIdr, notices }: QuotedLine): CheckoutLine {
  return {
    // What the client sends back to confirm this exact line (FR-CO-08). The variant id is here
    // for links and images; it no longer identifies a line, because a bundle can put the same
    // variant in the cart twice.
    cartLineId: basketLine.cartLineId,
    variantId: basketLine.variantId,
    bundle: basketLine.bundle,
    sku: basketLine.sku,
    productName: basketLine.productName,
    productSlug: basketLine.productSlug,
    variantName: basketLine.variantName,
    image: basketLine.image,
    quantity,
    unitPriceIdr: basketLine.unitPriceIdr,
    lineTotalIdr,
    notices,
  };
}
