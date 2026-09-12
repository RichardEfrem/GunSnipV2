import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../common/errors/validation.error.js';
import { MockPaymentProvider } from './mock-payment.provider.js';

/**
 * The Phase 0 provider. What is worth testing is the seam, not the fiction: that a charge is
 * reproducible, that the callback path round-trips, and that a malformed payload is refused
 * rather than settling something.
 */
const CHARGE = {
  orderNumber: 'GS-260912-A1B2',
  amountIdr: 1_285_000,
  method: 'VIRTUAL_ACCOUNT',
  expiresAt: new Date('2026-09-13T04:00:00.000Z'),
  customerName: 'Amuro Ray',
} as const;

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();

  it('derives the same account number from the same order every time', async () => {
    const first = await provider.createCharge(CHARGE);
    const second = await provider.createCharge(CHARGE);

    // A reloaded confirmation page must not show a different number to pay into.
    expect(first.providerRef).toBe(second.providerRef);
    expect(first.providerRef).toMatch(/^8\d{11}$/);
  });

  it('gives two orders different account numbers', async () => {
    const other = await provider.createCharge({ ...CHARGE, orderNumber: 'GS-260912-A1B3' });
    const mine = await provider.createCharge(CHARGE);

    expect(other.providerRef).not.toBe(mine.providerRef);
  });

  it('writes instructions naming the channel, the account and the exact amount (FR-PAY-03)', async () => {
    const { providerRef, instructions } = await provider.createCharge(CHARGE);

    expect(instructions).toMatchObject({
      channel: 'BCA Virtual Account',
      accountNumber: providerRef,
      amountIdr: CHARGE.amountIdr,
    });
    expect(instructions.steps.join(' ')).toContain(providerRef);
    expect(instructions.steps.join(' ')).toContain(CHARGE.orderNumber);
  });

  it('names the channel the customer chose', async () => {
    const wallet = await provider.createCharge({ ...CHARGE, method: 'E_WALLET' });
    expect(wallet.instructions.channel).toBe('GoPay');
  });

  it('round-trips its own callback back into an event (FR-PAY-05, FR-PAY-07)', async () => {
    const { providerRef } = await provider.createCharge(CHARGE);
    const payload = provider.simulateCallback({ providerRef, amountIdr: CHARGE.amountIdr }, 'CHARGE_PAID');

    const event = await provider.parseCallback(payload);

    expect(event).toMatchObject({
      type: 'CHARGE_PAID',
      status: 'PAID',
      providerRef,
      amountIdr: CHARGE.amountIdr,
    });
    // The body is logged exactly as it arrived, not as we would have written it.
    expect(event.payload).toEqual(payload);
  });

  it('maps each callback type to the status it leaves the charge in', async () => {
    const cases = [
      ['CHARGE_PAID', 'PAID'],
      ['CHARGE_FAILED', 'FAILED'],
      ['CHARGE_EXPIRED', 'EXPIRED'],
      ['CHARGE_REFUNDED', 'REFUNDED'],
      ['CHARGE_CREATED', 'PENDING'],
    ] as const;

    for (const [type, status] of cases) {
      const payload = provider.simulateCallback({ providerRef: '812345678901', amountIdr: 1 }, type);
      expect((await provider.parseCallback(payload)).status).toBe(status);
    }
  });

  it('refuses a payload that is not a callback', async () => {
    const bad: unknown[] = [
      null,
      'CHARGE_PAID',
      {},
      { event: 'CHARGE_WHATEVER', va_number: '8', gross_amount: 1, transaction_time: '2026-09-12' },
      { event: 'CHARGE_PAID', va_number: '8', gross_amount: '1', transaction_time: '2026-09-12' },
      { event: 'CHARGE_PAID', va_number: '8', gross_amount: 1, transaction_time: 'never' },
    ];

    for (const payload of bad) {
      await expect(provider.parseCallback(payload)).rejects.toThrow(ValidationError);
    }
  });

  it('produces a refund event the log can store like any other', async () => {
    const event = await provider.refund({ providerRef: '812345678901', amountIdr: 5_000 }, 5_000);

    expect(event).toMatchObject({ type: 'CHARGE_REFUNDED', status: 'REFUNDED', amountIdr: 5_000 });
  });
});
