import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentExpiryJob } from './payment-expiry.job.js';
import { PaymentsService } from './payments.service.js';
import { PaymentProviderModule } from './provider/payment-provider.module.js';

/**
 * Payments (FR-PAY-01 … FR-PAY-08).
 *
 * Depends on `OrdersModule` for the transaction a settlement runs in — a payment is part of the
 * order aggregate — and on `PaymentProviderModule` for whichever provider the environment named.
 * `OrdersModule` does not depend on this one: it reaches the provider through the same third
 * module, and the two pure files it needs from here (the payment state machine and the outcome
 * table) are plain functions with no injector behind them. That is what keeps the two modules
 * out of a cycle.
 */
@Module({
  imports: [OrdersModule, PaymentProviderModule],
  providers: [PaymentsService, PaymentExpiryJob],
  exports: [PaymentsService],
})
export class PaymentsModule {}
