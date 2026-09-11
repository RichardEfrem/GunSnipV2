/**
 * The answer to "tell me when this is back" (FR-PDP-12).
 *
 * Deliberately says nothing about whether this email had already registered. Confirming that
 * would turn the endpoint into an oracle for "is this address a customer of yours", which is
 * not a question an unauthenticated caller gets to ask.
 */
export interface NotifyRequestResult {
  /** Echoed so the confirmation can name what was registered without a second lookup. */
  variantId: string;
  /** Always true on success — the request is recorded, whether or not it was already. */
  isRegistered: boolean;
}
