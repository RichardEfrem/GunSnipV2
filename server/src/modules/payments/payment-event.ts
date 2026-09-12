import type { PaymentEventType, PaymentStatus } from '@gunsnip/shared';
import type { PaymentEvent } from './provider/payment-provider.js';

/**
 * The events the store raises about a charge itself, rather than hearing from a provider
 * (FR-PAY-07).
 *
 * Three of them are ours by nature and will still be ours once a real gateway is wired in:
 * opening a charge, the expiry sweep closing one nobody paid (FR-PAY-06), and an operator
 * settling one by hand (FR-PAY-04). Each carries a `source`, so the log distinguishes what the
 * provider said from what we decided — a distinction that matters the first time a gateway and
 * this store disagree about whether an order was paid.
 *
 * A provider's own events do not come through here. They come from `parseCallback`, which is
 * what keeps the simulate endpoint honest: it exercises the webhook path, not this one.
 */
export type PaymentEventSource = 'store' | 'expiry_job' | 'operator';

/** The charge was opened when the order was created (FR-PAY-01). Changes no status. */
export function chargeCreatedEvent(providerRef: string, amountIdr: number, at: Date): PaymentEvent {
  return localEvent('CHARGE_CREATED', 'PENDING', { providerRef, amountIdr, at, source: 'store' });
}

/** The payment window closed with nothing received (FR-PAY-06). */
export function chargeExpiredEvent(providerRef: string, amountIdr: number, at: Date): PaymentEvent {
  return localEvent('CHARGE_EXPIRED', 'EXPIRED', { providerRef, amountIdr, at, source: 'expiry_job' });
}

/**
 * An operator moved the payment from the order screen (FR-PAY-04) — the Phase 0 way a bank
 * transfer is confirmed, and the way an unmatched one is written off.
 */
export function operatorEvent(status: 'PAID' | 'FAILED', charge: LocalCharge, at: Date): PaymentEvent {
  return localEvent(status === 'PAID' ? 'CHARGE_PAID' : 'CHARGE_FAILED', status, {
    ...charge,
    at,
    source: 'operator',
  });
}

export interface LocalCharge {
  /** Null until a provider has opened the charge; logged as null rather than invented. */
  providerRef: string | null;
  amountIdr: number;
}

function localEvent(
  type: PaymentEventType,
  status: PaymentStatus,
  input: LocalCharge & { at: Date; source: PaymentEventSource },
): PaymentEvent {
  return {
    type,
    providerRef: input.providerRef ?? '',
    status,
    amountIdr: input.amountIdr,
    occurredAt: input.at,
    payload: {
      event: type,
      source: input.source,
      provider_ref: input.providerRef,
      gross_amount: input.amountIdr,
      currency: 'IDR',
      occurred_at: input.at.toISOString(),
    },
  };
}
