import { z } from 'zod';
import { CHECKOUT_FIELD_LIMITS, PHONE_PATTERN, POSTAL_CODE_PATTERN } from '@gunsnip/shared';
import type { CheckoutDraft } from './draft';

/**
 * Field-level checks for the checkout form (FR-CO-06, DESIGN.md §4.4).
 *
 * The same patterns and limits `POST /orders` enforces, imported from `@gunsnip/shared`, so a
 * field this passes is a field the API accepts. The API still checks everything — this exists so
 * the customer hears about a mistake beside the field, on blur, rather than after a round trip.
 *
 * Messages say what to type, not that something is wrong (DESIGN.md §5).
 */
export const CHECKOUT_FIELDS = [
  'name',
  'email',
  'phone',
  'provinceId',
  'cityId',
  'districtId',
  'postalCode',
  'street',
  'notes',
] as const;

/** In page order — the order focus moves in when a submit finds more than one mistake. */
export type CheckoutField = (typeof CHECKOUT_FIELDS)[number];

export type FieldErrors = Partial<Record<CheckoutField, string>>;

const required = (message: string) => z.string().trim().min(1, message);

const FIELD_SCHEMAS: Record<Exclude<CheckoutField, 'districtId'>, z.ZodType> = {
  name: required('Enter the name the parcel is addressed to.').max(
    CHECKOUT_FIELD_LIMITS.name,
    `Keep the name under ${CHECKOUT_FIELD_LIMITS.name} characters.`,
  ),
  email: z.email('Enter an email address, like amuro@example.com.').max(CHECKOUT_FIELD_LIMITS.email),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s().-]/g, ''))
    .pipe(z.string().regex(PHONE_PATTERN, 'Enter an Indonesian mobile number, like 0812 3456 7890.')),
  provinceId: z.string('Choose a province.'),
  cityId: z.string('Choose a city.'),
  postalCode: z.string().trim().regex(POSTAL_CODE_PATTERN, 'Enter the five-digit postal code.'),
  street: required('Enter the street, building and house number.')
    .min(5, 'Enter the street, building and house number.')
    .max(CHECKOUT_FIELD_LIMITS.street, `Keep the address under ${CHECKOUT_FIELD_LIMITS.street} characters.`),
  notes: z.string().max(CHECKOUT_FIELD_LIMITS.notes, `Keep notes under ${CHECKOUT_FIELD_LIMITS.notes} characters.`),
};

/**
 * One field's message, or undefined when it is fine.
 *
 * `cityHasDistricts` is the one piece of context a field needs: a district is required only where
 * the region tree lists districts for the chosen city.
 */
export function validateField(
  field: CheckoutField,
  draft: CheckoutDraft,
  context: { cityHasDistricts: boolean },
): string | undefined {
  if (field === 'districtId') {
    return context.cityHasDistricts && draft.districtId === null ? 'Choose a district.' : undefined;
  }

  const result = FIELD_SCHEMAS[field].safeParse(draft[field] ?? undefined);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function validateAll(draft: CheckoutDraft, context: { cityHasDistricts: boolean }): FieldErrors {
  const errors: FieldErrors = {};

  for (const field of CHECKOUT_FIELDS) {
    const message = validateField(field, draft, context);
    if (message !== undefined) errors[field] = message;
  }

  return errors;
}
