import type { CartNotice } from './entities/cart.entity.js';

/**
 * What a cart line is worth right now, and what changed since it was added (FR-CART-04).
 *
 * **Derived on every read, never written by one.** The cart is read by the header on every page,
 * by the product page for "Already in cart", and by the cart page — often two or three times in
 * one render. A read that clamped a quantity and returned a one-off notice would have that
 * notice consumed by whichever of those ran first, and the customer would never see it. So the
 * row keeps what the customer asked for, and this function works out, each time, what of it can
 * be honoured and what to say about the difference. The notice therefore stays up for as long
 * as it is true, and goes away when the customer acts on the line or the stock comes back.
 *
 * Pure, so the rules are testable without a database and cannot drift between the cart and the
 * Phase 7 checkout that reuses them.
 */
export interface LineState {
  /** What the row holds — the customer's request, not necessarily what can be sold. */
  requestedQuantity: number;
  /** The variant's price now. */
  unitPriceIdr: number;
  /** The variant's price when the customer added the line. */
  priceAtAddIdr: number;
  availableQuantity: number;
  /** Archived variants and unpublished products cannot be bought, whatever their stock. */
  isSellable: boolean;
}

export interface RevalidatedLine {
  /** What the line counts as. Never more than exists. */
  quantity: number;
  /** False lines stay in the cart as a shortlist, and never count towards a total. */
  isPurchasable: boolean;
  notices: CartNotice[];
}

export function revalidateLine(state: LineState): RevalidatedLine {
  if (!state.isSellable) {
    return { quantity: state.requestedQuantity, isPurchasable: false, notices: [{ kind: 'UNAVAILABLE' }] };
  }

  // Kept at the requested quantity rather than zeroed: it is what the customer wanted, and it is
  // what they will want again if the kit is restocked.
  if (state.availableQuantity <= 0) {
    return { quantity: state.requestedQuantity, isPurchasable: false, notices: [{ kind: 'OUT_OF_STOCK' }] };
  }

  const notices: CartNotice[] = [];
  const quantity = Math.min(state.requestedQuantity, state.availableQuantity);

  // "Only 2 left — quantity reduced to 2" (DESIGN.md §3.6).
  if (quantity < state.requestedQuantity) {
    notices.push({ kind: 'QUANTITY_REDUCED', requestedQuantity: state.requestedQuantity });
  }

  // "Price changed from Rp 320.000" — in either direction. A price drop is good news, and good
  // news applied silently is still a change the customer did not see happen.
  if (state.unitPriceIdr !== state.priceAtAddIdr) {
    notices.push({ kind: 'PRICE_CHANGED', previousUnitPriceIdr: state.priceAtAddIdr });
  }

  return { quantity, isPurchasable: true, notices };
}
