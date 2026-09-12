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
    select: { toStatus: true, note: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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
