import { Module } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';

/**
 * Binds `PAYMENT_PROVIDER` to the implementation the environment names (PRD §11.3).
 *
 * Its own module, and not part of `PaymentsModule`, because both the payments module and the
 * orders module need a provider: orders opens the charge when it creates the order, payments
 * settles it. Two modules needing the same piece is what a third module is for (CLAUDE.md).
 *
 * Adding a real gateway is a class and one entry in this record. Business logic never branches
 * on which one is running — nothing outside this file knows there is a choice.
 */
const PROVIDERS: Readonly<Record<'mock', new () => PaymentProvider>> = {
  mock: MockPaymentProvider,
};

@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [AppConfig],
      useFactory: (config: AppConfig): PaymentProvider => new PROVIDERS[config.paymentProvider](),
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProviderModule {}
