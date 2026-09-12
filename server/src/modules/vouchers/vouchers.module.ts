import { Module } from '@nestjs/common';
import { VoucherRepository } from './voucher.repository.js';
import { VoucherService } from './voucher.service.js';

/**
 * Voucher rules (FR-PROMO-01 … FR-PROMO-05).
 *
 * No controller of its own: a customer applies a voucher *to a cart* (`POST /cart/voucher`), and
 * the admin CRUD of Phase 9 lives with the other admin routes. What this module exports is the
 * verdict, which the cart uses now and checkout uses in Phase 7.
 */
@Module({
  providers: [VoucherService, VoucherRepository],
  exports: [VoucherService],
})
export class VouchersModule {}
