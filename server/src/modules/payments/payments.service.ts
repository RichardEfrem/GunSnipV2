import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PaymentEventType, PaymentStatus } from '@gunsnip/shared';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { ValidationError } from '../../common/errors/validation.error.js';
import { ADMIN_AUDIT, SYSTEM_AUDIT, type AuditActor } from '../orders/audit-actor.js';
import { transitionOrder } from '../orders/order-transition.js';
import { OrderRepository, type PaymentSummary } from '../orders/order.repository.js';
import { chargeExpiredEvent, operatorEvent } from './payment-event.js';
import { orderOutcomeOf } from './payment-outcome.js';
import { assertPaymentTransition } from './payment-status-machine.js';
import {
  isSimulatable,
  PAYMENT_PROVIDER,
  type PaymentEvent,
  type PaymentProvider,
} from './provider/payment-provider.js';

/**
 * Everything that moves a payment (PRD §8.2, FR-PAY-04 … FR-PAY-07).
 *
 * Three things can move one — a provider callback, an operator, the expiry sweep — and all three
 * end at `apply`, which is the only code that writes a payment status. What each of them does
 * differently is *produce a `PaymentEvent`*; what happens to the order afterwards is decided by
 * `payment-outcome.ts` and carried out by `transitionOrder`, so none of the three knows a rule
 * the others do not.
 *
 * Payments are part of the order aggregate — one row, cascade-deleted with it, and never written
 * without their order's lock — so this service writes through `OrderRepository`'s transaction
 * rather than opening a second one that would have to be coordinated with it.
 */

/** One sweep's worth. A backlog is finished by the next tick rather than in one long transaction. */
const EXPIRY_BATCH = 200;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly orders: OrderRepository,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * A callback from the provider (FR-PAY-05, FR-PAY-07). The provider decides whether the payload
   * is genuine and what it means; this method only knows it produced an event.
   */
  async handleCallback(paymentId: string, payload: unknown, signature?: string): Promise<PaymentStatus> {
    const payment = await this.require(paymentId);
    const event = await this.provider.parseCallback(payload, signature);

    return this.apply(payment, event, SYSTEM_AUDIT);
  }

  /**
   * The dev-only settlement (FR-PAY-05): ask the provider for the callback body it would send,
   * then hand that body straight back to it.
   *
   * Deliberately the long way round. Constructing a `PaymentEvent` here would settle the payment
   * just as well and would exercise none of the parsing, validation and mapping a real webhook
   * goes through — so the path a simulated payment takes is the path a real one will take, which
   * is the only reason a fake payment endpoint is worth having.
   */
  async simulate(paymentId: string, type: PaymentEventType): Promise<PaymentStatus> {
    const payment = await this.require(paymentId);

    if (!isSimulatable(this.provider)) {
      throw new ValidationError(`The ${this.provider.name} provider cannot simulate its own callbacks.`);
    }

    const payload = this.provider.simulateCallback(
      { providerRef: payment.providerRef ?? '', amountIdr: payment.amountIdr },
      type,
    );

    return this.handleCallback(paymentId, payload);
  }

  /**
   * An operator settling or writing off a payment from the order screen (FR-PAY-04). Addressed by
   * order number, because that is what an operator has in front of them.
   */
  async settleByOperator(orderNumber: string, status: 'PAID' | 'FAILED'): Promise<PaymentStatus> {
    const payment = await this.orders.findPaymentByOrderNumber(orderNumber);
    if (payment === null) throw new NotFoundError('That order has no payment to settle.', { orderNumber });

    return this.apply(payment, operatorEvent(status, payment, new Date()), ADMIN_AUDIT);
  }

  /**
   * Closes every payment whose window has passed, cancelling its order and releasing the stock it
   * held (FR-PAY-06, DoD §13.8).
   *
   * One transaction per payment, and a failure on one is logged and stepped over: a single order
   * in a state the machines refuse must not stop the other 199 from being released.
   */
  async expireDue(now: Date = new Date()): Promise<number> {
    const due = await this.orders.findDuePayments(now, EXPIRY_BATCH);
    let expired = 0;

    for (const payment of due) {
      try {
        await this.apply(payment, chargeExpiredEvent(payment.providerRef ?? '', payment.amountIdr, now), SYSTEM_AUDIT);
        expired += 1;
      } catch (cause) {
        this.logger.error({ orderNumber: payment.orderNumber, err: cause }, 'Could not expire payment');
      }
    }

    if (expired > 0) this.logger.log(`Expired ${expired} unpaid ${expired === 1 ? 'order' : 'orders'}.`);

    return expired;
  }

  /**
   * The one place a payment status is written.
   *
   * Every event is logged, including the ones that change nothing: the log is the record of what
   * happened to the charge, not of what we did about it (FR-PAY-07). An event restating the
   * status the payment is already in is a provider retrying its webhook — an ordinary thing that
   * must not be an error — so it is logged and otherwise ignored.
   */
  private async apply(payment: PaymentSummary, event: PaymentEvent, by: AuditActor): Promise<PaymentStatus> {
    return this.orders.transaction(async (unit) => {
      // Re-read under the lock: the status fetched a moment ago may already be stale.
      const locked = await unit.lockPayment(payment.paymentId);
      if (locked === null) throw new NotFoundError('That payment could not be found.');

      await unit.recordPaymentEvent(locked.paymentId, event);
      if (event.status === locked.status) return locked.status;

      const to = assertPaymentTransition(locked.status, event.status);
      await unit.applyPaymentStatus(locked.paymentId, to, event.occurredAt);

      const outcome = orderOutcomeOf(to);
      if (outcome !== null) {
        await transitionOrder(unit, locked.orderId, {
          to: outcome.orderStatus,
          by,
          note: outcome.note,
          cancelReason: outcome.cancelReason,
          // A payment outcome never dispatches goods, so its stock effect is only ever "give
          // the reservation back" or "leave it alone" — never "consume".
          stock: outcome.isAbandoned ? 'release' : 'hold',
          paidAt: to === 'PAID' ? event.occurredAt : undefined,
        });
      }

      return to;
    });
  }

  private async require(paymentId: string): Promise<PaymentSummary> {
    const payment = await this.orders.findPayment(paymentId);
    if (payment === null) throw new NotFoundError('That payment could not be found.', { paymentId });

    return payment;
  }
}
