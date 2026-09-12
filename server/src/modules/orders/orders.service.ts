import { Injectable } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { auditActor } from './audit-actor.js';
import { customerSnapshotSchema } from './entities/customer-snapshot.js';
import type { OrderView } from './entities/order.entity.js';
import { canAccessOrder } from './order-access.js';
import { toOrderView } from './order-mapper.js';
import { transitionOrder } from './order-transition.js';
import { OrderRepository, type OrderRecord } from './order.repository.js';

/**
 * A placed order, for the customer who placed it (FR-ORD-02 … FR-ORD-06).
 *
 * Takes an `Actor` and, optionally, the email the order was placed with — never a user id
 * (CLAUDE.md non-negotiable #6). Who may see an order is `canAccessOrder`; what may happen to it
 * next is the state machine. This service only puts the two in front of the repository.
 */
@Injectable()
export class OrdersService {
  constructor(private readonly orders: OrderRepository) {}

  async view(actor: Actor, orderNumber: string, email: string | undefined): Promise<OrderView> {
    return toOrderView(await this.requireAccessible(actor, orderNumber, email));
  }

  /**
   * Buyer cancellation (FR-ORD-04, DoD §13.6): the order moves to CANCELLED, the stock it reserved
   * becomes available again, the voucher use is given back, and the change is recorded with who
   * made it (FR-ORD-06) — in one transaction.
   *
   * Only while awaiting payment. That rule is the state machine's, asked inside `transitionOrder`
   * *after* the order row is locked: two cancels racing, or a cancel racing the payment settling,
   * see the status the other left behind rather than the one they read before it.
   *
   * The payment row is left as it is. A customer cancelling does not make the charge fail — it
   * simply goes unpaid, and the expiry sweep closes it (FR-PAY-06).
   */
  async cancel(actor: Actor, orderNumber: string, email: string | undefined): Promise<OrderView> {
    const record = await this.requireAccessible(actor, orderNumber, email);

    await this.orders.transaction(async (unit) => {
      await transitionOrder(unit, record.id, {
        to: 'CANCELLED',
        by: auditActor(actor),
        note: 'Cancelled by the customer.',
        cancelReason: 'Cancelled by the customer before payment.',
        isAbandoned: true,
      });
    });

    return this.view(actor, orderNumber, email);
  }

  private async requireAccessible(actor: Actor, orderNumber: string, email: string | undefined): Promise<OrderRecord> {
    const record = await this.orders.findByNumber(orderNumber);

    // One answer for "no such order" and "not yours", so the endpoint cannot be used to learn
    // which order numbers exist.
    const isAccessible =
      record !== null &&
      canAccessOrder(
        {
          sessionId: record.sessionId,
          userId: record.userId,
          email: customerSnapshotSchema.parse(record.customerSnapshot).email,
        },
        actor,
        email,
      );

    if (!isAccessible) {
      throw new NotFoundError("We couldn't find an order with that number and email.", { orderNumber });
    }

    return record;
  }
}
