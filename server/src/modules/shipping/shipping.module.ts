import { Module } from '@nestjs/common';
import { RegionRepository } from './region.repository.js';
import { ShippingController } from './shipping.controller.js';
import { ShippingRateRepository } from './shipping-rate.repository.js';
import { ShippingService } from './shipping.service.js';

/**
 * Flat-rate shipping by zone and tier (PRD A4), and the address region tree that decides the zone.
 *
 * Exported for the cart's estimate and for checkout's quote, so both read rates from one owner.
 */
@Module({
  controllers: [ShippingController],
  providers: [ShippingService, ShippingRateRepository, RegionRepository],
  exports: [ShippingService],
})
export class ShippingModule {}
