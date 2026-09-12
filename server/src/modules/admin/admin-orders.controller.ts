import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import type { CursorPage } from '../../common/pagination/cursor-page.js';
import type { AdminOrderSummary, AdminOrderView } from '../orders/entities/admin-order.entity.js';
import { OrderFulfilmentService } from '../orders/order-fulfilment.service.js';
import {
  AdvanceOrderDto,
  CancelOrderDto,
  SetInternalNoteDto,
  SetShipmentDto,
} from '../orders/dto/fulfil-order.dto.js';
import { ListAdminOrdersDto } from '../orders/dto/list-admin-orders.dto.js';
import { AdminOrderNumberParamDto } from './dto/order-number-param.dto.js';

/**
 * Order list and detail (FR-ADM-07, FR-ADM-08).
 *
 * Addressed by order number rather than id throughout: the number is what an operator reads off
 * an email, types into a search box and says on the phone. The id is an implementation detail
 * nobody outside the database has ever needed.
 */
@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminOrdersController {
  constructor(private readonly fulfilment: OrderFulfilmentService) {}

  @Get()
  async list(@Query() query: ListAdminOrdersDto): Promise<CursorPage<AdminOrderSummary>> {
    return this.fulfilment.list(query);
  }

  @Get(':orderNumber')
  async detail(@Param() params: AdminOrderNumberParamDto): Promise<AdminOrderView> {
    return this.fulfilment.detail(params.orderNumber);
  }

  @Post(':orderNumber/status')
  @HttpCode(HttpStatus.OK)
  async advance(
    @Param() params: AdminOrderNumberParamDto,
    @Body() dto: AdvanceOrderDto,
  ): Promise<AdminOrderView> {
    return this.fulfilment.advance(params.orderNumber, dto);
  }

  /** Separate from advancing, because FR-ADM-08 makes the reason mandatory. */
  @Post(':orderNumber/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param() params: AdminOrderNumberParamDto, @Body() dto: CancelOrderDto): Promise<AdminOrderView> {
    return this.fulfilment.cancel(params.orderNumber, dto);
  }

  @Put(':orderNumber/shipment')
  async setShipment(
    @Param() params: AdminOrderNumberParamDto,
    @Body() dto: SetShipmentDto,
  ): Promise<AdminOrderView> {
    return this.fulfilment.setShipment(params.orderNumber, dto);
  }

  @Put(':orderNumber/note')
  async setInternalNote(
    @Param() params: AdminOrderNumberParamDto,
    @Body() dto: SetInternalNoteDto,
  ): Promise<AdminOrderView> {
    return this.fulfilment.setInternalNote(params.orderNumber, dto);
  }
}
