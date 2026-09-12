import { Input } from '@/components/ui/Input';
import type { CheckoutForm } from '../hooks/use-checkout-form';
import { CheckoutSection } from './CheckoutSection';

/** 1 · Contact (FR-CO-03). The courier needs the phone; the receipt goes to the email. */
export function ContactSection({ form }: { form: CheckoutForm }) {
  const { draft, errors } = form;

  return (
    <CheckoutSection step={1} title="Contact">
      <div className="grid gap-4 md:grid-cols-2">
        <div data-field="name" className="md:col-span-2">
          <Input
            label="Full name"
            name="name"
            autoComplete="name"
            value={draft.name}
            error={errors.name}
            onChange={(event) => form.setText('name', event.target.value)}
            onBlur={() => form.blur('name')}
          />
        </div>

        <div data-field="email">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            hint="Your order confirmation goes here."
            value={draft.email}
            error={errors.email}
            onChange={(event) => form.setText('email', event.target.value)}
            onBlur={() => form.blur('email')}
          />
        </div>

        <div data-field="phone">
          <Input
            label="Mobile number"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            hint="The courier calls this on delivery."
            value={draft.phone}
            error={errors.phone}
            onChange={(event) => form.setText('phone', event.target.value)}
            onBlur={() => form.blur('phone')}
          />
        </div>
      </div>
    </CheckoutSection>
  );
}
