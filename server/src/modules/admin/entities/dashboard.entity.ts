import type { OrderStatus } from '@gunsnip/shared';

/**
 * The back-office dashboard (FR-ADM-01).
 *
 * Six numbers and three short lists, chosen because each one answers "is there something I have
 * to do right now?" — not because they are interesting. Revenue is there to answer "is the shop
 * working today"; everything else is a queue with a length.
 */
export interface AdminDashboard {
  /** Since local midnight in Asia/Jakarta, which is the day an operator means (PRD A1). */
  today: DashboardToday;
  queues: DashboardQueues;
  lowStock: readonly LowStockLine[];
  topProducts: readonly TopProductLine[];
  recentOrders: readonly RecentOrderLine[];
  /** The instant the figures were computed, so the screen can say how fresh they are. */
  generatedAt: string;
}

export interface DashboardToday {
  orderCount: number;
  /**
   * Whole rupiah (PRD A2), counting orders that have been paid for. An order sitting unpaid is
   * not revenue, and counting it would make the number drop every time one expired.
   */
  revenueIdr: number;
}

export interface DashboardQueues {
  awaitingPayment: number;
  /** Paid and not yet shipped — the pick list. */
  awaitingShipment: number;
  pendingReviews: number;
  /** Variants at or below the low-stock threshold, sellable ones only. */
  lowStockCount: number;
}

export interface LowStockLine {
  variantId: string;
  sku: string;
  productId: string;
  productName: string;
  variantName: string | null;
  availableQuantity: number;
}

export interface TopProductLine {
  productId: string;
  name: string;
  slug: string;
  unitsSold: number;
}

export interface RecentOrderLine {
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  totalIdr: number;
  placedAt: string;
}
