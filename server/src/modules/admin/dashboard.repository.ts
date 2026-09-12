import { Injectable } from '@nestjs/common';
import { LOW_STOCK_THRESHOLD } from '@gunsnip/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { customerSnapshotSchema } from '../orders/entities/customer-snapshot.js';
import type {
  DashboardQueues,
  DashboardToday,
  LowStockLine,
  RecentOrderLine,
  TopProductLine,
} from './entities/dashboard.entity.js';

/**
 * All Prisma access for the dashboard (FR-ADM-01).
 *
 * The one repository that deliberately reads across aggregates — orders, variants, products and
 * reviews — because a dashboard *is* a cross-aggregate read. The alternative, asking five
 * services for one number each, would mean five round trips and five chances for the figures to
 * be from different instants.
 *
 * Every query here is bounded. A dashboard that gets slower as the shop succeeds is a dashboard
 * nobody opens.
 */
const LOW_STOCK_LIMIT = 12;
const TOP_PRODUCT_LIMIT = 8;
const RECENT_ORDER_LIMIT = 8;

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Today's count and revenue, from local midnight (PRD A1).
   *
   * Revenue counts orders that have actually been paid for, which is `paid_at` rather than
   * `placed_at`: an order placed yesterday and paid this morning is today's money, and one
   * placed this morning and never paid is nobody's.
   */
  async today(since: Date): Promise<DashboardToday> {
    const [placed, paid] = await Promise.all([
      this.prisma.order.count({ where: { placedAt: { gte: since } } }),
      this.prisma.order.aggregate({
        where: { paidAt: { gte: since }, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
        _sum: { totalIdr: true },
      }),
    ]);

    return { orderCount: placed, revenueIdr: paid._sum.totalIdr ?? 0 };
  }

  async queues(): Promise<DashboardQueues> {
    const [awaitingPayment, awaitingShipment, pendingReviews, lowStockCount] = await Promise.all([
      this.prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      // Paid but not yet handed over — PAID and PACKING together are the pick list, because an
      // order half-packed is still work outstanding.
      this.prisma.order.count({ where: { status: { in: ['PAID', 'PACKING'] } } }),
      this.prisma.review.count({ where: { status: 'PENDING' } }),
      this.lowStockCount(),
    ]);

    return { awaitingPayment, awaitingShipment, pendingReviews, lowStockCount };
  }

  /**
   * Variants at or below the low-stock threshold, scarcest first.
   *
   * Raw SQL because the predicate is `stock_on_hand - stock_reserved <= n`, an expression over
   * two columns that Prisma cannot filter or order by. Restricted to published products and
   * unarchived variants: a draft running low is not a thing to act on.
   */
  async lowStock(): Promise<LowStockLine[]> {
    const rows = await this.prisma.$queryRaw<
      {
        variant_id: string;
        sku: string;
        product_id: string;
        product_name: string;
        variant_name: string | null;
        available: number;
      }[]
    >`
      SELECT v.id AS variant_id,
             v.sku,
             p.id AS product_id,
             p.name AS product_name,
             v.name AS variant_name,
             GREATEST(v.stock_on_hand - v.stock_reserved, 0) AS available
      FROM product_variant v
      JOIN product p ON p.id = v.product_id
      WHERE v.is_archived = false
        AND p.status = 'PUBLISHED'
        AND v.stock_on_hand - v.stock_reserved <= ${LOW_STOCK_THRESHOLD}
      ORDER BY available ASC, p.name ASC
      LIMIT ${LOW_STOCK_LIMIT}
    `;

    return rows.map((row) => ({
      variantId: row.variant_id,
      sku: row.sku,
      productId: row.product_id,
      productName: row.product_name,
      variantName: row.variant_name,
      availableQuantity: Number(row.available),
    }));
  }

  async topProducts(): Promise<TopProductLine[]> {
    const rows = await this.prisma.product.findMany({
      where: { status: 'PUBLISHED', unitsSold: { gt: 0 } },
      orderBy: { unitsSold: 'desc' },
      take: TOP_PRODUCT_LIMIT,
      select: { id: true, name: true, slug: true, unitsSold: true },
    });

    return rows.map((row) => ({ productId: row.id, name: row.name, slug: row.slug, unitsSold: row.unitsSold }));
  }

  async recentOrders(): Promise<RecentOrderLine[]> {
    const rows = await this.prisma.order.findMany({
      orderBy: { placedAt: 'desc' },
      take: RECENT_ORDER_LIMIT,
      select: { orderNumber: true, status: true, customerSnapshot: true, totalIdr: true, placedAt: true },
    });

    return rows.map((row) => ({
      orderNumber: row.orderNumber,
      status: row.status,
      customerName: customerSnapshotSchema.parse(row.customerSnapshot).name,
      totalIdr: row.totalIdr,
      placedAt: row.placedAt.toISOString(),
    }));
  }

  private async lowStockCount(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM product_variant v
      JOIN product p ON p.id = v.product_id
      WHERE v.is_archived = false
        AND p.status = 'PUBLISHED'
        AND v.stock_on_hand - v.stock_reserved <= ${LOW_STOCK_THRESHOLD}
    `;

    // `COUNT(*)` comes back as a bigint; JSON has no such thing and the figure is a shelf count,
    // not a quantity that could ever exceed a safe integer.
    return Number(rows[0]?.count ?? 0);
  }
}
