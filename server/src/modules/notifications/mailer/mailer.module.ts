import { Module } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { ConsoleMailer } from './console.mailer.js';
import { MAILER, type Mailer } from './mailer.js';

/**
 * Binds `MAILER_TRANSPORT` to the implementation the environment names (FR-NOTIF-02).
 *
 * Its own module for the same reason `PaymentProviderModule` is: more than one module sends
 * mail — order notifications now, back-in-stock when `FR-NOTIF-03` lands — and two modules
 * needing the same piece is what a third module is for (CLAUDE.md).
 */
const TRANSPORTS: Readonly<Record<'console', new () => Mailer>> = {
  console: ConsoleMailer,
};

@Module({
  providers: [
    {
      provide: MAILER,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Mailer => new TRANSPORTS[config.mailerTransport](),
    },
  ],
  exports: [MAILER],
})
export class MailerModule {}
