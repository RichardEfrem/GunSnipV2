import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, type OrderStatus } from '@gunsnip/shared';
import { ORDER_MAIL } from './order-mail.js';
import type { OrderMailView } from './order-mail-view.js';

const ORIGIN = 'https://gunsnip.test';

function view(overrides: Partial<OrderMailView> = {}): OrderMailView {
  return {
    orderNumber: 'GS-260912-4471',
    status: 'PENDING_PAYMENT',
    customerName: 'Amuro',
    email: 'amuro@example.com',
    items: [
      { name: 'MG Barbatos', variantName: null, quantity: 1, lineTotalIdr: 1_250_000 },
      { name: 'God Hand Nipper', variantName: 'SPN-120', quantity: 2, lineTotalIdr: 900_000 },
    ],
    totals: { subtotalIdr: 2_150_000, discountIdr: 0, shippingIdr: 22_000, totalIdr: 2_172_000 },
    payment: {
      method: 'BANK_TRANSFER',
      amountIdr: 2_172_000,
      expiresAt: new Date('2026-09-13T10:00:00.000Z'),
      instructions: {
        channel: 'BCA Virtual Account',
        accountNumber: '8808 1234 5678',
        accountName: 'GunSnip',
        amountIdr: 2_172_000,
        steps: ['Open your banking app', 'Pay the exact amount'],
      },
    },
    shipment: null,
    reviewLinks: [],
    ...overrides,
  };
}

describe('ORDER_MAIL', () => {
  it('covers every order status, so a new one cannot silently send nothing', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_MAIL).toHaveProperty(status);
    }
  });

  it('sends exactly the four mails FR-NOTIF-01 asks for', () => {
    const mailed = ORDER_STATUSES.filter((status) => ORDER_MAIL[status] !== null);

    expect(mailed).toEqual(['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED']);
  });

  it.each(['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED'] satisfies OrderStatus[])(
    'names the order and links back to it in the %s mail',
    (status) => {
      const mail = ORDER_MAIL[status]?.(view({ status }), ORIGIN);

      expect(mail?.subject).toContain('GS-260912-4471');
      expect(mail?.text).toContain(`${ORIGIN}/orders/GS-260912-4471`);
    },
  );
});

describe('the order-placed mail', () => {
  const render = ORDER_MAIL.PENDING_PAYMENT;

  it('carries the payment instructions the provider worded', () => {
    const text = render?.(view(), ORIGIN).text ?? '';

    expect(text).toContain('BCA Virtual Account');
    expect(text).toContain('8808 1234 5678');
    expect(text).toContain('1. Open your banking app');
  });

  it('states the deadline as a time, because an unpaid order releases its stock', () => {
    const text = render?.(view(), ORIGIN).text ?? '';

    expect(text).toMatch(/Pay by .* WIB or the order is released\./);
  });

  it('formats money as whole rupiah, never a float', () => {
    const text = render?.(view(), ORIGIN).text ?? '';

    expect(text).toContain('Rp 2.172.000');
    expect(text).not.toMatch(/Rp [\d.]+,\d/);
  });

  it('leaves the discount line out when there is no discount', () => {
    expect(render?.(view(), ORIGIN).text).not.toContain('Discount');
  });

  it('shows the discount when there is one', () => {
    const discounted = view({
      totals: { subtotalIdr: 2_150_000, discountIdr: 150_000, shippingIdr: 22_000, totalIdr: 2_022_000 },
    });

    expect(render?.(discounted, ORIGIN).text).toContain('Discount');
  });

  it('still sends something useful when the provider left no instructions', () => {
    const noInstructions = view({
      payment: { ...view().payment!, instructions: null },
    });

    expect(render?.(noInstructions, ORIGIN).text).toContain('Rp 2.172.000');
  });
});

describe('the shipped mail', () => {
  it('gives the courier and the tracking number', () => {
    const shipped = view({
      status: 'SHIPPED',
      shipment: { courier: 'JNE', trackingNumber: 'JP1234567890', estimatedDays: 3 },
    });

    const text = ORDER_MAIL.SHIPPED?.(shipped, ORIGIN).text ?? '';

    expect(text).toContain('JNE');
    expect(text).toContain('JP1234567890');
    expect(text).toContain('within 3 days');
  });

  it('omits the tracking line when the courier gave no number', () => {
    const shipped = view({
      status: 'SHIPPED',
      shipment: { courier: 'JNE', trackingNumber: null, estimatedDays: 1 },
    });

    const text = ORDER_MAIL.SHIPPED?.(shipped, ORIGIN).text ?? '';

    expect(text).not.toContain('Tracking');
    expect(text).toContain('within 1 day');
  });
});

describe('the delivered mail', () => {
  it('carries a review link per delivered line — the only authorisation there is', () => {
    const delivered = view({
      status: 'DELIVERED',
      reviewLinks: [{ productName: 'MG Barbatos', url: `${ORIGIN}/review/tok-1` }],
    });

    const text = ORDER_MAIL.DELIVERED?.(delivered, ORIGIN).text ?? '';

    expect(text).toContain('MG Barbatos');
    expect(text).toContain(`${ORIGIN}/review/tok-1`);
  });

  it('says nothing about reviewing when there is nothing left to review', () => {
    const delivered = view({ status: 'DELIVERED', reviewLinks: [] });

    expect(ORDER_MAIL.DELIVERED?.(delivered, ORIGIN).text).not.toContain('/review/');
  });
});
