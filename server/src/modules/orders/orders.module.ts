import { Module } from '@nestjs/common';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { PaymentProviderModule } from '../payments/provider/payment-provider.module.js';
import { ShippingModule } from '../shipping/shipping.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OrderPlacementService } from './order-placement.service.js';
import { OrderRateLimitGuard } from './order-rate-limit.guard.js';
import { OrderRepository } from './order.repository.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/**
 * Checkout and orders (FR-CO-01 … FR-CO-10, FR-ORD-01 … FR-ORD-06).
 *
 * Turns a cart into an order. It reads the cart through its own basket query rather than through
 * `CartService`, because an order has to read the cart *inside its transaction, after the
 * variant locks* — a call out to another module's service would read it outside both. The rules
 * it shares with the cart (line revalidation, line totals, the voucher verdict) are pure functions
 * imported from the cart and voucher modules, so there is still one implementation of each.
 *
 * `OrderRepository` is exported for the payment module. A payment is part of the order aggregate
 * — one row per order, cascade-deleted with it, never written without its order's lock — so
 * settling one runs in *this* module's transaction rather than a second one that would then have
 * to be coordinated with it.
 */
@Module({
  imports: [ShippingModule, RateLimitModule, PaymentProviderModule],
  controllers: [CheckoutController, OrdersController],
  providers: [CheckoutService, OrderPlacementService, OrdersService, OrderRepository, OrderRateLimitGuard],
  exports: [OrderRepository],
})
export class OrdersModule {}
