import { Injectable } from '@nestjs/common';
import { MAX_QUANTITY_PER_LINE, type Actor } from '@gunsnip/shared';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { emptyCart, toCartView } from './cart-mapper.js';
import {
  CartRepository,
  type AddLine,
  type PricedLine,
  type SellableVariant,
} from './cart.repository.js';
import type { CartView } from './entities/cart.entity.js';

/**
 * The cart (FR-CART-01 … FR-CART-03, FR-PDP-07, FR-PDP-08).
 *
 * Takes an `Actor`, never a user id (CLAUDE.md non-negotiable #6). Phase 0 only ever sees the
 * guest arm, and the cart it finds by `session_id` is the same row Phase 1 will find by
 * `user_id` after adoption — which is why nothing here branches on which arm it got.
 *
 * **No price a client sends is ever read.** The request names a variant and a quantity; every
 * rupiah in the response comes back out of the database (CLAUDE.md non-negotiable #2).
 */
@Injectable()
export class CartService {
  constructor(private readonly carts: CartRepository) {}

  async view(actor: Actor): Promise<CartView> {
    const row = await this.carts.find(actor);

    // Reading a cart never creates one. An empty cart is a normal state, not a missing thing.
    return row === null ? emptyCart() : toCartView(row);
  }

  /**
   * Adds one or more lines and returns the whole cart.
   *
   * Returning the cart rather than the created lines is what lets "Add selected" be a single
   * round trip: the mini-cart, the header count and the requirements block's "Already in cart"
   * state all update from one response, with no follow-up GET that could disagree with it.
   */
  async addItems(actor: Actor, items: readonly AddLine[]): Promise<CartView> {
    const merged = this.mergeDuplicates(items);
    const variants = await this.carts.findSellableVariants([...merged.keys()]);

    this.assertAllSellable(merged, variants);

    const cartId = await this.carts.ensure(actor);
    const existing = await this.carts.quantitiesByVariant(cartId);

    await this.carts.addLines(cartId, this.price(merged, variants, existing));

    const row = await this.carts.find(actor);

    // The cart was created or updated a statement ago; its absence would mean a write vanished.
    if (row === null) throw new ConflictError('The cart could not be read back after the add.');

    return toCartView(row);
  }

  /**
   * Folds a request that names the same variant twice into one line.
   *
   * "Add selected" can legitimately do this — two rows of the requirements block can resolve to
   * the same tool — and an upsert per entry would otherwise have the second overwrite the
   * first's quantity rather than add to it.
   */
  private mergeDuplicates(items: readonly AddLine[]): Map<string, number> {
    const merged = new Map<string, number>();

    for (const item of items) {
      merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
    }

    return merged;
  }

  /**
   * Every variant asked for has to exist and be buyable, or the whole add fails.
   *
   * All-or-nothing on purpose: a partial success is indistinguishable to the customer from a
   * full one until they open the cart and count, and "Add selected" adding three of four tools
   * silently is exactly the failure FR-CART-04 exists to prevent elsewhere.
   */
  private assertAllSellable(
    wanted: ReadonlyMap<string, number>,
    variants: ReadonlyMap<string, SellableVariant>,
  ): void {
    for (const variantId of wanted.keys()) {
      if (!variants.has(variantId)) {
        throw new NotFoundError('That item is no longer available.', { variantId });
      }
    }

    for (const [variantId, quantity] of wanted) {
      const variant = variants.get(variantId);
      if (variant === undefined) continue;

      if (variant.availableQuantity <= 0) {
        throw new ConflictError(`${variant.productName} is out of stock.`, {
          variantId,
          availableQuantity: 0,
        });
      }

      if (quantity > variant.availableQuantity) {
        throw new ConflictError(
          `Only ${variant.availableQuantity} of ${variant.productName} left.`,
          { variantId, requested: quantity, availableQuantity: variant.availableQuantity },
        );
      }
    }
  }

  /**
   * The quantity each line ends up at, and the price to record against it.
   *
   * Adding to a line already in the cart is cumulative — clicking "Add to cart" twice means two
   * — and the sum is clamped rather than rejected: a customer who already holds nine and asks
   * for three has not made a mistake worth an error page, they have hit a ceiling, and the
   * cart tells them so by holding ten.
   */
  private price(
    wanted: ReadonlyMap<string, number>,
    variants: ReadonlyMap<string, SellableVariant>,
    existing: ReadonlyMap<string, number>,
  ): PricedLine[] {
    const lines: PricedLine[] = [];

    for (const [variantId, quantity] of wanted) {
      const variant = variants.get(variantId);
      if (variant === undefined) continue;

      const total = (existing.get(variantId) ?? 0) + quantity;

      lines.push({
        variantId,
        quantity: Math.min(total, MAX_QUANTITY_PER_LINE, variant.availableQuantity),
        // From the database, on the server, at this instant. Never from the request.
        priceAtAddIdr: variant.priceIdr,
      });
    }

    return lines;
  }
}
