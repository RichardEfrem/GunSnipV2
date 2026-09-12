import { Injectable } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository.js';
import type { AdminDashboard } from './entities/dashboard.entity.js';
import { startOfJakartaDay } from './jakarta-day.js';

/**
 * The back-office dashboard (FR-ADM-01).
 *
 * Its only real decision is where "today" starts — the store's day, not UTC's — and then it gets
 * out of the way. Everything is fetched concurrently and stamped with one `generatedAt`, so the
 * six figures on screen are all from the same instant rather than from whenever each query
 * happened to finish.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly dashboard: DashboardRepository) {}

  async summary(): Promise<AdminDashboard> {
    const now = new Date();

    const [today, queues, lowStock, topProducts, recentOrders] = await Promise.all([
      this.dashboard.today(startOfJakartaDay(now)),
      this.dashboard.queues(),
      this.dashboard.lowStock(),
      this.dashboard.topProducts(),
      this.dashboard.recentOrders(),
    ]);

    return { today, queues, lowStock, topProducts, recentOrders, generatedAt: now.toISOString() };
  }
}
