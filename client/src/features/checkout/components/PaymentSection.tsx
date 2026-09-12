import type { PaymentMethod } from '@gunsnip/shared';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { PAYMENT_METHOD_LABELS } from '@/lib/labels';
import type { CheckoutForm } from '../hooks/use-checkout-form';
import { CheckoutSection } from './CheckoutSection';

/**
 * 4 · Payment (FR-PAY-02). This screen is final (DESIGN.md §3.7): the method is stored with the
 * order, and swapping the mock for a real gateway changes what happens *after* "Place order", not
 * this list.
 */
const METHOD_DESCRIPTIONS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Pay from any Indonesian bank account.',
  VIRTUAL_ACCOUNT: 'A one-time account number for this order.',
  E_WALLET: 'Pay from your e-wallet app.',
};

const OPTIONS = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => ({
  value: method,
  label: PAYMENT_METHOD_LABELS[method],
  description: METHOD_DESCRIPTIONS[method],
}));

export function PaymentSection({ form }: { form: CheckoutForm }) {
  return (
    <CheckoutSection step={4} title="Payment">
      <RadioGroup
        legend="Payment method"
        isLegendHidden
        name="paymentMethod"
        value={form.draft.paymentMethod}
        onValueChange={form.choosePaymentMethod}
        options={OPTIONS}
      />
      <p className="text-xs text-frame-300">Payment details appear once the order is placed.</p>
    </CheckoutSection>
  );
}
