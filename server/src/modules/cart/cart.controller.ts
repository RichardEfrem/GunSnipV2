import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { CartService } from './cart.service.js';
import { AddCartBundleDto } from './dto/add-cart-bundle.dto.js';
import { AddCartItemsDto } from './dto/add-cart-items.dto.js';
import { ApplyVoucherDto } from './dto/apply-voucher.dto.js';
import { SetCartSelectionDto } from './dto/set-cart-selection.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import type { CartView } from './entities/cart.entity.js';

/**
 * Parse, delegate, return (CLAUDE.md). The cart's rules are entirely in the service — this file
 * knows only that a cart belongs to an actor. Every handler returns the whole cart.
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

  /** Adds a curated bundle as one item (FR-CAT-11). */
  @Post('bundles')
  async addBundle(@CurrentActor() actor: Actor, @Body() dto: AddCartBundleDto): Promise<CartView> {
    return this.cart.addBundle(actor, dto.slug, dto.quantity);
  }

  @Patch('items')
  async setAllSelected(
    @CurrentActor() actor: Actor,
    @Body() dto: SetCartSelectionDto,
  ): Promise<CartView> {
    return this.cart.setAllSelected(actor, dto.isSelected);
  }

  // Declared before `items/:id`, which would otherwise claim "selected" as an id.
  @Delete('items/selected')
  async removeSelected(@CurrentActor() actor: Actor): Promise<CartView> {
    return this.cart.removeSelected(actor);
  }

  @Patch('items/:id')
  async updateItem(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartView> {
    return this.cart.updateItem(actor, lineId, dto);
  }

  @Delete('items/:id')
  async removeItem(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) lineId: string,
  ): Promise<CartView> {
    return this.cart.removeItem(actor, lineId);
  }

  // 200, not 201: applying a code changes the cart, it does not create a resource.
  @Post('voucher')
  @HttpCode(HttpStatus.OK)
  async applyVoucher(@CurrentActor() actor: Actor, @Body() dto: ApplyVoucherDto): Promise<CartView> {
    return this.cart.applyVoucher(actor, dto.code);
  }

  @Delete('voucher')
  async removeVoucher(@CurrentActor() actor: Actor): Promise<CartView> {
    return this.cart.removeVoucher(actor);
  }
}
