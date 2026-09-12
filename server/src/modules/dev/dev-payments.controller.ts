import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { PaymentStatus } from '@gunsnip/shared';
import { DevEndpointsGuard } from '../../common/guards/dev-endpoints.guard.js';
import { PaymentsService } from '../payments/payments.service.js';
import { SimulatePaymentDto } from './dto/simulate-payment.dto.js';

/**
 * Settling a mock payment without a bank (FR-PAY-05). Behind `ENABLE_DEV_ENDPOINTS`, which is
 * false unless an environment says otherwise.
 *
 * The service asks the provider for the callback body it would have sent and feeds it back
 * through `parseCallback`, so this endpoint drives the same code a real webhook will.
 */
@Controller('dev/payments')
@UseGuards(DevEndpointsGuard)
export class DevPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // 200: the payment already existed; this settles it rather than creating anything.
  @Post(':paymentId/simulate')
  @HttpCode(HttpStatus.OK)
  async simulate(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: SimulatePaymentDto,
  ): Promise<{ status: PaymentStatus }> {
    return { status: await this.payments.simulate(paymentId, dto.event) };
  }
}
