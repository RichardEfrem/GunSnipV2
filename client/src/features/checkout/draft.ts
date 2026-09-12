import { z } from 'zod';
import { CHECKOUT_FIELD_LIMITS, PAYMENT_METHODS, SHIPPING_TIERS } from '@gunsnip/shared';

/**
 * The checkout draft (FR-CO-10): what the customer has typed and chosen, surviving a refresh.
 *
 * **Kept in a cookie scoped to `/checkout`, not in localStorage.** Both are client-side storage,
 * but only a cookie reaches the server — so the checkout page is *rendered* with the draft
 * already in it: the city and district lists for the saved address, the quote for the saved tier,
 * all fetched on the server as the page is built. localStorage would mean rendering an empty form,
 * reading the draft after hydration, and fetching in an effect to catch up (CLAUDE.md: no
 * `useEffect` for data fetching).
 *
 * The path keeps it off every other request, the API's included. It is readable by page script,
 * as localStorage would be — it holds what the customer typed into this page and nothing the page
 * did not already have — and it is deleted the moment the order is placed.
 *
 * Imported by both sides: the server reads it (`draft-server.ts`), the browser writes it
 * (`draft-cookie.ts`), and this schema is what either trusts.
 */
export const CHECKOUT_DRAFT_COOKIE = 'gs_checkout';
export const CHECKOUT_DRAFT_PATH = '/checkout';
/** A week: long enough to come back to an abandoned checkout, short enough not to linger. */
export const CHECKOUT_DRAFT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const text = (max: number) => z.string().max(max).catch('');
const regionId = z.uuid().nullable().catch(null);

/**
 * Every field falls back on its own (`.catch`), so one bad value costs that field rather than
 * the whole draft — an old cookie from before a field changed shape still restores the rest.
 */
export const checkoutDraftSchema = z.object({
  name: text(CHECKOUT_FIELD_LIMITS.name),
  email: text(CHECKOUT_FIELD_LIMITS.email),
  phone: text(32),
  provinceId: regionId,
  cityId: regionId,
  districtId: regionId,
  postalCode: text(5),
  street: text(CHECKOUT_FIELD_LIMITS.street),
  notes: text(CHECKOUT_FIELD_LIMITS.notes),
  shippingTier: z.enum(SHIPPING_TIERS).catch('REGULAR'),
  paymentMethod: z.enum(PAYMENT_METHODS).catch('BANK_TRANSFER'),
});

export type CheckoutDraft = z.infer<typeof checkoutDraftSchema>;

export const EMPTY_DRAFT: CheckoutDraft = checkoutDraftSchema.parse({});

export function parseDraft(raw: string | undefined): CheckoutDraft {
  if (raw === undefined) return EMPTY_DRAFT;

  try {
    return checkoutDraftSchema.parse(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return EMPTY_DRAFT;
  }
}

export function serializeDraft(draft: CheckoutDraft): string {
  return encodeURIComponent(JSON.stringify(draft));
}

/** The most specific region chosen so far — what the quote is asked for. */
export function draftRegionId(draft: CheckoutDraft): string | null {
  return draft.districtId ?? draft.cityId ?? draft.provinceId;
}
