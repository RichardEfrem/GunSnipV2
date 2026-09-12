import type { Actor, OrderStatus, PaymentStatus } from '@gunsnip/shared';
import { Prisma } from '../../generated/prisma/client.js';
import type { StockLevel } from '../inventory/stock-reservation.js';
import type { AuditActor } from './audit-actor.js';
import { queryBasket } from './basket.query.js';
import type { Basket } from './entities/basket.entity.js';
import type { OrderDraft } from './entities/order-draft.entity.js';
import type { PaymentEvent } from '../payments/provider/payment-provider.js';

/**
 * One order transaction's view of the database (CLAUDE.md non-negotiable #7, PRD §8.3).
 *
 * Handed to a service by `OrderRepository.transaction`, it exposes each step an order write needs
 * as a typed method — claim the key, lock the variants, read the basket, write the order — and
 * nothing else. The service calls them in order with the business rules in between, so the
 * algorithm reads top to bottom in the service while every Prisma call stays in this file.
 *
 * It is the one repository that writes across aggregates: order, variant stock, voucher usage,
 * idempotency key and cart. PRD §8.3 requires reservation and order creation to be *one*
 * transaction, and a repository per aggregate cannot share one without leaking the transaction
 * handle into the service.
 *
 * **Lock order is fixed** — idempotency key, then order row, then variant rows by id, then the
 * voucher row. Every transaction that takes more than one of these takes them in this order, so
 * two of them can wait on each other but never deadlock. A payment row is taken together with
 * its order in one statement (`lockPayment`) and never on its own, so it needs no rank of its
 * own: any two transactions touching the same payment already conflict at its order.
 */
export class OrderUnit {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  /**
   * Claims an `Idempotency-Key` for this request (FR-CO-07). False when the key is already taken.
   *
   * `skipDuplicates` compiles to `INSERT … ON CONFLICT DO NOTHING`, which is what makes a double
   * click safe: the second insert *waits* on the first transaction's uncommitted row, and once
   * the first commits it finds the key taken and inserts nothing — without an error that would
   * abort this transaction. If the first rolls back instead, the second claims the key and runs.
   */
  async claimIdempotencyKey(claim: {
    scope: string;
    key: string;
    sessionId: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const { count } = await this.tx.idempotencyKey.createMany({ data: [claim], skipDuplicates: true });
    return count === 1;
  }

  /**
   * `SELECT … FOR UPDATE` on the variant rows, in id order, and their stock as of the lock (PRD
   * §8.3). Held until the transaction ends, so no other order can reserve the same units between
   * this check and this write.
   */
  async lockVariants(variantIds: readonly string[]): Promise<Map<string, StockLevel>> {
    const ids = [...new Set(variantIds)].sort();
    if (ids.length === 0) return new Map();

    // `FOR UPDATE OF v` locks the variants only; the product row is read, not reserved. Postgres
    // applies the lock above the sort, so rows are locked in exactly the `ORDER BY` order.
    const rows = await this.tx.$queryRaw<
      { id: string; stock_on_hand: number; stock_reserved: number; product_name: string }[]
    >`
      SELECT v.id, v.stock_on_hand, v.stock_reserved, p.name AS product_name
      FROM product_variant v
      JOIN product p ON p.id = v.product_id
      WHERE v.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY v.id
      FOR UPDATE OF v
    `;

    return new Map(
      rows.map((row) => [
        row.id,
        {
          variantId: row.id,
          productName: row.product_name,
          stockOnHand: row.stock_on_hand,
          stockReserved: row.stock_reserved,
        },
      ]),
    );
  }

  /** The basket, read after the variant locks, with the voucher row locked too. */
  async readBasket(actor: Actor): Promise<Basket | null> {
    return queryBasket(this.tx, actor, { lockVoucher: true });
  }

  /**
   * The first candidate nobody has used. The unique index on `order_number` stands behind this
   * check; the check is what keeps a collision from aborting the whole order.
   */
  async freeOrderNumber(candidate: () => string, attempts = 5): Promise<string> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const orderNumber = candidate();
      const taken = await this.tx.order.findUnique({ where: { orderNumber }, select: { id: true } });
      if (taken === null) return orderNumber;
    }

    throw new Error(`No free order number after ${attempts} attempts — the day's number space is nearly full.`);
  }

  /**
   * Writes the order and everything created with it: lines, first event, payment, redemption.
   * Returns the payment's id as well, because the charge's `CHARGE_CREATED` event is logged
   * against it a moment later (FR-PAY-07).
   */
  async createOrder(draft: OrderDraft): Promise<{ orderId: string; paymentId: string }> {
    const order = await this.tx.order.create({
      data: {
        orderNumber: draft.orderNumber,
        sessionId: draft.sessionId,
        userId: draft.userId,
        status: 'PENDING_PAYMENT',
        customerSnapshot: draft.customerSnapshot,
        customerNote: draft.customerNote,
        shippingRegionId: draft.shippingRegionId,
        shippingTier: draft.shippingTier,
        shippingMinDays: draft.shippingMinDays,
        shippingMaxDays: draft.shippingMaxDays,
        subtotalIdr: draft.subtotalIdr,
        discountIdr: draft.discountIdr,
        shippingIdr: draft.shippingIdr,
        totalIdr: draft.totalIdr,
        placedAt: draft.placedAt,
        items: { create: [...draft.items] },
        events: {
          create: {
            fromStatus: null,
            toStatus: 'PENDING_PAYMENT',
            ...draft.placedBy,
            note: 'Order placed.',
            createdAt: draft.placedAt,
          },
        },
        payment: {
          create: {
            provider: draft.payment.provider,
            method: draft.payment.method,
            amountIdr: draft.payment.amountIdr,
            expiresAt: draft.payment.expiresAt,
            status: 'PENDING',
            providerRef: draft.payment.providerRef,
            instructions: { ...draft.payment.instructions },
          },
        },
        ...(draft.redemption === null
          ? {}
          : {
              redemption: {
                create: {
                  voucherId: draft.redemption.voucherId,
                  amountIdr: draft.redemption.amountIdr,
                  sessionId: draft.sessionId,
                  userId: draft.userId,
                },
              },
            }),
      },
      select: { id: true, payment: { select: { id: true } } },
    });

    // Created in the same statement as the order, so it cannot be absent — but the relation is
    // nullable in the schema, and a silent empty id would surface as a missing payment log.
    if (order.payment === null) throw new Error(`Order ${draft.orderNumber} was written without a payment row.`);

    return { orderId: order.id, paymentId: order.payment.id };
  }

  /** Writes back the levels the stock rules computed, in id order like the locks. */
  async writeStockLevels(levels: readonly StockLevel[]): Promise<void> {
    const sorted = [...levels].sort((a, b) => (a.variantId < b.variantId ? -1 : 1));

    for (const level of sorted) {
      await this.tx.productVariant.update({
        where: { id: level.variantId },
        data: { stockReserved: level.stockReserved },
      });
    }
  }

  async incrementVoucherUsage(voucherId: string): Promise<void> {
    await this.tx.voucher.update({ where: { id: voucherId }, data: { usedCount: { increment: 1 } } });
  }

  /** Records which order the key produced, so a repeat can be answered with it. */
  async attachOrderToKey(scope: string, key: string, orderId: string): Promise<void> {
    await this.tx.idempotencyKey.update({ where: { scope_key: { scope, key } }, data: { orderId } });
  }

  /** Takes ordered lines out of the cart, and the voucher with them when the order used it. */
  async clearOrderedLines(cartId: string, cartLineIds: readonly string[], detachVoucher: boolean): Promise<void> {
    await this.tx.cartItem.deleteMany({ where: { cartId, id: { in: [...cartLineIds] } } });
    await this.tx.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date(), ...(detachVoucher ? { voucherId: null } : {}) },
    });
  }

  /** Locks one order row and reads what a status change needs to know about it. */
  async lockOrder(orderId: string): Promise<LockedOrder> {
    await this.tx.$queryRaw`SELECT id FROM "order" WHERE id = ${orderId}::uuid FOR UPDATE`;

    const order = await this.tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        status: true,
        items: { select: { variantId: true, quantity: true } },
        redemption: { select: { voucherId: true } },
      },
    });

    return {
      status: order.status,
      // A variant deleted since purchase leaves `variant_id` null: there is nothing to release.
      items: order.items.flatMap((item) =>
        item.variantId === null ? [] : [{ variantId: item.variantId, quantity: item.quantity }],
      ),
      redeemedVoucherId: order.redemption?.voucherId ?? null,
    };
  }

  async changeStatus(orderId: string, change: StatusChange): Promise<void> {
    await this.tx.order.update({
      where: { id: orderId },
      data: {
        status: change.to,
        ...(change.cancelReason === undefined ? {} : { cancelReason: change.cancelReason }),
        ...(change.paidAt === undefined ? {} : { paidAt: change.paidAt }),
      },
    });

    await this.tx.orderEvent.create({
      data: {
        orderId,
        fromStatus: change.from,
        toStatus: change.to,
        actorKind: change.by.actorKind,
        actorId: change.by.actorId,
        note: change.note,
      },
    });
  }

  /**
   * Gives a cancelled order's voucher use back: the redemption row goes and the counter drops,
   * so the per-session and total limits count orders that happened, not orders that were tried.
   */
  async releaseVoucher(orderId: string, voucherId: string): Promise<void> {
    await this.tx.voucher.update({ where: { id: voucherId }, data: { usedCount: { decrement: 1 } } });
    await this.tx.voucherRedemption.delete({ where: { orderId } });
  }

  /**
   * Locks a payment and the order it belongs to, in one statement, and reads the payment as of
   * the lock. Null when the id names no payment.
   *
   * Both rows together because settling a payment writes both, and a payment is never written
   * without its order — so this is the only way either is taken and two settlements of the same
   * charge queue rather than interleave.
   */
  async lockPayment(paymentId: string): Promise<LockedPayment | null> {
    const rows = await this.tx.$queryRaw<
      { id: string; order_id: string; status: PaymentStatus; amount_idr: number; provider_ref: string | null }[]
    >`
      SELECT p.id, p.order_id, p.status, p.amount_idr, p.provider_ref
      FROM payment p
      JOIN "order" o ON o.id = p.order_id
      WHERE p.id = ${paymentId}::uuid
      FOR UPDATE OF o, p
    `;

    const row = rows[0];
    if (row === undefined) return null;

    return {
      paymentId: row.id,
      orderId: row.order_id,
      status: row.status,
      amountIdr: row.amount_idr,
      providerRef: row.provider_ref,
    };
  }

  /** Moves the payment to the status its state machine allowed, stamping `paid_at` with it. */
  async applyPaymentStatus(paymentId: string, to: PaymentStatus, at: Date): Promise<void> {
    await this.tx.payment.update({
      where: { id: paymentId },
      data: { status: to, ...(to === 'PAID' ? { paidAt: at } : {}) },
    });
  }

  /**
   * Appends the event to the payment's log, verbatim (FR-PAY-07). Written for every event, the
   * ones that change nothing included: the log is the record of what the provider said, not of
   * what we did about it.
   */
  async recordPaymentEvent(paymentId: string, event: PaymentEvent): Promise<void> {
    await this.tx.paymentEvent.create({
      data: {
        paymentId,
        type: event.type,
        payload: { ...event.payload },
        createdAt: event.occurredAt,
      },
    });
  }
}

export interface LockedOrder {
  status: OrderStatus;
  items: readonly { variantId: string; quantity: number }[];
  redeemedVoucherId: string | null;
}

/** One status change and the `order_event` row that records it (FR-ORD-06). */
export interface StatusChange {
  from: OrderStatus;
  to: OrderStatus;
  by: AuditActor;
  note: string;
  cancelReason?: string;
  /** Set when the change is the payment settling, so `paid_at` and the status move together. */
  paidAt?: Date;
}

/** A payment row read under its order's lock, and what settling it needs to know. */
export interface LockedPayment {
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  amountIdr: number;
  providerRef: string | null;
}
