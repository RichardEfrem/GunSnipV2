import { RadioGroup } from '@/components/ui/RadioGroup';
import { formatDeliveryPromise, formatIdr } from '@/lib/formatters';
import { SHIPPING_TIER_LABELS } from '@/lib/labels';
import type { CheckoutForm } from '../hooks/use-checkout-form';
import type { CheckoutQuote } from '../schema';
import { CheckoutSection } from './CheckoutSection';

/**
 * 3 · Delivery (FR-CO-04): the flat courier tiers the address's zone is offered, with cost and
 * days. Same-day appears only where it exists — the server sends only the tiers the zone has.
 */
interface DeliverySectionProps {
  form: CheckoutForm;
  delivery: CheckoutQuote['delivery'];
}

export function DeliverySection({ form, delivery }: DeliverySectionProps) {
  return (
    <CheckoutSection step={3} title="Delivery">
      {delivery === null ? (
        <p className="text-sm text-frame-300">Choose a province to see delivery options and prices.</p>
      ) : delivery.options.length === 0 ? (
        <p className="text-sm text-frame-300">No courier delivers to this area yet.</p>
      ) : (
        <RadioGroup
          legend="Delivery option"
          isLegendHidden
          name="shippingTier"
          // The tier asked for while its re-quote is on the way; otherwise the one the server priced.
          value={
            delivery.options.some((option) => option.tier === form.draft.shippingTier)
              ? form.draft.shippingTier
              : (delivery.selected?.tier ?? null)
          }
          onValueChange={form.chooseTier}
          options={delivery.options.map((option) => ({
            value: option.tier,
            label: SHIPPING_TIER_LABELS[option.tier],
            description: formatDeliveryPromise(option.minDays, option.maxDays),
            detail: formatIdr(option.priceIdr),
          }))}
        />
      )}
    </CheckoutSection>
  );
}
