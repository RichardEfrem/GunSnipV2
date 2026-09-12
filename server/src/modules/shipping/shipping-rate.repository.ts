import { Injectable } from '@nestjs/common';
import type { ShippingTier, ShippingZone } from '@gunsnip/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ShippingEstimate } from './entities/shipping-estimate.entity.js';
import type { ShippingOption } from './entities/shipping-option.entity.js';

const OPTION_SELECT = { tier: true, priceIdr: true, minDays: true, maxDays: true } as const;

/** All Prisma access for the flat rate table (CLAUDE.md, PRD A4). */
@Injectable()
export class ShippingRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The cheapest active rate for a tier across every zone, or null when none is active. */
  async cheapest(tier: ShippingTier): Promise<ShippingEstimate | null> {
    return this.prisma.shippingRate.findFirst({
      where: { tier, isActive: true },
      select: { zone: true, ...OPTION_SELECT },
      orderBy: [{ priceIdr: 'asc' }, { zone: 'asc' }],
    });
  }

  /** Every active tier offered to a zone, cheapest first — which is also slowest first. */
  async forZone(zone: ShippingZone): Promise<ShippingOption[]> {
    return this.prisma.shippingRate.findMany({
      where: { zone, isActive: true },
      select: OPTION_SELECT,
      orderBy: [{ priceIdr: 'asc' }, { tier: 'asc' }],
    });
  }
}
