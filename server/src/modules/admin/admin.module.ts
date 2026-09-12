import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { HealthModule } from '../health/health.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { VouchersModule } from '../vouchers/vouchers.module.js';
import { AdminCatalogueController } from './admin-catalogue.controller.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminProductsController, AdminVariantsController } from './admin-products.controller.js';
import { AdminReferenceController } from './admin-reference.controller.js';
import { AdminController } from './admin.controller.js';
import { DashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';

/**
 * The back office (FR-ADM-01 … FR-ADM-12).
 *
 * **Controllers only, plus the dashboard.** Every rule an admin route enforces lives in the
 * bounded context that owns it — a product's rules in `catalog`, an order's in `orders`, stock's
 * in `inventory` — and this module imports those and exposes them over HTTP behind the guard.
 * That is what the plan means by "admin controllers call the same services the storefront does":
 * publishing a product and browsing one go through the same module, so the back office cannot
 * drift into a second, subtly different idea of what a product is.
 *
 * The dashboard is the exception and has its own service and repository here, because it is the
 * one thing that is genuinely admin's own: a cross-aggregate read that no other context wants
 * and that would have to be assembled from five services if it lived anywhere else.
 */
@Module({
  imports: [
    HealthModule,
    PaymentsModule,
    CatalogModule,
    OrdersModule,
    InventoryModule,
    VouchersModule,
    ReviewsModule,
  ],
  controllers: [
    AdminController,
    AdminProductsController,
    AdminVariantsController,
    AdminOrdersController,
    AdminReferenceController,
    AdminCatalogueController,
  ],
  providers: [DashboardService, DashboardRepository],
})
export class AdminModule {}
