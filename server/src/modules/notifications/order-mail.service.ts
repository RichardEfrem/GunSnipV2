import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OrderStatus } from '@gunsnip/shared';
import { AppConfig } from '../../config/app-config.js';
import { customerSnapshotSchema } from '../orders/entities/customer-snapshot.js';
import { paymentInstructionsSchema } from '../payments/entities/payment-instructions.schema.js';
import { ReviewInviteService } from '../reviews/review-invite.service.js';
import { ORDER_MAIL } from './mail/order-mail.js';
import type { OrderMailReviewLink, OrderMailView } from './mail/order-mail-view.js';
import { MAILER, type Mailer } from './mailer/mailer.js';
import { OrderMailRepository, type OrderMailRow } from './order-mail.repository.js';

/**
 * The transactional mail an order sends when its status changes (FR-NOTIF-01).
 *
 * Called **after** the transaction that moved the order has committed, never inside it. A mail
 * that failed inside the transaction would roll back a dispatch that physically happened, and a
 * mail sent inside one would go out for a transaction that then failed. Delivering the goods is
 * the fact; telling the customer about it is a consequence, and the two must not share a fate.
 *
 * For the same reason nothing here throws. A mail that cannot be sent is logged and stepped over:
 * an unreachable mail server is not a reason for an operator's "mark as shipped" to return 500
 * on an order that is already shipped.
 *
 * `notify` is the whole interface. Which statuses are worth a mail and what each one says lives
 * in `ORDER_MAIL`, so a call site never decides — it reports what happened and this decides.
 */
@Injectable()
export class OrderMailService {
  private readonly logger = new Logger(OrderMailService.name);

  constructor(
    private readonly orders: OrderMailRepository,
    private readonly invites: ReviewInviteService,
    private readonly config: AppConfig,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  async notify(orderId: string, status: OrderStatus): Promise<void> {
    const render = ORDER_MAIL[status];
    if (render === null) return;

    try {
      const row = await this.orders.findForMail(orderId);
      if (row === null) {
        this.logger.warn({ orderId, status }, 'No order to mail about');
        return;
      }

      const view = await this.toView(row, status);
      const message = render(view, this.config.clientOrigin);

      await this.mailer.send({ to: view.email, ...message });
    } catch (cause) {
      this.logger.error({ orderId, status, err: cause }, 'Could not send order mail');
    }
  }

  private async toView(row: OrderMailRow, status: OrderStatus): Promise<OrderMailView> {
    const snapshot = customerSnapshotSchema.parse(row.customerSnapshot);

    return {
      orderNumber: row.orderNumber,
      status,
      customerName: snapshot.name,
      email: snapshot.email,

      items: row.items.map((item) => ({
        name: item.productNameSnapshot,
        variantName: item.variantNameSnapshot,
        quantity: item.quantity,
        lineTotalIdr: item.lineTotalIdr,
      })),
      totals: {
        subtotalIdr: row.subtotalIdr,
        discountIdr: row.discountIdr,
        shippingIdr: row.shippingIdr,
        totalIdr: row.totalIdr,
      },

      payment:
        row.payment === null
          ? null
          : {
              method: row.payment.method,
              amountIdr: row.payment.amountIdr,
              expiresAt: row.payment.expiresAt,
              // Parsed rather than cast on the way out of JSONB, like everywhere else it is read.
              // A malformed row loses the "how to pay" block instead of printing `undefined` at
              // a customer — the rest of the mail is still worth sending.
              instructions: paymentInstructionsSchema.safeParse(row.payment.instructions).data ?? null,
            },
      shipment: row.shipment,

      reviewLinks: status === 'DELIVERED' ? await this.reviewLinks(row.id) : [],
    };
  }

  /**
   * Mints the invites for a delivered order and turns them into absolute links (FR-REV-02).
   *
   * Minting here, at the point the mail is composed, is deliberate: the token is only useful if
   * it reaches the customer, and issuing one in the delivery transaction that then failed to be
   * mailed would leave a credential nobody has. Issuing is idempotent, so a delivery notified
   * twice does not hand out two live links for one purchase.
   */
  private async reviewLinks(orderId: string): Promise<OrderMailReviewLink[]> {
    const issued = await this.invites.issueForOrder(orderId);

    return issued.map((invite) => ({
      productName: invite.productName,
      url: `${this.config.clientOrigin}/review/${invite.token}`,
    }));
  }
}
