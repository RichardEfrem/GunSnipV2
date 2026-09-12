import { Injectable } from '@nestjs/common';
import type { Actor, ShippingTier } from '@gunsnip/shared';
import { toCartVoucher } from '../cart/cart-mapper.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { toCheckoutLine } from './checkout-mapper.js';
import type { CheckoutDelivery, CheckoutQuote } from './entities/checkout-quote.entity.js';
import { quotableLines } from './order-lines.js';
import { priceOrder } from './order-pricing.js';
import { OrderRepository } from './order.repository.js';

export interface CheckoutQuoteRequest {
  regionId?: string;
  shippingTier?: ShippingTier;
}

/**
 * The checkout summary (FR-CO-04, FR-CO-05).
 *
 * Priced by `priceOrder`, the same function `POST /orders` writes the order with, from the same
 * basket query — so "Total" on the checkout page is the amount the order will record, not a
 * figure the browser assembled from parts (CLAUDE.md non-negotiable #2). Read-only: quoting
 * locks nothing and writes nothing, and runs again on every address or tier change.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly shipping: ShippingService,
  ) {}

  async quote(actor: Actor, request: CheckoutQuoteRequest): Promise<CheckoutQuote> {
    const basket = await this.orders.readBasket(actor);
    const { lines, unavailableCount } = quotableLines(basket);
    const delivery = request.regionId === undefined ? null : await this.delivery(request.regionId, request.shippingTier);

    const pricing = priceOrder(lines, delivery?.selected?.priceIdr ?? 0, basket?.voucher ?? null, new Date());

    return {
      lines: lines.map(toCheckoutLine),
      unavailableCount,
      voucher:
        basket?.voucher == null || pricing.voucher === null ? null : toCartVoucher(basket.voucher.terms, pricing.voucher),
      delivery,
      totals: {
        subtotalIdr: pricing.subtotalIdr,
        discountIdr: pricing.discountIdr,
        shippingIdr: pricing.shippingIdr,
        totalIdr: pricing.totalIdr,
        itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      },
    };
  }

  private async delivery(regionId: string, tier: ShippingTier | undefined): Promise<CheckoutDelivery> {
    const { destination, options } = await this.shipping.quoteDestination(regionId);

    return {
      regionId,
      zone: destination.zone,
      isComplete: destination.isLeaf,
      options,
      selected: options.find((option) => option.tier === tier) ?? options[0] ?? null,
    };
  }
}
