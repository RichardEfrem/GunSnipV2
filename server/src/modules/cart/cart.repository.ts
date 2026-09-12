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
   * Each line is an upsert on `(cart_id, variant_id)` — adding a tool already in the cart
   * raises its quantity rather than creating a second row for the same thing. `quantity` is
   * pre-clamped by the service, so the value written is already known to be legal.
   */
  async addLines(cartId: string, lines: readonly PricedLine[]): Promise<void> {
    await this.prisma.$transaction([
      ...lines.map((line) =>
        this.prisma.cartItem.upsert({
          where: { cartId_variantId: { cartId, variantId: line.variantId } },
          create: {
            cartId,
            variantId: line.variantId,
            quantity: line.quantity,
            priceAtAddIdr: line.priceAtAddIdr,
          },
          // `price_at_add_idr` is deliberately not refreshed: it records what the customer was
          // shown when they first added the line, which is what FR-CART-04 compares against.
          update: { quantity: line.quantity },
        }),
      ),
      this.touch(cartId),
    ]);
  }

  /** Current quantities by variant, so an add can be folded onto what is already there. */
  async quantitiesByVariant(cartId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.cartItem.findMany({
      where: { cartId },
      select: { variantId: true, quantity: true },
    });

    return new Map(rows.map((row) => [row.variantId, row.quantity]));
  }

  /** One line, only if it is in a cart this actor owns. */
  async findOwnedLine(actor: Actor, lineId: string): Promise<OwnedLine | null> {
    const row = await this.prisma.cartItem.findFirst({
      where: { id: lineId, cart: actorScope(actor) },
      select: {
        id: true,
        cartId: true,
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
  variantId: string;
  quantity: number;
  priceAtAddIdr: number;
}
