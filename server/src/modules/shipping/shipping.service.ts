import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import type { Region } from './entities/region.entity.js';
import type { ShippingDestination } from './entities/shipping-destination.entity.js';
import type { ShippingEstimate } from './entities/shipping-estimate.entity.js';
import type { ShippingOption, ShippingQuote } from './entities/shipping-option.entity.js';
import { RegionRepository } from './region.repository.js';
import { ShippingRateRepository } from './shipping-rate.repository.js';

/** A destination and what it costs to deliver there — what checkout prices an order against. */
export interface DestinationQuote {
  destination: ShippingDestination;
  options: readonly ShippingOption[];
}

/**
 * Shipping (PRD A4, FR-CART-05, FR-CO-03, FR-CO-04).
 *
 * The one owner of what delivery costs. The cart reads its estimate from here and checkout its
 * quote, so the two can differ only in *which* rate they read — the cart has no address yet —
 * and never in how a rate is looked up.
 */
@Injectable()
export class ShippingService {
  constructor(
    private readonly rates: ShippingRateRepository,
    private readonly regionTree: RegionRepository,
  ) {}

  /**
   * The cart's estimate: the cheapest regular rate anywhere the store ships.
   *
   * Null when no regular rate is active. The cart then shows no shipping line rather than an
   * invented one — checkout, which knows the address, is where a missing rate becomes an error.
   */
  async estimate(): Promise<ShippingEstimate | null> {
    return this.rates.cheapest('REGULAR');
  }

  /** One level of the province → city → district tree (FR-CO-03). */
  async regions(parentId: string | null): Promise<Region[]> {
    return this.regionTree.children(parentId);
  }

  /** `POST /shipping/quote` — the tiers offered to a region, whichever level it is. */
  async quote(regionId: string): Promise<ShippingQuote> {
    const { destination, options } = await this.quoteDestination(regionId);

    return { regionId, zone: destination.zone, options };
  }

  /**
   * A region resolved to its address names and its delivery options.
   *
   * Any level can be quoted — the zone is a province's, so the options can appear as soon as a
   * province is chosen. Whether the region is specific enough to *ship to* is the order's
   * question, not the quote's; see `ShippingDestination.isLeaf`.
   */
  async quoteDestination(regionId: string): Promise<DestinationQuote> {
    const destination = await this.regionTree.findDestination(regionId);
    if (destination === null) {
      throw new NotFoundError('That area is not in our address list. Choose it again.', { regionId });
    }

    const options = destination.zone === null ? [] : await this.rates.forZone(destination.zone);
    return { destination, options };
  }
}
