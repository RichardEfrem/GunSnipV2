import {
  CHECKOUT_DRAFT_COOKIE,
  CHECKOUT_DRAFT_MAX_AGE_SECONDS,
  CHECKOUT_DRAFT_PATH,
  serializeDraft,
  type CheckoutDraft,
} from './draft';

/**
 * Writing the draft from the browser (FR-CO-10). Synchronous, so a `router.refresh()` issued on
 * the next line already carries the new value to the server.
 */
export function writeDraftCookie(draft: CheckoutDraft): void {
  document.cookie = cookie(serializeDraft(draft), CHECKOUT_DRAFT_MAX_AGE_SECONDS);
}

/** Called the moment an order is placed: a placed order's address has no business being a draft. */
export function clearDraftCookie(): void {
  document.cookie = cookie('', 0);
}

function cookie(value: string, maxAge: number): string {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  return `${CHECKOUT_DRAFT_COOKIE}=${value}; path=${CHECKOUT_DRAFT_PATH}; max-age=${maxAge}; samesite=lax${secure}`;
}
