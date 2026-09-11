import { Module } from '@nestjs/common';
import { CartController } from './cart.controller.js';
import { CartRepository } from './cart.repository.js';
import { CartService } from './cart.service.js';

/**
 * The cart bounded context.
 *
 * Phase 5 builds the half the product page needs — read the cart, add to it (FR-PDP-07,
 * FR-PDP-08). Phase 6 adds per-line selection, quantity edits, removal, vouchers and the
 * revalidation notices of FR-CART-04 on top of this service rather than beside it.
 *
 * `CartService` is exported for checkout in Phase 7, which turns a cart into an order.
 */
@Module({
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService],
})
export class CartModule {}
