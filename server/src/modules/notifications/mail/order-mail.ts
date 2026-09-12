import type { OrderStatus } from '@gunsnip/shared';
import type { MailMessage } from '../mailer/mailer.js';
import { formatIdr, formatJakarta, padLabel } from './mail-format.js';
import type { OrderMailView } from './order-mail-view.js';

/**
 * The transactional mails an order sends, as a table keyed by the status that triggers them
 * (FR-NOTIF-01: placed, payment received, shipped, delivered).
 *
 * A table for the same reason `FULFILMENT_EFFECTS` is one: the alternative is a `switch` inside
 * the notification service, and the moment a status is added to the enum that switch silently
 * does nothing. Every status maps to an entry — `null` where no mail is owed — so a new status
 * is a compile error until somebody decides whether the customer hears about it.
 *
 * Pure. A renderer takes a view and an origin and returns strings, which is what makes the mails
 * testable without a transport and what keeps the decision of *whether* to send separate from
 * the decision of *what to say*.
 */
export type OrderMailRenderer = (view: OrderMailView, storefrontOrigin: string) => Omit<MailMessage, 'to'>;

export const ORDER_MAIL: Readonly<Record<OrderStatus, OrderMailRenderer | null>> = {
  PENDING_PAYMENT: renderOrderPlaced,
  PAID: renderPaymentReceived,
  SHIPPED: renderShipped,
  DELIVERED: renderDelivered,

  // Silence, on purpose. Packing and completion are internal bookkeeping the customer already
  // infers from the two mails either side of them, and a mail per status turns a shop into a
  // nuisance. Cancellation, expiry and refunds are Phase 1's: each needs wording that depends on
  // *why* it happened — a buyer cancelling, a window closing and a refund being issued are three
  // different letters, and one generic "your order changed" would be worse than none.
  PACKING: null,
  COMPLETED: null,
  CANCELLED: null,
  EXPIRED: null,
  REFUNDED: null,
};

function renderOrderPlaced(view: OrderMailView, origin: string): Omit<MailMessage, 'to'> {
  const payment = view.payment;

  return {
    subject: `Order ${view.orderNumber} received — please complete payment`,
    text: [
      greeting(view),
      `Thanks for your order. We have it, and we are holding the stock for you until payment clears.`,
      '',
      lines(view),
      '',
      totals(view),
      '',
      ...(payment === null
        ? []
        : [
            `HOW TO PAY`,
            ...(payment.instructions === null
              ? [`  ${formatIdr(payment.amountIdr)} — instructions follow separately.`]
              : [
                  `  ${payment.instructions.channel}`,
                  `  ${payment.instructions.accountNumber}  (${payment.instructions.accountName})`,
                  `  ${formatIdr(payment.instructions.amountIdr)}`,
                  '',
                  ...payment.instructions.steps.map((step, index) => `  ${index + 1}. ${step}`),
                ]),
            '',
            // The deadline is the single most consequential line in this mail: an unpaid order
            // auto-cancels and gives its stock back (FR-PAY-06), so it is stated as a time, not
            // as "within 24 hours" that the reader has to add to a moment they have forgotten.
            `  Pay by ${formatJakarta(payment.expiresAt)} or the order is released.`,
            '',
          ]),
      track(view, origin),
      signature(),
    ].join('\n'),
  };
}

function renderPaymentReceived(view: OrderMailView, origin: string): Omit<MailMessage, 'to'> {
  return {
    subject: `Payment received for ${view.orderNumber}`,
    text: [
      greeting(view),
      `Your payment of ${formatIdr(view.totals.totalIdr)} has cleared. We are packing your order now.`,
      '',
      lines(view),
      '',
      track(view, origin),
      signature(),
    ].join('\n'),
  };
}

function renderShipped(view: OrderMailView, origin: string): Omit<MailMessage, 'to'> {
  const shipment = view.shipment;

  return {
    subject: `${view.orderNumber} is on its way`,
    text: [
      greeting(view),
      `Your order has left us.`,
      '',
      ...(shipment === null
        ? []
        : [
            `  Courier    ${shipment.courier}`,
            ...(shipment.trackingNumber === null ? [] : [`  Tracking   ${shipment.trackingNumber}`]),
            ...(shipment.estimatedDays === null
              ? []
              : [`  Expected   within ${shipment.estimatedDays} day${shipment.estimatedDays === 1 ? '' : 's'}`]),
            '',
          ]),
      lines(view),
      '',
      track(view, origin),
      signature(),
    ].join('\n'),
  };
}

function renderDelivered(view: OrderMailView, origin: string): Omit<MailMessage, 'to'> {
  return {
    subject: `${view.orderNumber} delivered — how did the build go?`,
    text: [
      greeting(view),
      `Your order has been delivered. We hope the build goes well.`,
      '',
      // The links are the *only* way to review in Phase 0 (FR-REV-02) — there is no account to
      // log into — so this mail is not a nicety, it is the authorisation.
      ...(view.reviewLinks.length === 0
        ? []
        : [
            `Once you have built it, tell the next builder what it was like:`,
            '',
            ...view.reviewLinks.flatMap((link) => [`  ${link.productName}`, `  ${link.url}`, '']),
            `Each link works once, and only for you.`,
            '',
          ]),
      track(view, origin),
      signature(),
    ].join('\n'),
  };
}

function greeting(view: OrderMailView): string {
  return `Hi ${view.customerName},\n`;
}

function lines(view: OrderMailView): string {
  return [
    `ORDER ${view.orderNumber}`,
    ...view.items.map(
      (item) =>
        `  ${item.quantity} × ${item.name}${item.variantName === null ? '' : ` — ${item.variantName}`}` +
        `   ${formatIdr(item.lineTotalIdr)}`,
    ),
  ].join('\n');
}

function totals(view: OrderMailView): string {
  return [
    `  ${padLabel('Subtotal')}${formatIdr(view.totals.subtotalIdr)}`,
    // Printed only when there is one: a "Discount Rp 0" line invites the reader to wonder what
    // they missed.
    ...(view.totals.discountIdr > 0 ? [`  ${padLabel('Discount')}−${formatIdr(view.totals.discountIdr)}`] : []),
    `  ${padLabel('Shipping')}${formatIdr(view.totals.shippingIdr)}`,
    `  ${padLabel('Total')}${formatIdr(view.totals.totalIdr)}`,
  ].join('\n');
}

function track(view: OrderMailView, origin: string): string {
  return `Track this order: ${origin}/orders/${view.orderNumber}\n`;
}

function signature(): string {
  return `— GunSnip`;
}
