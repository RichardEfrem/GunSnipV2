'use client';

import type { PaymentMethod, ShippingTier } from '@gunsnip/shared';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { writeDraftCookie } from '../draft-cookie';
import type { CheckoutDraft } from '../draft';
import type { Region } from '../schema';
import { CHECKOUT_FIELDS, validateAll, validateField, type CheckoutField, type FieldErrors } from '../validation';

/**
 * The checkout form's state (FR-CO-03, FR-CO-06, FR-CO-10).
 *
 * Two kinds of change, handled differently on purpose:
 *
 * - **Typing** stays in the browser. The draft cookie is rewritten so a refresh keeps it
 *   (FR-CO-10), and the field is checked when the customer leaves it — on blur, not per keystroke
 *   (DESIGN.md §4.4).
 * - **Choosing where and how it ships** — a province, a city, a district, a courier tier — changes
 *   the price. The cookie is written and the page is re-rendered on the server, which reads it and
 *   sends back the region lists and a fresh quote. The browser never works out a shipping cost or
 *   a total; it asks the server to redraw the summary (CLAUDE.md non-negotiable #2), and the
 *   form's own state survives the refresh because the component stays mounted.
 */
interface CheckoutFormOptions {
  initialDraft: CheckoutDraft;
  cities: readonly Region[];
}

export interface CheckoutForm {
  draft: CheckoutDraft;
  errors: FieldErrors;
  /** True from an address or tier change until the server's new quote has rendered. */
  isRequoting: boolean;
  cityHasDistricts: boolean;
  setText: (field: TextField, value: string) => void;
  blur: (field: CheckoutField) => void;
  chooseProvince: (provinceId: string) => void;
  chooseCity: (city: Region) => void;
  chooseDistrict: (districtId: string) => void;
  chooseTier: (tier: ShippingTier) => void;
  choosePaymentMethod: (method: PaymentMethod) => void;
  /** Checks every field; returns the invalid ones in page order, empty when the form can submit. */
  validate: () => CheckoutField[];
}

type TextField = 'name' | 'email' | 'phone' | 'postalCode' | 'street' | 'notes';

export function useCheckoutForm({ initialDraft, cities }: CheckoutFormOptions): CheckoutForm {
  const router = useRouter();
  const [isRequoting, startRequote] = useTransition();
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<FieldErrors>({});

  const cityHasDistricts = cities.find((city) => city.id === draft.cityId)?.hasChildren ?? false;
  const context = { cityHasDistricts };

  function save(next: CheckoutDraft): void {
    setDraft(next);
    writeDraftCookie(next);
  }

  /** Saves, then redraws the page from the server, which reads the new draft from the cookie. */
  function requote(next: CheckoutDraft, clearErrors: readonly CheckoutField[]): void {
    save(next);
    setErrors((current) => omit(current, clearErrors));
    startRequote(() => router.refresh());
  }

  return {
    draft,
    errors,
    isRequoting,
    cityHasDistricts,

    setText: (field, value) => {
      save({ ...draft, [field]: value });
      // A field already showing an error re-checks as it is corrected, so the message goes the
      // moment it is no longer true — but a clean field is not judged until the customer leaves it.
      if (errors[field] !== undefined) {
        setErrors((current) => ({ ...current, [field]: validateField(field, { ...draft, [field]: value }, context) }));
      }
    },

    blur: (field) => setErrors((current) => ({ ...current, [field]: validateField(field, draft, context) })),

    chooseProvince: (provinceId) =>
      requote({ ...draft, provinceId, cityId: null, districtId: null }, ['provinceId', 'cityId', 'districtId']),

    chooseCity: (city) => {
      const previous = cities.find((candidate) => candidate.id === draft.cityId);
      // Prefill the postal code from the city, unless the customer typed one of their own.
      const isPostalCodeUntouched = draft.postalCode === '' || draft.postalCode === previous?.postalCode;
      const postalCode = isPostalCodeUntouched ? (city.postalCode ?? draft.postalCode) : draft.postalCode;

      requote({ ...draft, cityId: city.id, districtId: null, postalCode }, ['cityId', 'districtId', 'postalCode']);
    },

    chooseDistrict: (districtId) => requote({ ...draft, districtId }, ['districtId']),

    chooseTier: (shippingTier) => requote({ ...draft, shippingTier }, []),

    // The method does not change the price, so it is saved without a re-render.
    choosePaymentMethod: (paymentMethod) => save({ ...draft, paymentMethod }),

    validate: () => {
      const next = validateAll(draft, context);
      setErrors(next);
      return CHECKOUT_FIELDS.filter((field) => next[field] !== undefined);
    },
  };
}

function omit(errors: FieldErrors, fields: readonly CheckoutField[]): FieldErrors {
  const next = { ...errors };
  for (const field of fields) delete next[field];
  return next;
}
