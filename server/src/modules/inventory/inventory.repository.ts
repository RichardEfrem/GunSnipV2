import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditActor } from '../orders/audit-actor.js';
import type { StockMovement, StockLevelView } from './entities/stock-movement.entity.js';
import type { StockLevel } from './stock-reservation.js';

/**
 * All Prisma access for stock (CLAUDE.md). The adjustment itself is a transaction: the level
 * write and the `inventory_movement` row are one unit, because a level nobody can account for
 * is worse than an adjustment that failed.
 */
const MOVEMENT_SELECT = {
  id: true,
  variantId: true,
  delta: true,
  reason: true,
  note: true,
  actorKind: true,
  orderId: true,
  createdAt: true,
  variant: { select: { sku: true, product: { select: { name: true } } } },
} satisfies Prisma.InventoryMovementSelect;

export interface StockAdjustment {
  variantId: string;
  stockOnHand: number;
  delta: number;
  reason: StockMovement['reason'];
  note: string | undefined;
  by: AuditActor;
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Locks one variant row and reads its levels, then hands them to `work`, and writes back what
   * comes out along with the movement that explains it — all inside one transaction.
   *
   * The lock is what makes an adjustment safe against a checkout reserving the same variant: the
   * "is enough free?" question and the write that answers it cannot be split by another
   * transaction. It takes the same `FOR UPDATE` on `product_variant` that order placement takes,
   * so the two queue rather than interleave.
   *
   * Null when the id names no variant, which the service turns into a 404.
   */
  async adjust(
    variantId: string,
    work: (level: StockLevel) => StockAdjustment,
  ): Promise<StockLevelView | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string; stock_on_hand: number; stock_reserved: number; product_name: string }[]
      >`
        SELECT v.id, v.stock_on_hand, v.stock_reserved, p.name AS product_name
        FROM product_variant v
        JOIN product p ON p.id = v.product_id
        WHERE v.id = ${variantId}::uuid
        FOR UPDATE OF v
      `;

      const row = rows[0];
      if (row === undefined) return null;

      const adjustment = work({
        variantId: row.id,
        productName: row.product_name,
        stockOnHand: row.stock_on_hand,
        stockReserved: row.stock_reserved,
      });

      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: { stockOnHand: adjustment.stockOnHand },
        select: {
          id: true,
          sku: true,
          name: true,
          stockOnHand: true,
          stockReserved: true,
          product: { select: { name: true } },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          variantId,
          delta: adjustment.delta,
          reason: adjustment.reason,
          note: adjustment.note,
          actorKind: adjustment.by.actorKind,
          actorId: adjustment.by.actorId,
        },
      });

      return {
        variantId: variant.id,
        sku: variant.sku,
        productName: variant.product.name,
        variantName: variant.name,
        stockOnHand: variant.stockOnHand,
        stockReserved: variant.stockReserved,
        availableQuantity: Math.max(0, variant.stockOnHand - variant.stockReserved),
      };
    });
  }

  /** A variant's movements, newest first, one row past the page so the cursor can be trusted. */
  async movements(
    variantId: string,
    where: Record<string, unknown> | undefined,
    take: number,
  ): Promise<StockMovement[]> {
    const rows = await this.prisma.inventoryMovement.findMany({
      where: { variantId, ...where },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: MOVEMENT_SELECT,
    });

    // One lookup for the whole page rather than a join on every row: most movements carry no
    // order, and the ones that do are almost always the same handful of orders.
    const orderNumbers = await this.orderNumbers(rows.flatMap((row) => (row.orderId === null ? [] : [row.orderId])));

    return rows.map((row) => ({
      id: row.id,
      variantId: row.variantId,
      sku: row.variant.sku,
      productName: row.variant.product.name,
      delta: row.delta,
      reason: row.reason,
      note: row.note,
      actorKind: row.actorKind,
      orderNumber: row.orderId === null ? null : (orderNumbers.get(row.orderId) ?? null),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async variantExists(variantId: string): Promise<boolean> {
    return (await this.prisma.productVariant.findUnique({ where: { id: variantId }, select: { id: true } })) !== null;
  }

  private async orderNumbers(orderIds: readonly string[]): Promise<Map<string, string>> {
    if (orderIds.length === 0) return new Map();

    const rows = await this.prisma.order.findMany({
      where: { id: { in: [...new Set(orderIds)] } },
      select: { id: true, orderNumber: true },
    });

    return new Map(rows.map((row) => [row.id, row.orderNumber]));
  }
}
