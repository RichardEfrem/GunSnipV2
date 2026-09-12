import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { CheckoutService } from './checkout.service.js';
import { CheckoutQuoteDto } from './dto/checkout-quote.dto.js';
import type { CheckoutQuote } from './entities/checkout-quote.entity.js';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  // 200, not 201: a quote is a calculation over the cart, not a resource.
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  async quote(@CurrentActor() actor: Actor, @Body() dto: CheckoutQuoteDto): Promise<CheckoutQuote> {
    return this.checkout.quote(actor, dto);
  }
}
