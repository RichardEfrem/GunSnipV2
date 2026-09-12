import { Injectable } from '@nestjs/common';
import { actorScope, type Actor } from '@gunsnip/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { VoucherTerms } from './entities/voucher-terms.entity.js';
import { VOUCHER_TERMS_SELECT, toVoucherTerms } from './voucher-terms.query.js';

/** All Prisma access for vouchers and their redemptions (CLAUDE.md). */
@Injectable()
export class VoucherRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Exact match. Codes are stored upper-case and the request DTO normalises to match. */
  async findByCode(code: string): Promise<VoucherTerms | null> {
    const row = await this.prisma.voucher.findUnique({ where: { code }, select: VOUCHER_TERMS_SELECT });
    return row === null ? null : toVoucherTerms(row);
  }

  async findById(id: string): Promise<VoucherTerms | null> {
    const row = await this.prisma.voucher.findUnique({ where: { id }, select: VOUCHER_TERMS_SELECT });
    return row === null ? null : toVoucherTerms(row);
  }

  /**
   * How many placed orders this actor has used the voucher on — the per-session limit
   * (FR-PROMO-02). Found by `ActorScope`, so Phase 1 counts a signed-in customer's redemptions
   * across devices without this method changing.
   */
  async countRedemptions(voucherId: string, actor: Actor): Promise<number> {
    return this.prisma.voucherRedemption.count({ where: { voucherId, ...actorScope(actor) } });
  }
}
