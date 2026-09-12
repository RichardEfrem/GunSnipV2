import type { CheckoutLine } from './entities/checkout-quote.entity.js';
import type { QuotedLine } from './order-lines.js';

/** A quoted line to the shape the checkout summary renders (DESIGN.md §3.7). */
export function toCheckoutLine({ basketLine, quantity, lineTotalIdr, notices }: QuotedLine): CheckoutLine {
  return {
    variantId: basketLine.variantId,
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
