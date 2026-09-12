import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { IdempotencyKey } from '../../common/decorators/idempotency-key.decorator.js';
import { OrderAccessDto } from './dto/order-access.dto.js';
import { OrderNumberParamDto } from './dto/order-number-param.dto.js';
import { PlaceOrderDto } from './dto/place-order.dto.js';
import type { OrderView } from './entities/order.entity.js';
import { OrderRateLimitGuard } from './order-rate-limit.guard.js';
import { OrderPlacementService } from './order-placement.service.js';
import { OrdersService } from './orders.service.js';

/** Parse, delegate, return (CLAUDE.md). Who may do what to an order is decided in the services. */
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly placement: OrderPlacementService,
    private readonly orders: OrdersService,
  ) {}

  // Placing an order reserves stock, so how fast anyone may do it is capped (PRD §12 Security).
  @Post()
  @UseGuards(OrderRateLimitGuard)
  async place(
    @CurrentActor() actor: Actor,
    @Body() dto: PlaceOrderDto,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<OrderView> {
    return this.placement.place(actor, dto, idempotencyKey);
  }

  @Get(':orderNumber')
  async view(
    @CurrentActor() actor: Actor,
    @Param() params: OrderNumberParamDto,
    @Query() query: OrderAccessDto,
  ): Promise<OrderView> {
    return this.orders.view(actor, params.orderNumber, query.email);
  }

  // 200, not 201: cancelling changes an order, it does not create anything.
  @Post(':orderNumber/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentActor() actor: Actor,
    @Param() params: OrderNumberParamDto,
    @Body() dto: OrderAccessDto,
  ): Promise<OrderView> {
    return this.orders.cancel(actor, params.orderNumber, dto.email);
  }
}
