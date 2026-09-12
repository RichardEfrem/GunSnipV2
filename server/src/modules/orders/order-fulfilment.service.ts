import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { type CursorPage, toCursorPage } from '../../common/pagination/cursor-page.js';
import { decodeCursor, encodeCursor } from '../../common/pagination/keyset-cursor.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OrderMailService } from '../notifications/order-mail.service.js';
import { toAdminOrderSummary, toAdminOrderView } from './admin-order-mapper.js';
import { ADMIN_AUDIT } from './audit-actor.js';
import type {
  AdvanceOrderDto,
  CancelOrderDto,
  SetInternalNoteDto,
  SetShipmentDto,
} from './dto/fulfil-order.dto.js';
import {
  DEFAULT_ADMIN_ORDER_PAGE_SIZE,
  type ListAdminOrdersDto,
} from './dto/list-admin-orders.dto.js';
import type { AdminOrderSummary, AdminOrderView } from './entities/admin-order.entity.js';
import { FULFILMENT_EFFECTS } from './fulfilment-effects.js';
import { assertOrderTransition } from './order-status-machine.js';
import { transitionOrder } from './order-transition.js';
import { OrderRepository, type OrderRecord } from './order.repository.js';

/**
 * Order fulfilment for the back office (FR-ADM-07, FR-ADM-08).
 *
 * Knows two things and defers everything else: **which moves are legal** is
 * `ORDER_TRANSITIONS`, and **what a move costs** is `FULFILMENT_EFFECTS`. Both are tables in
 * their own files, so this service contains no `if (status === …)` — CLAUDE.md forbids it, and
 * the reason is visible here: the difference between shipping an order and completing one is a
 * row in a table, not a branch someone has to remember to add.
 *
 * Every status change goes through the same `transitionOrder` the storefront's cancel button and
 * the expiry sweep use, so an operator advancing an order and a customer cancelling one settle
 * stock and vouchers by the identical code.
 */
@Injectable()
export class OrderFulfilmentService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly mail: OrderMailService,
  ) {}

  async list(query: ListAdminOrdersDto): Promise<CursorPage<AdminOrderSummary>> {
    const limit = query.limit ?? DEFAULT_ADMIN_ORDER_PAGE_SIZE;
    const rows = await this.orders.listAdmin(this.listWhere(query), limit + 1);

    return toCursorPage(rows.map(toAdminOrderSummary), limit, (row) =>
      encodeCursor({ at: new Date(row.placedAt), id: row.orderNumber }),
    );
  }

  async detail(orderNumber: string): Promise<AdminOrderView> {
    return toAdminOrderView(await this.require(orderNumber));
  }

  /**
   * Moves an order forward (FR-ADM-08).
   *
   * The legality check happens inside the transaction, under the order's lock, so an operator
   * advancing an order at the same moment the expiry sweep cancels it loses cleanly rather than
   * shipping something that was just cancelled.
   */
  async advance(orderNumber: string, dto: AdvanceOrderDto): Promise<AdminOrderView> {
    const record = await this.require(orderNumber);
    const effect = FULFILMENT_EFFECTS[dto.status];

    if (effect.operatorPath !== 'advance') {
      throw new ConflictError(effect.wrongPathMessage ?? 'That status cannot be set from here.', {
        status: dto.status,
      });
    }

    // Asked here as well as inside the transaction, so an operator requesting a move the
    // lifecycle forbids is told *that* rather than being told to add a courier for a dispatch
    // that could never have happened. The transactional check under the order's lock is still
    // the one that governs; this only decides which message is the useful one.
    assertOrderTransition(record.status, dto.status);

    if (effect.requiresShipment === true && record.shipment === null) {
      throw new ConflictError('Add the courier before marking this shipped — there is nowhere to track it.', {
        orderNumber,
      });
    }

    const now = new Date();

    await this.orders.transaction(async (unit) => {
      await transitionOrder(unit, record.id, {
        to: dto.status,
        by: ADMIN_AUDIT,
        note: dto.note ?? effect.note,
        stock: effect.stock,
        deliveredAt: effect.stampsDeliveredAt === true ? now : undefined,
      });
    });

    // The shipment's own dates, outside the order transaction: they are a record of what
    // happened, not part of the rule that decided it, and a failure here must not roll back a
    // dispatch that already consumed stock.
    if (effect.stampsShippedAt === true) await this.orders.stampShipment(record.id, { shippedAt: now });
    if (effect.stampsDeliveredAt === true) await this.orders.stampShipment(record.id, { deliveredAt: now });

    // After the commit, never inside it: a mail server that is down must not roll back a
    // dispatch that physically happened (FR-NOTIF-01). Which statuses are worth a mail is
    // `ORDER_MAIL`'s decision, not this one's — it reports what changed.
    await this.mail.notify(record.id, dto.status);

    return this.detail(orderNumber);
  }

  /** Operator cancellation (FR-ADM-08). Separate from `advance` because the reason is required. */
  async cancel(orderNumber: string, dto: CancelOrderDto): Promise<AdminOrderView> {
    const record = await this.require(orderNumber);

    await this.orders.transaction(async (unit) => {
      await transitionOrder(unit, record.id, {
        to: 'CANCELLED',
        by: ADMIN_AUDIT,
        note: `Cancelled by the shop: ${dto.reason}`,
        cancelReason: dto.reason,
        stock: FULFILMENT_EFFECTS.CANCELLED.stock,
      });
    });

    return this.detail(orderNumber);
  }

  async setShipment(orderNumber: string, dto: SetShipmentDto): Promise<AdminOrderView> {
    const record = await this.require(orderNumber);

    await this.orders.setShipment(record.id, {
      courier: dto.courier,
      trackingNumber: dto.trackingNumber ?? null,
      // The window quoted at checkout (FR-CO-09), so the record starts out agreeing with the
      // promise the customer already has.
      estimatedDays: record.shippingMaxDays,
    });

    return this.detail(orderNumber);
  }

  async setInternalNote(orderNumber: string, dto: SetInternalNoteDto): Promise<AdminOrderView> {
    const record = await this.require(orderNumber);

    await this.orders.setInternalNote(record.id, dto.internalNote ?? null);

    return this.detail(orderNumber);
  }

  private listWhere(query: ListAdminOrdersDto): Prisma.OrderWhereInput {
    const term = query.q?.trim();

    return {
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.placedFrom === undefined && query.placedTo === undefined
        ? {}
        : {
            placedAt: {
              ...(query.placedFrom === undefined ? {} : { gte: new Date(query.placedFrom) }),
              ...(query.placedTo === undefined ? {} : { lte: new Date(query.placedTo) }),
            },
          }),
      ...(term === undefined || term.length === 0
        ? {}
        : {
            OR: [
              { orderNumber: { contains: term, mode: 'insensitive' } },
              // The email lives inside the snapshot JSONB (FR-ORD-05 keeps it there so a later
              // profile edit cannot rewrite history), so it is matched on the JSON path.
              { customerSnapshot: { path: ['email'], string_contains: term } },
            ],
          }),
      ...this.cursorWhere(query.cursor),
    };
  }

  /**
   * The keyset walks `(placed_at, order_number)` rather than `(placed_at, id)`.
   *
   * The order id is a UUID nobody sees; the order number is what the list shows and what sorts
   * meaningfully within a day. `GS-YYMMDD-XXXX` is monotonic per day by construction, so pairing
   * it with `placed_at` orders a same-instant tie exactly as an operator would expect.
   */
  private cursorWhere(cursor: string | undefined): Prisma.OrderWhereInput {
    const keyset = decodeCursor(cursor);
    if (keyset === undefined) return {};

    return {
      OR: [{ placedAt: { lt: keyset.at } }, { placedAt: keyset.at, orderNumber: { lt: keyset.id } }],
    };
  }

  private async require(orderNumber: string): Promise<OrderRecord> {
    const record = await this.orders.findByNumber(orderNumber);
    if (record === null) throw new NotFoundError('No order with that number.', { orderNumber });

    return record;
  }
}
