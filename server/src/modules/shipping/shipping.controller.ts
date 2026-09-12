import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ListRegionsDto } from './dto/list-regions.dto.js';
import { ShippingQuoteDto } from './dto/shipping-quote.dto.js';
import type { Region } from './entities/region.entity.js';
import type { ShippingQuote } from './entities/shipping-option.entity.js';
import { ShippingService } from './shipping.service.js';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('regions')
  async regions(@Query() query: ListRegionsDto): Promise<Region[]> {
    return this.shipping.regions(query.parentId ?? null);
  }

  // 200, not 201: a quote is a calculation, not a resource.
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  async quote(@Body() dto: ShippingQuoteDto): Promise<ShippingQuote> {
    return this.shipping.quote(dto.regionId);
  }
}
