import { cookies } from 'next/headers';
import { CHECKOUT_DRAFT_COOKIE, parseDraft, type CheckoutDraft } from './draft';

/** The draft the browser saved, read while the checkout page renders (FR-CO-10). */
export async function readCheckoutDraft(): Promise<CheckoutDraft> {
  // Promise-returning in Next 16.
  const store = await cookies();
  return parseDraft(store.get(CHECKOUT_DRAFT_COOKIE)?.value);
}
