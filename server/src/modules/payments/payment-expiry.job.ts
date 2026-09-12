import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service.js';

/**
 * Closes unpaid orders whose payment window has passed (FR-PAY-06, DoD §13.8).
 *
 * Every five minutes rather than at each order's exact expiry: a window is 24 hours by default,
 * so five minutes of grace costs nobody anything, and a sweep has no timers to lose when the
 * process restarts. The work itself is `PaymentsService.expireDue` — the job owns *when*, not
 * *what*, so the same expiry can be triggered from a test without waiting for a clock.
 *
 * **Guarded against overlapping.** Nest fires the next tick whether or not the last one has
 * finished; a backlog that takes longer than the interval would otherwise have two sweeps
 * settling the same payments at once, each waiting on the other's row locks.
 */
@Injectable()
export class PaymentExpiryJob {
  private readonly logger = new Logger(PaymentExpiryJob.name);
  private isSweeping = false;

  constructor(private readonly payments: PaymentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'payment-expiry' })
  async sweep(): Promise<void> {
    if (this.isSweeping) {
      this.logger.warn('Skipping the payment expiry sweep — the last one is still running.');
      return;
    }

    this.isSweeping = true;

    try {
      await this.payments.expireDue();
    } catch (cause) {
      // Never let the job's own failure kill the scheduler; the next tick tries again.
      this.logger.error({ err: cause }, 'The payment expiry sweep failed.');
    } finally {
      this.isSweeping = false;
    }
  }
}
