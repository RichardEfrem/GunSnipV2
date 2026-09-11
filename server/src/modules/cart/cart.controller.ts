import { Body, Controller, Get, Post } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { CartService } from './cart.service.js';
import { AddCartItemsDto } from './dto/add-cart-items.dto.js';
import type { CartView } from './entities/cart.entity.js';

/**
 * Parse, delegate, return (CLAUDE.md). The cart's rules are entirely in the service — this file
 * knows only that a cart belongs to an actor.
 */
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  async view(@CurrentActor() actor: Actor): Promise<CartView> {
    return this.cart.view(actor);
  }

  @Post('items')
  async addItems(@CurrentActor() actor: Actor, @Body() dto: AddCartItemsDto): Promise<CartView> {
    return this.cart.addItems(actor, dto.items);
  }
}
