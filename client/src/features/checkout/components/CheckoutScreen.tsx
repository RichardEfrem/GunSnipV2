'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { CheckoutDraft } from '../draft';
import { useCheckoutForm } from '../hooks/use-checkout-form';
import { usePlaceOrder } from '../hooks/use-place-order';
import type { CheckoutQuote, Region } from '../schema';
import type { CheckoutField } from '../validation';
import { AddressSection } from './AddressSection';
import { CheckoutSummary } from './CheckoutSummary';
import { ContactSection } from './ContactSection';
import { DeliverySection } from './DeliverySection';
import { MobileOrderBar } from './MobileOrderBar';
import { PaymentSection } from './PaymentSection';

/**
 * The single-page checkout (FR-CO-02, DESIGN.md §3.7): four numbered sections on the left, the
 * summary on the right, one form around both so either "Place order" button submits it.
 *
 * The client boundary for the page. Everything priced — lines, delivery options, totals — arrives
 * as `quote` from the server render and is replaced wholesale when an address or tier change
 * redraws it. What lives here is what the customer is typing and whether the order is being sent.
 */
interface CheckoutScreenProps {
  quote: CheckoutQuote;
  draft: CheckoutDraft;
  provinces: readonly Region[];
  cities: readonly Region[];
  districts: readonly Region[];
}

export function CheckoutScreen({ quote, draft, provinces, cities, districts }: CheckoutScreenProps) {
  const form = useCheckoutForm({ initialDraft: draft, cities });
  const order = usePlaceOrder();
  const formRef = useRef<HTMLFormElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const selected = quote.delivery?.selected ?? null;
  const blockedReason = form.isRequoting
    ? 'Updating the total'
    : quote.delivery !== null && selected === null
      ? 'No courier delivers to this address yet'
      : null;

  function focusField(field: CheckoutField): void {
    formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"] :is(input, button)`)?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (blockedReason !== null || order.isPlacing) return;

    const invalid = form.validate();
    // FR-CO-06: move to the first mistake and say how many there are (DESIGN.md §4.4).
    if (invalid[0] !== undefined) {
      setAnnouncement(`${invalid.length} ${invalid.length === 1 ? 'field needs' : 'fields need'} attention.`);
      focusField(invalid[0]);
      return;
    }

    // Validation guarantees an address; the quote for it guarantees a priced tier.
    if (quote.delivery === null || selected === null) return;
    setAnnouncement('');

    const { draft: values } = form;
    void order.place({
      contact: { name: values.name, email: values.email, phone: values.phone },
      address: {
        // The region the summary was priced for, so the order and the quote cannot disagree.
        regionId: quote.delivery.regionId,
        postalCode: values.postalCode,
        street: values.street,
        ...(values.notes.trim() === '' ? {} : { notes: values.notes }),
      },
      shippingTier: selected.tier,
      paymentMethod: values.paymentMethod,
      items: quote.lines.map((line) => ({ cartLineId: line.cartLineId, quantity: line.quantity })),
      expectedTotalIdr: quote.totals.totalIdr,
    });
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start"
    >
      <div className="flex flex-col gap-6">
        <ContactSection form={form} />
        <AddressSection form={form} provinces={provinces} cities={cities} districts={districts} />
        <DeliverySection form={form} delivery={quote.delivery} />
        <PaymentSection form={form} />
      </div>

      {/* Below the sections on mobile, where the pinned bar carries the total and the button;
          a sticky sidebar from `lg`, so the total never scrolls away (FR-CO-05). */}
      <aside className="lg:sticky lg:top-20">
        <CheckoutSummary
          quote={quote}
          isPending={form.isRequoting}
          isPlacing={order.isPlacing}
          blockedReason={blockedReason}
          error={order.error}
        />
      </aside>

      <MobileOrderBar
        quote={quote}
        isPending={form.isRequoting}
        isPlacing={order.isPlacing}
        blockedReason={blockedReason}
        error={order.error}
      />

      <p className="sr-only" role="alert">
        {announcement}
      </p>
    </form>
  );
}
