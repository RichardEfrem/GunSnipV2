import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
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
 * It imports the catalogue for `BundleService`: adding a bundle (FR-CAT-11) has to resolve the
 * same components, availability and prices the bundle card showed, and a cart that computed
 * those itself would be a second opinion about what a bundle costs.
 *
 * `CartService` is exported for any module that needs the priced cart; checkout reads the cart through its own locked basket query instead (see `OrdersModule`).
 */
@Module({
  imports: [ShippingModule, VouchersModule, CatalogModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService],
})
export class CartModule {}
