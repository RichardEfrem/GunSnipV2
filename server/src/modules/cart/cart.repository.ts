import { Injectable } from '@nestjs/common';
import { actorScope, type Actor } from '@gunsnip/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * All Prisma access for the cart aggregate (CLAUDE.md).
 *
 * The cart is found by `ActorScope` — `user_id` when there is one, `session_id` otherwise
 * (PRD §11.1). No method here takes a `userId`, so Phase 1's guest-cart adoption is a change to
 * the guard that resolves the actor and nothing else.
 *
 * Every line-level method takes the actor too, or a line already found through one. A line id
 * alone proves nothing: it is a UUID in a URL, and one session must never be able to edit
 * another's cart by guessing or replaying it.
 */

/** Everything a cart line renders, priced from the variant rather than from the line. */
const LINE_SELECT = {
  id: true,
  quantity: true,
  isSelected: true,
  priceAtAddIdr: true,
  // Null for an ordinary line. When set, the view groups this row with its siblings into the
  // single line the customer chose (FR-CAT-11), priced at the bundle's own price.
  //
  // `items` comes along because the group's price has to be *allocated* across its components
  // (`bundle-allocation.ts`), and that needs each component's per-bundle quantity — the cart row
  // holds `perBundleQuantity × bundles`, which on its own cannot be separated back into the two.
  bundle: {
    select: {
      id: true,
      slug: true,
      name: true,
      priceIdr: true,
      items: { select: { variantId: true, quantity: true } },
    },
  },
  variant: {
    select: {
      id: true,
      sku: true,
      name: true,
      optionValues: true,
      priceIdr: true,
      stockOnHand: true,
      stockReserved: true,
      isArchived: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          // Voucher scope matches on the product's category and its parent (FR-PROMO-02).
          category: { select: { id: true, parentId: true } },
          images: {
            where: { isPrimary: true },
            select: { url: true, alt: true, blurDataUrl: true },
            take: 1,
          },
        },
      },
    },
  },
} satisfies Prisma.CartItemSelect;

const CART_SELECT = {
  id: true,
  voucherId: true,
  // `id` breaks the tie: every line from one "Add selected" shares a `created_at`, and without a
  // second key Postgres may return them in a different order on each read — lines that swap
  // places under the customer's cursor after every refresh.
  items: { select: LINE_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.CartSelect;

export type CartRow = Prisma.CartGetPayload<{ select: typeof CART_SELECT }>;
export type CartLineRow = CartRow['items'][number];

/** One thing to add: which variant, how many. */
export interface AddLine {
  variantId: string;
  quantity: number;
}

/** A variant as the service needs it to decide whether a quantity of it may be held. */
export interface SellableVariant {
  id: string;
  priceIdr: number;
  availableQuantity: number;
  productName: string;
}

/** A line the actor owns, with just enough of its variant to validate a change to it. */
export interface OwnedLine {
  id: string;
  cartId: string;
  /** Set when the line is part of a bundle group — quantity and removal act on the whole group. */
  bundleId: string | null;
  variantId: string;
  priceIdr: number;
  availableQuantity: number;
  /** False for an archived variant or an unpublished product. */
  isSellable: boolean;
  productName: string;
}

/** A change to one line. Absent fields are left as they are. */
export interface LineChange {
  quantity?: number;
  isSelected?: boolean;
  priceAtAddIdr?: number;
}

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The actor's cart, or null when they have never added anything. */
  async find(actor: Actor): Promise<CartRow | null> {
    return this.prisma.cart.findFirst({
      where: actorScope(actor),
      select: CART_SELECT,
      // A session that somehow acquired two carts reads the one it has been using.
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** The actor's cart id without its lines, or null when there is no cart. */
  async findId(actor: Actor): Promise<string | null> {
    const cart = await this.prisma.cart.findFirst({
      where: actorScope(actor),
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });

    return cart?.id ?? null;
  }

  /**
   * The actor's cart id, creating the row when this is their first add.
   *
   * Separate from `find` because reading a cart must never write one: a crawler hitting
   * `GET /cart` should not leave a row behind, and only an add has earned one.
   */
  async ensure(actor: Actor): Promise<string> {
    const existing = await this.findId(actor);
    if (existing !== null) return existing;

    const scope = actorScope(actor);

    return (
      await this.prisma.cart.create({
        // `session_id` is NOT NULL from the first migration and `user_id` is nullable beside it
        // (PRD §11.1), so a user's cart still carries the session that created it.
        data: { sessionId: scope.sessionId ?? actor.sessionId, userId: scope.userId ?? null },
        select: { id: true },
      })
    ).id;
  }

  /** The variants being added, with availability derived the same way the catalogue derives it. */
  async findSellableVariants(variantIds: readonly string[]): Promise<Map<string, SellableVariant>> {
    const rows = await this.prisma.productVariant.findMany({
      where: {
        id: { in: [...variantIds] },
        isArchived: false,
        // A draft product's variant is not buyable, however the id was obtained.
        product: { status: 'PUBLISHED' },
      },
      select: {
        id: true,
        priceIdr: true,
        stockOnHand: true,
        stockReserved: true,
        product: { select: { name: true } },
      },
    });

    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          priceIdr: row.priceIdr,
          availableQuantity: Math.max(0, row.stockOnHand - row.stockReserved),
          productName: row.product.name,
        },
      ]),
    );
  }

  /**
   * Adds every line in one transaction (CLAUDE.md non-negotiable #7).
   *
   * "Add selected" is one action to the customer (FR-PDP-08), so it has to be one action to the
   * database: a nipper that lands while the panel liner fails would leave the customer with a
   * half-filled cart and no way to tell which half.
   *
   * A line the service matched to one already in the cart is updated by id; the rest are created.
   * Not an upsert, because the uniqueness that makes a standalone line unique is a *partial*
   * index — `(cart_id, variant_id) WHERE bundle_id IS NULL` — and a partial index cannot be a
   * Prisma compound key. The service has already resolved which is which, so nothing is guessed
   * here. `quantity` arrives pre-clamped, so every value written is already known to be legal.
   *
   * `price_at_add_idr` is deliberately not refreshed on an update: it records what the customer
   * was shown when they first added the line, which is what FR-CART-04 compares against.
   */
  async addLines(cartId: string, lines: readonly PricedLine[]): Promise<void> {
    await this.prisma.$transaction([
      ...lines.map((line) =>
        line.lineId === undefined
          ? this.prisma.cartItem.create({
              data: {
                cartId,
                variantId: line.variantId,
                quantity: line.quantity,
                priceAtAddIdr: line.priceAtAddIdr,
              },
            })
          : this.prisma.cartItem.update({
              where: { id: line.lineId },
              data: { quantity: line.quantity },
            }),
      ),
      this.touch(cartId),
    ]);
  }

  /**
   * Adds a bundle's components as one group (FR-CAT-11), in one transaction.
   *
   * Always created, never folded into existing lines: a bundle is a thing the customer chose as
   * a unit, and merging its nipper into the loose nipper already in the cart would make the
   * bundle unremovable as a unit and its price unattributable. Adding the same bundle again
   * raises the quantity of the group it is already in, which the service resolves before calling.
   */
  async addBundleLines(cartId: string, bundleId: string, lines: readonly PricedLine[]): Promise<void> {
    await this.prisma.$transaction([
      ...lines.map((line) =>
        line.lineId === undefined
          ? this.prisma.cartItem.create({
              data: {
                cartId,
                bundleId,
                variantId: line.variantId,
                quantity: line.quantity,
                priceAtAddIdr: line.priceAtAddIdr,
              },
            })
          : this.prisma.cartItem.update({
              where: { id: line.lineId },
              data: { quantity: line.quantity },
            }),
      ),
      this.touch(cartId),
    ]);
  }

  /**
   * The cart's **standalone** lines by variant, so an add can be folded onto what is already
   * there. Bundled lines are excluded deliberately: adding a loose nipper must not silently
   * raise the quantity of the nipper inside a starter bundle.
   */
  async standaloneLinesByVariant(cartId: string): Promise<Map<string, ExistingLine>> {
    const rows = await this.prisma.cartItem.findMany({
      where: { cartId, bundleId: null },
      select: { id: true, variantId: true, quantity: true },
    });

    return new Map(rows.map((row) => [row.variantId, { id: row.id, quantity: row.quantity }]));
  }

  /** The lines of one bundle group already in this cart, by variant. */
  async bundleLinesByVariant(cartId: string, bundleId: string): Promise<Map<string, ExistingLine>> {
    const rows = await this.prisma.cartItem.findMany({
      where: { cartId, bundleId },
      select: { id: true, variantId: true, quantity: true },
    });

    return new Map(rows.map((row) => [row.variantId, { id: row.id, quantity: row.quantity }]));
  }

  /** One line, only if it is in a cart this actor owns. */
  async findOwnedLine(actor: Actor, lineId: string): Promise<OwnedLine | null> {
    const row = await this.prisma.cartItem.findFirst({
      where: { id: lineId, cart: actorScope(actor) },
      select: {
        id: true,
        cartId: true,
        bundleId: true,
        variant: {
          select: {
            id: true,
            priceIdr: true,
            stockOnHand: true,
            stockReserved: true,
            isArchived: true,
            product: { select: { name: true, status: true } },
          },
        },
      },
    });

    if (row === null) return null;

    const { variant } = row;

    return {
      id: row.id,
      cartId: row.cartId,
      bundleId: row.bundleId,
      variantId: variant.id,
      priceIdr: variant.priceIdr,
      availableQuantity: Math.max(0, variant.stockOnHand - variant.stockReserved),
      isSellable: !variant.isArchived && variant.product.status === 'PUBLISHED',
      productName: variant.product.name,
    };
  }

  async updateLine(line: OwnedLine, change: LineChange): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cartItem.update({ where: { id: line.id }, data: change }),
      this.touch(line.cartId),
    ]);
  }

  /**
   * Rewrites a bundle group's line quantities together (FR-CAT-11).
   *
   * The group is one line to the customer, so its quantity changes as one: every component row
   * moves to `perBundleQuantity × bundles` in a single transaction, or none of them does. A
   * partial write would leave a group that no longer represents a whole number of bundles.
   */
  async setBundleQuantities(cartId: string, lines: readonly { id: string; quantity: number }[]): Promise<void> {
    await this.prisma.$transaction([
      ...lines.map((line) =>
        this.prisma.cartItem.update({ where: { id: line.id }, data: { quantity: line.quantity } }),
      ),
      this.touch(cartId),
    ]);
  }

  /** Selecting or deselecting a bundle acts on all of its components at once (FR-CART-03). */
  async setBundleSelected(cartId: string, bundleId: string, isSelected: boolean): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cartItem.updateMany({ where: { cartId, bundleId }, data: { isSelected } }),
      this.touch(cartId),
    ]);
  }

  /** Removing a bundle removes every component it put in the cart, and only those. */
  async deleteBundleGroup(cartId: string, bundleId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId, bundleId } }),
      this.touch(cartId),
    ]);
  }

  /** "Select all" and its inverse (DESIGN.md §3.6) — one statement, not one per line. */
  async setAllSelected(cartId: string, isSelected: boolean): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cartItem.updateMany({ where: { cartId }, data: { isSelected } }),
      this.touch(cartId),
    ]);
  }

  async deleteLine(line: OwnedLine): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cartItem.delete({ where: { id: line.id } }),
      this.touch(line.cartId),
    ]);
  }

  /** Deletes the named lines, scoped to the cart so an id from elsewhere is simply not matched. */
  async deleteLines(cartId: string, lineIds: readonly string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId, id: { in: [...lineIds] } } }),
      this.touch(cartId),
    ]);
  }

  /** Attaches a voucher, replacing any other — one per order (FR-PROMO-05). Null detaches. */
  async setVoucher(cartId: string, voucherId: string | null): Promise<void> {
    await this.prisma.cart.update({ where: { id: cartId }, data: { voucherId } });
  }

  /**
   * Bumps `updatedAt` so this cart orders ahead of any stale sibling row. Returned as a query
   * rather than run, so every caller can put it in the same transaction as its line write.
   */
  private touch(cartId: string) {
    return this.prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  }
}

/** A line the service has already validated, clamped and priced. */
export interface PricedLine {
  /** The row to raise, when this variant is already in the cart. Undefined creates a new line. */
  lineId?: string;
  variantId: string;
  quantity: number;
  priceAtAddIdr: number;
}

/** A line already in the cart, as the service needs it to fold an add onto it. */
export interface ExistingLine {
  id: string;
  quantity: number;
}
