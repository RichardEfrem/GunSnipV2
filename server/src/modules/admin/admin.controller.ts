import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import type { Actor, PaymentStatus } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { HealthService, type HealthReport } from '../health/health.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { DashboardService } from './dashboard.service.js';
import { AdminOrderNumberParamDto } from './dto/order-number-param.dto.js';
import { SettlePaymentDto } from './dto/settle-payment.dto.js';
import type { AdminDashboard } from './entities/dashboard.entity.js';

/**
 * The admin root: the dashboard, health, and settling a payment by hand.
 *
 * Every route in this group — and in every other admin controller — carries the guard that has
 * existed since Phase 0 (PRD §11.2), so no admin endpoint is ever written without one.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly health: HealthService,
    private readonly payments: PaymentsService,
    private readonly dashboard: DashboardService,
  ) {}

  /** FR-ADM-01. */
  @Get('dashboard')
  async summary(): Promise<AdminDashboard> {
    return this.dashboard.summary();
  }

  /**
   * Health, and the actor the request resolved to.
   *
   * The actor is echoed because this is also what the web app's admin sign-in calls to check a
   * key before storing it: a 200 means the key is good, and there is no point in a second
   * endpoint that says only that.
   */
  @Get('health')
  async check(@CurrentActor() actor: Actor): Promise<HealthReport & { actor: Actor }> {
    return { ...(await this.health.check()), actor };
  }

  /**
   * Marks a payment paid or failed (FR-PAY-04, DoD §13.7). The order follows — to PAID, or to
   * CANCELLED with its stock released — because the payment outcome table says so, not because
   * this handler decides anything.
   *
   * Stays here rather than moving to `AdminOrdersController` with the other order actions: it
   * writes the *payment* row and lets the order follow, which is the opposite direction from
   * every route on that controller. `FULFILMENT_EFFECTS` marks PAID as reachable only this way.
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
