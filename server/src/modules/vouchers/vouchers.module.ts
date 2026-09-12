import { Module } from '@nestjs/common';
import { VoucherAdminService } from './voucher-admin.service.js';
import { VoucherWriteRepository } from './voucher-write.repository.js';
import { VoucherRepository } from './voucher.repository.js';
import { VoucherService } from './voucher.service.js';

/**
 * Voucher rules (FR-PROMO-01 … FR-PROMO-05).
 *
 * No controller of its own: a customer applies a voucher *to a cart* (`POST /cart/voucher`), and
 * the admin CRUD (FR-ADM-10) lives with the other admin routes. What this module exports is the
 * verdict the cart and checkout consume, and the CRUD the admin controller drives.
 */
@Module({
  providers: [VoucherService, VoucherAdminService, VoucherRepository, VoucherWriteRepository],
  exports: [VoucherService, VoucherAdminService],
})
export class VouchersModule {}
