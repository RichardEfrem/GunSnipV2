import { Injectable } from '@nestjs/common';
import { MAX_QUANTITY_PER_LINE, type Actor } from '@gunsnip/shared';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { bundleAvailability, BundleService } from '../catalog/bundle.service.js';
import type { ShippingEstimate } from '../shipping/entities/shipping-estimate.entity.js';
import { ShippingService } from '../shipping/shipping.service.js';
import type { VoucherBasket } from '../vouchers/entities/voucher-evaluation.entity.js';
import { VoucherRejectedError } from '../vouchers/errors/voucher-rejected.error.js';
import { VoucherService } from '../vouchers/voucher.service.js';
import {
  emptyCart,
  toCartLines,
  toCartVoucher,
  toCartView,
  toVoucherBasket,
} from './cart-mapper.js';
import { countedLines } from './cart-pricing.js';
import {
  CartRepository,
  type AddLine,
  type CartRow,
  type ExistingLine,
  type OwnedLine,
  type PricedLine,
  type SellableVariant,
} from './cart.repository.js';
import type { CartLine, CartVoucher, CartView } from './entities/cart.entity.js';

/** A change to one line, as the storefront asks for it. */
export interface CartLineUpdate {
  quantity?: number;
  isSelected?: boolean;
}

/** A cart's lines priced, with the shipping and voucher basket that follow from them. */
interface PricedLines {
  lines: CartLine[];
  shippingEstimate: ShippingEstimate | null;
  shippingIdr: number;
  basket: VoucherBasket;
}

/**
 * The cart (FR-CART-01 … FR-CART-06, FR-PDP-07, FR-PDP-08).
 *
 * Takes an `Actor`, never a user id (CLAUDE.md non-negotiable #6). Phase 0 only ever sees the
 * guest arm, and the cart it finds by `session_id` is the same row Phase 1 will find by
 * `user_id` after adoption — which is why nothing here branches on which arm it got.
 *
 * **No price a client sends is ever read.** A request names variants, quantities, a selection,
 * a voucher code; every rupiah in the response comes back out of the database, recomputed on
 * every call (CLAUDE.md non-negotiable #2). Every mutation returns the whole cart, so the
 * storefront never has to reconcile a partial answer with what it already shows.
 */
@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly shipping: ShippingService,
    private readonly vouchers: VoucherService,
    private readonly bundles: BundleService,
  ) {}

  async view(actor: Actor): Promise<CartView> {
    // Reading a cart never creates one. An empty cart is a normal state, not a missing thing.
    return this.build(actor, await this.carts.find(actor));
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
    const existing = await this.carts.standaloneLinesByVariant(cartId);

    await this.carts.addLines(cartId, this.price(merged, variants, existing));

    return this.view(actor);
  }

  /**
   * Adds a curated bundle as one item (FR-CAT-11).
   *
   * The bundle lands as one cart row per component, all tagged with the bundle — because stock
   * is held per variant and nothing else — and the view puts them back together. What makes it
   * "one item" to the customer is that everything downstream acts on the group: the quantity,
   * the selection, the removal and the price.
   *
   * Availability is the scarcest component's: a bundle whose nipper has run out cannot be sold
   * at all, however many kits are on the shelf.
   */
  async addBundle(actor: Actor, slug: string, quantity = 1): Promise<CartView> {
    const { row } = await this.bundles.componentsOf(slug);
    const available = bundleAvailability(row);

    if (available <= 0) {
      throw new ConflictError(`${row.name} is not available right now.`, { slug });
    }

    const cartId = await this.carts.ensure(actor);
    const existing = await this.carts.bundleLinesByVariant(cartId, row.id);
    const held = this.bundlesHeld(row, existing);

    // Cumulative and clamped, exactly as an ordinary line is: asking for three when two are left
    // is a ceiling, not a mistake worth an error page.
    const bundles = Math.min(held + quantity, MAX_QUANTITY_PER_LINE, available);

    await this.carts.addBundleLines(
      cartId,
      row.id,
      row.items.map((item) => {
        const line = existing.get(item.variant.id);

        return {
          lineId: line?.id,
          variantId: item.variant.id,
          quantity: item.quantity * bundles,
          // From the database, on the server, at this instant. Never from the request.
          priceAtAddIdr: item.variant.priceIdr,
        };
      }),
    );

    return this.view(actor);
  }

  /**
   * Changes one line's quantity, selection, or both (FR-CART-02, FR-CART-03).
   *
   * Choosing a quantity is choosing it at today's price, so a quantity change also records the
   * current price as the one the customer has now seen — which is what retires a "Price changed"
   * notice (FR-CART-04). Ticking a checkbox does not: selection says nothing about the price.
   */
  async updateItem(actor: Actor, lineId: string, update: CartLineUpdate): Promise<CartView> {
    const line = await this.requireLine(actor, lineId);

    // A bundle is one line to the customer, so a change to any component changes the group.
    if (line.bundleId !== null) return this.updateBundle(actor, line.bundleId, line.cartId, update);

    if (update.quantity !== undefined) {
      this.assertCanHold(line.productName, line.availableQuantity, update.quantity, {
        isSellable: line.isSellable,
        variantId: line.variantId,
      });
    }

    await this.carts.updateLine(line, {
      isSelected: update.isSelected,
      quantity: update.quantity,
      priceAtAddIdr: update.quantity === undefined ? undefined : line.priceIdr,
    });

    return this.view(actor);
  }

  /** "Select all" and its inverse (DESIGN.md §3.6). A cart that does not exist has nothing to select. */
  async setAllSelected(actor: Actor, isSelected: boolean): Promise<CartView> {
    const cartId = await this.carts.findId(actor);
    if (cartId !== null) await this.carts.setAllSelected(cartId, isSelected);

    return this.view(actor);
  }

  async removeItem(actor: Actor, lineId: string): Promise<CartView> {
    const line = await this.requireLine(actor, lineId);

    // Removing one component of a bundle removes the bundle. Leaving the rest behind would turn
    // a curated set into loose items still priced as though they were a set.
    if (line.bundleId !== null) await this.carts.deleteBundleGroup(line.cartId, line.bundleId);
    else await this.carts.deleteLine(line);

    return this.view(actor);
  }

  /** A quantity or selection change applied to a whole bundle group (FR-CAT-11). */
  private async updateBundle(
    actor: Actor,
    bundleId: string,
    cartId: string,
    update: CartLineUpdate,
  ): Promise<CartView> {
    if (update.isSelected !== undefined) {
      await this.carts.setBundleSelected(cartId, bundleId, update.isSelected);
    }

    if (update.quantity !== undefined) {
      const { row } = await this.bundles.componentsOfId(bundleId);
      const available = bundleAvailability(row);

      if (update.quantity > available) {
        throw new ConflictError(
          available === 0
            ? `${row.name} is not available right now.`
            : `Only ${available} of ${row.name} left.`,
          { bundleId, requested: update.quantity, availableQuantity: available },
        );
      }

      const existing = await this.carts.bundleLinesByVariant(cartId, bundleId);

      await this.carts.setBundleQuantities(
        cartId,
        row.items.flatMap((item) => {
          const line = existing.get(item.variant.id);
          return line === undefined ? [] : [{ id: line.id, quantity: item.quantity * update.quantity! }];
        }),
      );
    }

    return this.view(actor);
  }

  /** How many whole bundles the cart already holds of this group. */
  private bundlesHeld(
    row: { items: readonly { quantity: number; variant: { id: string } }[] },
    existing: ReadonlyMap<string, ExistingLine>,
  ): number {
    if (existing.size === 0) return 0;

    const counts = row.items.map((item) => {
      const line = existing.get(item.variant.id);
      return line === undefined ? 0 : Math.floor(line.quantity / Math.max(1, item.quantity));
    });

    return Math.min(...counts);
  }

  /**
   * "Delete" in the selection bar (DESIGN.md §3.6): removes the lines that are ticked.
   *
   * Ticked as the customer sees it — selected *and* purchasable. An out-of-stock line renders
   * with its checkbox removed, so a stale `is_selected` flag on it is not something the customer
   * chose to delete, and deleting it would be deleting a shortlist entry they cannot see ticked.
   */
  async removeSelected(actor: Actor): Promise<CartView> {
    const row = await this.carts.find(actor);
    if (row === null) return emptyCart();

    const doomed = countedLines(toCartLines(row.items)).map((line) => line.id);
    if (doomed.length > 0) await this.carts.deleteLines(row.id, doomed);

    return this.view(actor);
  }

  /**
   * Applies a voucher, or says precisely why it cannot be applied (FR-CART-06).
   *
   * A rejected code is not attached. That is different from a voucher that was valid when
   * applied and stops qualifying later — that one stays, marked, so reselecting a line can bring
   * it back (see `CartVoucher`). Applying a second code replaces the first: one per order
   * (FR-PROMO-05).
   */
  async applyVoucher(actor: Actor, code: string): Promise<CartView> {
    const terms = await this.vouchers.findByCode(code);
    if (terms === null) throw new VoucherRejectedError(code, { reason: 'NOT_FOUND' });

    const row = await this.carts.find(actor);
    const basket: VoucherBasket =
      row === null ? { lines: [], shippingIdr: 0 } : (await this.priceLines(row)).basket;

    const evaluation = await this.vouchers.evaluate(terms, actor, basket);
    if (!evaluation.isValid) throw new VoucherRejectedError(terms.code, evaluation.rejection);

    // Unreachable in practice — an absent cart is an empty basket, which the rules reject — but
    // the type system cannot know that, and a guard is cheaper than an assertion.
    if (row === null) throw new VoucherRejectedError(terms.code, { reason: 'NOTHING_SELECTED' });

    await this.carts.setVoucher(row.id, terms.id);
    return this.view(actor);
  }

  async removeVoucher(actor: Actor): Promise<CartView> {
    const cartId = await this.carts.findId(actor);
    if (cartId !== null) await this.carts.setVoucher(cartId, null);

    return this.view(actor);
  }

  /** Prices a cart row from scratch: lines, shipping estimate, voucher, totals. */
  private async build(actor: Actor, row: CartRow | null): Promise<CartView> {
    if (row === null) return emptyCart();

    const { lines, shippingEstimate, shippingIdr, basket } = await this.priceLines(row);

    return toCartView({
      id: row.id,
      lines,
      shippingEstimate,
      shippingIdr,
      voucher: await this.attachedVoucher(actor, row.voucherId, basket),
    });
  }

  private async priceLines(row: CartRow): Promise<PricedLines> {
    const lines = toCartLines(row.items);
    const shippingEstimate = await this.shipping.estimate();
    // Nothing selected, nothing to ship.
    const shippingIdr = countedLines(lines).length === 0 ? 0 : (shippingEstimate?.priceIdr ?? 0);

    return { lines, shippingEstimate, shippingIdr, basket: toVoucherBasket(row.items, lines, shippingIdr) };
  }

  /**
   * The voucher on the cart, re-checked against the cart as it is now. A voucher deleted by an
   * operator detaches itself through the foreign key, so a missing one is simply no voucher.
   */
  private async attachedVoucher(
    actor: Actor,
    voucherId: string | null,
    basket: VoucherBasket,
  ): Promise<CartVoucher | null> {
    if (voucherId === null) return null;

    const terms = await this.vouchers.findById(voucherId);
    if (terms === null) return null;

    return toCartVoucher(terms, await this.vouchers.evaluate(terms, actor, basket));
  }

  private async requireLine(actor: Actor, lineId: string): Promise<OwnedLine> {
    const line = await this.carts.findOwnedLine(actor, lineId);

    // Not found whether the line is gone or belongs to someone else — the second must be
    // indistinguishable from the first, or the endpoint confirms which ids exist.
    if (line === null) throw new NotFoundError('That item is no longer in your cart.', { lineId });

    return line;
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

      this.assertCanHold(variant.productName, variant.availableQuantity, quantity, {
        isSellable: true,
        variantId,
      });
    }
  }

  /**
   * Whether a line may hold `quantity` of something. One rule for adding and for editing, so the
   * product page and the cart page cannot disagree about what "too many" means.
   */
  private assertCanHold(
    productName: string,
    availableQuantity: number,
    quantity: number,
    context: { isSellable: boolean; variantId: string },
  ): void {
    if (!context.isSellable) {
      throw new ConflictError(`${productName} is no longer available.`, { variantId: context.variantId });
    }

    if (availableQuantity <= 0) {
      throw new ConflictError(`${productName} is out of stock.`, {
        variantId: context.variantId,
        availableQuantity: 0,
      });
    }

    if (quantity > availableQuantity) {
      throw new ConflictError(`Only ${availableQuantity} of ${productName} left.`, {
        variantId: context.variantId,
        requested: quantity,
        availableQuantity,
      });
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
    existing: ReadonlyMap<string, ExistingLine>,
  ): PricedLine[] {
    const lines: PricedLine[] = [];

    for (const [variantId, quantity] of wanted) {
      const variant = variants.get(variantId);
      if (variant === undefined) continue;

      const line = existing.get(variantId);
      const total = (line?.quantity ?? 0) + quantity;

      lines.push({
        lineId: line?.id,
        variantId,
        quantity: Math.min(total, MAX_QUANTITY_PER_LINE, variant.availableQuantity),
        // From the database, on the server, at this instant. Never from the request.
        priceAtAddIdr: variant.priceIdr,
      });
    }

    return lines;
  }
}
