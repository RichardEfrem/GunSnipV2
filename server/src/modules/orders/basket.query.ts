import { actorScope, type Actor } from '@gunsnip/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { VOUCHER_TERMS_SELECT, toVoucherTerms } from '../vouchers/voucher-terms.query.js';
import type { Basket, BasketLine, BasketVoucher } from './entities/basket.entity.js';

/**
 * Reads the actor's basket — the selected cart lines and the cart's voucher — through any Prisma
 * handle: the plain client for a quote, a transaction for an order.
 *
 * One query for both, so the checkout summary and the order are read the same way. What differs
 * is only whether the voucher row is locked first: an order does, so the usage limit it checks
 * cannot be spent by a concurrent order before this one commits (FR-PROMO-02).
 *
 * Repository-layer code (CLAUDE.md): only `OrderRepository` and `OrderUnit` call it.
 */
const LINE_SELECT = {
  id: true,
  quantity: true,
  priceAtAddIdr: true,
  variant: {
    select: {
      id: true,
      sku: true,
      name: true,
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

type LineRow = Prisma.CartItemGetPayload<{ select: typeof LINE_SELECT }>;

export async function queryBasket(
  db: Prisma.TransactionClient,
  actor: Actor,
  options: { lockVoucher: boolean },
): Promise<Basket | null> {
  const cart = await db.cart.findFirst({
    where: actorScope(actor),
    // The cart the actor has been using — the same choice `CartRepository.find` makes.
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      voucherId: true,
      items: {
        // Only what the customer ticked is headed for checkout (FR-CART-03).
        where: { isSelected: true },
        select: LINE_SELECT,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (cart === null) return null;

  return {
    cartId: cart.id,
    lines: cart.items.map(toBasketLine),
    voucher: cart.voucherId === null ? null : await queryVoucher(db, cart.voucherId, actor, options.lockVoucher),
  };
}

async function queryVoucher(
  db: Prisma.TransactionClient,
  voucherId: string,
  actor: Actor,
  lock: boolean,
): Promise<BasketVoucher | null> {
  if (lock) {
    await db.$queryRaw`SELECT id FROM voucher WHERE id = ${voucherId}::uuid FOR UPDATE`;
  }

  const row = await db.voucher.findUnique({ where: { id: voucherId }, select: VOUCHER_TERMS_SELECT });
  // Deleted by an operator between the cart read and now: the cart simply has no voucher.
  if (row === null) return null;

  const terms = toVoucherTerms(row);
  // Counted only when there is a limit to count against, as `VoucherService.evaluate` does.
  const sessionRedemptions =
    terms.perSessionLimit === null
      ? 0
      : await db.voucherRedemption.count({ where: { voucherId, ...actorScope(actor) } });

  return { terms, sessionRedemptions };
}

function toBasketLine(row: LineRow): BasketLine {
  const { variant } = row;
  const { product } = variant;
  const image = product.images[0];

  return {
    cartLineId: row.id,
    requestedQuantity: row.quantity,
    priceAtAddIdr: row.priceAtAddIdr,

    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.name,
    unitPriceIdr: variant.priceIdr,
    stockOnHand: variant.stockOnHand,
    stockReserved: variant.stockReserved,
    isSellable: !variant.isArchived && product.status === 'PUBLISHED',

    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    categoryIds: [product.category.id, product.category.parentId].filter((id): id is string => id !== null),
    image: image === undefined ? null : { url: image.url, alt: image.alt, blurDataUrl: image.blurDataUrl },
  };
}
