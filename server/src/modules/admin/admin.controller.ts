import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import type { Actor, PaymentStatus } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { HealthService, type HealthReport } from '../health/health.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { AdminOrderNumberParamDto } from './dto/order-number-param.dto.js';
import { SettlePaymentDto } from './dto/settle-payment.dto.js';

/**
 * The admin API. Every route in this group carries the guard that has existed since Phase 0
 * (PRD §11.2), so no admin endpoint is ever written without one.
 *
 * The screens arrive in Phase 9. What exists now is the one action Phase 8 needs: settling a
 * payment by hand, which is how a bank transfer is confirmed while the provider is a mock.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly health: HealthService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('health')
  async check(@CurrentActor() actor: Actor): Promise<HealthReport & { actor: Actor }> {
    return { ...(await this.health.check()), actor };
  }

  /**
   * Marks a payment paid or failed (FR-PAY-04, DoD §13.7). The order follows — to PAID, or to
   * CANCELLED with its stock released — because the payment outcome table says so, not because
   * this handler decides anything.
   */
  @Post('orders/:orderNumber/payment')
  @HttpCode(HttpStatus.OK)
  async settlePayment(
    @Param() params: AdminOrderNumberParamDto,
    @Body() dto: SettlePaymentDto,
  ): Promise<{ status: PaymentStatus }> {
    return { status: await this.payments.settleByOperator(params.orderNumber, dto.status) };
  }
}
