import { Injectable } from '@nestjs/common';
import type { Actor, PaymentStatus } from '@gunsnip/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { queryBasket } from './basket.query.js';
import type { Basket } from './entities/basket.entity.js';
import { OrderUnit } from './order-unit.js';

/**
 * All Prisma access for orders (CLAUDE.md): the reads, and the door into a write transaction.
 */

/**
 * Generous for a handful of row locks and inserts, and a bound nonetheless: a transaction that
 * holds variant locks for longer than this is stuck, and every checkout for those kits is stuck
 * behind it.
 */
const TRANSACTION_TIMEOUT_MS = 10_000;

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  sessionId: true,
  userId: true,
  status: true,
  customerSnapshot: true,
  customerNote: true,
  internalNote: true,
  cancelReason: true,
  shippingTier: true,
  shippingMinDays: true,
  shippingMaxDays: true,
  subtotalIdr: true,
  discountIdr: true,
  shippingIdr: true,
  totalIdr: true,
  placedAt: true,
  items: {
    select: {
      id: true,
      bundleNameSnapshot: true,
      productNameSnapshot: true,
      variantNameSnapshot: true,
      skuSnapshot: true,
      imageUrlSnapshot: true,
      productSlugSnapshot: true,
      unitPriceIdr: true,
      quantity: true,
      lineTotalIdr: true,
    },
    // Order lines have no position; by name is at least the same order on every read.
    orderBy: [{ productNameSnapshot: 'asc' }, { id: 'asc' }],
  },
  events: {
    // `actorKind`/`actorId` are selected for the whole application and dropped by
    // `toOrderView` — the customer's timeline must not say which session cancelled their order.
    // The admin mapper keeps them (FR-ORD-06).
    select: { toStatus: true, note: true, createdAt: true, actorKind: true, actorId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  shipment: {
    select: { courier: true, trackingNumber: true, estimatedDays: true, shippedAt: true, deliveredAt: true },
  },
  payment: {
    select: { method: true, status: true, amountIdr: true, expiresAt: true, providerRef: true, instructions: true },
  },
  redemption: { select: { voucher: { select: { code: true } } } },
} satisfies Prisma.OrderSelect;

export type OrderRecord = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

const PAYMENT_SELECT = {
  id: true,
  orderId: true,
  status: true,
  amountIdr: true,
  providerRef: true,
  order: { select: { orderNumber: true } },
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

/** A payment identified for settlement, and the order it belongs to. */
export interface PaymentSummary {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  status: PaymentStatus;
  amountIdr: number;
  providerRef: string | null;
}

const ADMIN_LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  customerSnapshot: true,
  totalIdr: true,
  placedAt: true,
  payment: { select: { status: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

export type AdminOrderRow = Prisma.OrderGetPayload<{ select: typeof ADMIN_LIST_SELECT }>;

export interface IdempotencyRecord {
  sessionId: string;
  requestHash: string;
  orderNumber: string | null;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs `work` in one database transaction (CLAUDE.md non-negotiable #7). Anything it throws —
   * a domain error from a rule checked mid-way included — rolls every write back.
   */
  async transaction<T>(work: (unit: OrderUnit) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(new OrderUnit(tx)), { timeout: TRANSACTION_TIMEOUT_MS });
  }

  /** The basket for a quote: current, unlocked. An order reads it again, locked, in its transaction. */
  async readBasket(actor: Actor): Promise<Basket | null> {
    return queryBasket(this.prisma, actor, { lockVoucher: false });
  }

  async findByNumber(orderNumber: string): Promise<OrderRecord | null> {
    return this.prisma.order.findUnique({ where: { orderNumber }, select: ORDER_SELECT });
  }

  async findPayment(paymentId: string): Promise<PaymentSummary | null> {
    return this.toSummary(await this.prisma.payment.findUnique({ where: { id: paymentId }, select: PAYMENT_SELECT }));
  }

  async findPaymentByOrderNumber(orderNumber: string): Promise<PaymentSummary | null> {
    return this.toSummary(
      await this.prisma.payment.findFirst({ where: { order: { orderNumber } }, select: PAYMENT_SELECT }),
    );
  }

  /**
   * Pending payments whose window has closed, oldest first (FR-PAY-06).
   *
   * The order's status is part of the query, not a check afterwards: a payment left PENDING on an
   * order somebody already cancelled has nothing to expire, and taking it would only produce an
   * illegal transition for the sweep to swallow. `take` bounds one pass — the next tick picks up
   * whatever a backlog leaves behind.
   */
  async findDuePayments(now: Date, limit: number): Promise<PaymentSummary[]> {
    const rows = await this.prisma.payment.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now }, order: { status: 'PENDING_PAYMENT' } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
      select: PAYMENT_SELECT,
    });

    return rows.map((row) => this.requireSummary(row));
  }

  private toSummary(row: PaymentRow | null): PaymentSummary | null {
    return row === null ? null : this.requireSummary(row);
  }

  private requireSummary(row: PaymentRow): PaymentSummary {
    return {
      paymentId: row.id,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      status: row.status,
      amountIdr: row.amountIdr,
      providerRef: row.providerRef,
    };
  }

  // ------------------------------------------------------------------- back office (FR-ADM-07)

  /**
   * A page of orders for the operator, newest first, one row past the page so the cursor can be
   * trusted (`toCursorPage`).
   */
  async listAdmin(where: Prisma.OrderWhereInput, take: number): Promise<AdminOrderRow[]> {
    return this.prisma.order.findMany({
      where,
      orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
      take,
      select: ADMIN_LIST_SELECT,
    });
  }

  /**
   * Sets or replaces the shipment record (FR-ADM-08).
   *
   * Upsert, because a courier can be chosen before dispatch and a tracking number typed in
   * afterwards, and neither order of events should need a different endpoint. `estimatedDays` is
   * seeded from the window quoted at checkout so the record starts out agreeing with the promise
   * already made to the customer (FR-CO-09).
   */
  async setShipment(
    orderId: string,
    shipment: { courier: string; trackingNumber: string | null; estimatedDays: number },
  ): Promise<void> {
    await this.prisma.shipment.upsert({
      where: { orderId },
      create: { orderId, ...shipment },
      update: { courier: shipment.courier, trackingNumber: shipment.trackingNumber },
    });
  }

  async setInternalNote(orderId: string, internalNote: string | null): Promise<void> {
    await this.prisma.order.update({ where: { id: orderId }, data: { internalNote } });
  }

  /** Stamps the shipment's own dates alongside the order's status change (FR-ADM-08). */
  async stampShipment(orderId: string, dates: { shippedAt?: Date; deliveredAt?: Date }): Promise<void> {
    await this.prisma.shipment.updateMany({ where: { orderId }, data: dates });
  }

  async findIdempotencyKey(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: { scope_key: { scope, key } },
      select: { sessionId: true, requestHash: true, order: { select: { orderNumber: true } } },
    });

    return row === null
      ? null
      : { sessionId: row.sessionId, requestHash: row.requestHash, orderNumber: row.order?.orderNumber ?? null };
  }
}
