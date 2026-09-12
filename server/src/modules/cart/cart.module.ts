import { Module } from '@nestjs/common';
import { ShippingModule } from '../shipping/shipping.module.js';
import { VouchersModule } from '../vouchers/vouchers.module.js';
import { CartController } from './cart.controller.js';
import { CartRepository } from './cart.repository.js';
import { CartService } from './cart.service.js';

/**
 * The cart bounded context (FR-CART-01 … FR-CART-06).
 *
 * Depends on shipping for the estimate and on vouchers for the verdict, and owns neither: the
 * rate table and the voucher rules are shared with checkout, so they live in modules of their
 * own rather than in here (CLAUDE.md — a shared piece belongs in a third module).
 *
 * `CartService` is exported for any module that needs the priced cart; checkout reads the cart through its own locked basket query instead (see `OrdersModule`).
 */
@Module({
  imports: [ShippingModule, VouchersModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService],
})
export class CartModule {}
