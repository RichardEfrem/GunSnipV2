import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PaymentEventType, PaymentMethod, PaymentStatus } from '@gunsnip/shared';
import { ValidationError } from '../../../common/errors/validation.error.js';
import {
  type ChargeRequest,
  type JsonObject,
  type ChargeResult,
  type PaymentEvent,
  type PaymentInstructions,
  type RefundRequest,
  type SimulatablePaymentProvider,
} from './payment-provider.js';

/**
 * The Phase 0 payment provider (PRD §11.3): a virtual account that looks real, takes no money,
 * and is settled by the dev endpoint (FR-PAY-05) or by an operator (FR-PAY-04).
 *
 * Deterministic — the account number is derived from the order number — so a customer who
 * reloads the confirmation page sees the same number, and a test can assert one without
 * capturing it first. Nothing here reaches the network, which is the only reason it is safe to
 * call `createCharge` inside the order transaction; a gateway that makes a request would have to
 * be charged after the commit instead.
 */

/** Fictional, and recognisably so: no real Indonesian bank issues an 8-prefixed 12-digit VA. */
const VA_PREFIX = '8';
const VA_DIGITS = 11;
const MERCHANT_NAME = 'PT GunSnip Indonesia';

const CHANNELS: Readonly<Record<PaymentMethod, string>> = {
  BANK_TRANSFER: 'Bank Transfer (BCA)',
  VIRTUAL_ACCOUNT: 'BCA Virtual Account',
  E_WALLET: 'GoPay',
};

/** The status each callback type leaves the charge in — the mock's half of the webhook contract. */
const EVENT_STATUSES: Readonly<Record<PaymentEventType, PaymentStatus>> = {
  CHARGE_CREATED: 'PENDING',
  CHARGE_PAID: 'PAID',
  CHARGE_FAILED: 'FAILED',
  CHARGE_EXPIRED: 'EXPIRED',
  CHARGE_REFUNDED: 'REFUNDED',
};

@Injectable()
export class MockPaymentProvider implements SimulatablePaymentProvider {
  readonly name = 'mock';

  async createCharge(order: ChargeRequest): Promise<ChargeResult> {
    const providerRef = virtualAccountNumber(order.orderNumber);

    return {
      providerRef,
      instructions: instructionsFor(order, providerRef),
    };
  }

  /**
   * A real gateway verifies the signature and trusts nothing else. The mock has no secret to
   * sign with, so it validates the shape and ignores `signature` — the point of routing the dev
   * endpoint through here is that the *path* is the real one, not that the payload is.
   */
  async parseCallback(payload: unknown): Promise<PaymentEvent> {
    const callback = readCallback(payload);

    return {
      type: callback.event,
      providerRef: callback.va_number,
      status: EVENT_STATUSES[callback.event],
      amountIdr: callback.gross_amount,
      occurredAt: new Date(callback.transaction_time),
      payload: callback,
    };
  }

  /** The body this provider would send for `type` — what the dev endpoint replays (FR-PAY-05). */
  simulateCallback(charge: RefundRequest, type: PaymentEventType): JsonObject {
    return callbackPayload(type, charge.providerRef, charge.amountIdr, new Date());
  }

  async refund(charge: RefundRequest, amountIdr: number): Promise<PaymentEvent> {
    const occurredAt = new Date();

    return {
      type: 'CHARGE_REFUNDED',
      providerRef: charge.providerRef,
      status: 'REFUNDED',
      amountIdr,
      occurredAt,
      payload: callbackPayload('CHARGE_REFUNDED', charge.providerRef, amountIdr, occurredAt),
    };
  }
}

/**
 * The webhook body this provider "sends". Built here as well as parsed here, so the dev endpoint
 * and the refund path produce exactly what `parseCallback` expects rather than a second shape
 * that happens to work (FR-PAY-05, FR-PAY-07).
 *
 * Snake-cased and flat, the way gateways in this market write them.
 */
export function callbackPayload(
  event: PaymentEventType,
  virtualAccount: string,
  amountIdr: number,
  occurredAt: Date,
): JsonObject {
  return {
    event,
    va_number: virtualAccount,
    gross_amount: amountIdr,
    currency: 'IDR',
    transaction_time: occurredAt.toISOString(),
    // A real gateway's own id for the notification, distinct from the charge's.
    transaction_id: createHash('sha256')
      .update(`${virtualAccount}:${event}:${occurredAt.toISOString()}`)
      .digest('hex')
      .slice(0, 32),
  };
}

interface MockCallback extends JsonObject {
  event: PaymentEventType;
  va_number: string;
  gross_amount: number;
  transaction_time: string;
}

/**
 * Validation at the boundary (CLAUDE.md non-negotiable #4): the argument is `unknown` because a
 * webhook body is, and everything after this line can rely on the shape.
 */
function readCallback(payload: unknown): MockCallback {
  if (typeof payload !== 'object' || payload === null) {
    throw new ValidationError('The payment callback body is not an object.');
  }

  const body = payload as JsonObject;
  const { event, va_number: virtualAccount, gross_amount: amount, transaction_time: time } = body;

  if (typeof event !== 'string' || !(event in EVENT_STATUSES)) {
    throw new ValidationError('The payment callback names no known event.', { event });
  }

  if (typeof virtualAccount !== 'string' || typeof amount !== 'number' || typeof time !== 'string') {
    throw new ValidationError('The payment callback is missing its charge, amount or time.');
  }

  if (Number.isNaN(Date.parse(time))) {
    throw new ValidationError('The payment callback has an unreadable transaction time.', { time });
  }

  return { ...body, event: event as PaymentEventType, va_number: virtualAccount, gross_amount: amount, transaction_time: time };
}

/**
 * Twelve digits from the order number. A hash rather than a counter so two orders placed a
 * second apart do not get adjacent accounts, and stable so the page can be reloaded.
 */
function virtualAccountNumber(orderNumber: string): string {
  const digits = BigInt(`0x${createHash('sha256').update(orderNumber).digest('hex').slice(0, 16)}`)
    .toString()
    .slice(0, VA_DIGITS)
    .padStart(VA_DIGITS, '0');

  return `${VA_PREFIX}${digits}`;
}

function instructionsFor(order: ChargeRequest, virtualAccount: string): PaymentInstructions {
  return {
    channel: CHANNELS[order.method],
    accountNumber: virtualAccount,
    accountName: MERCHANT_NAME,
    amountIdr: order.amountIdr,
    steps: [
      `Open your banking or e-wallet app and choose ${CHANNELS[order.method]}.`,
      `Enter the account number ${virtualAccount}.`,
      `Check that the name shown is ${MERCHANT_NAME}, then pay the exact amount.`,
      `Keep the receipt — your order ${order.orderNumber} updates within a few minutes of payment.`,
    ],
  };
}
