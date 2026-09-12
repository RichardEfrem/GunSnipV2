import { Injectable } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import type { VoucherBasket, VoucherEvaluation } from './entities/voucher-evaluation.entity.js';
import type { VoucherTerms } from './entities/voucher-terms.entity.js';
import { evaluateVoucher } from './voucher-rules.js';
import { VoucherRepository } from './voucher.repository.js';

/**
 * Vouchers (FR-PROMO-01, FR-PROMO-02, FR-PROMO-05).
 *
 * Owns *whether a voucher applies*; it does not know what a cart is. The cart hands it a basket
 * and gets a verdict, and Phase 7's order transaction will hand it the same basket and get the
 * same verdict — which is the point of keeping the rules out of both of them.
 */
@Injectable()
export class VoucherService {
  constructor(private readonly vouchers: VoucherRepository) {}

  async findByCode(code: string): Promise<VoucherTerms | null> {
    return this.vouchers.findByCode(code);
  }

  async findById(id: string): Promise<VoucherTerms | null> {
    return this.vouchers.findById(id);
  }

  async evaluate(
    terms: VoucherTerms,
    actor: Actor,
    basket: VoucherBasket,
    now: Date = new Date(),
  ): Promise<VoucherEvaluation> {
    // Only counted when there is a limit to count against — most vouchers have none, and the
    // cart is evaluated on every read.
    const sessionRedemptions =
      terms.perSessionLimit === null ? 0 : await this.vouchers.countRedemptions(terms.id, actor);

    return evaluateVoucher(terms, basket, { sessionRedemptions }, now);
  }
}
