/**
 * What a valid invite link authorises, as the review form needs it (FR-REV-02).
 *
 * Returned by `GET /reviews/invites/:token` so the form can be rendered on the server without
 * the page having to ask the customer which product they are reviewing — the token already knows,
 * and asking would let them answer wrongly.
 */
export interface ReviewInviteView {
  token: string;
  orderNumber: string;
  expiresAt: string;

  product: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
  };

  /**
   * Whether to show the build-specific fields (FR-REV-04). A nipper has no build time, and
   * asking for one is how a form teaches people that it was not written for what they bought.
   */
  isKit: boolean;

  /** Prefilled from the order's customer snapshot, and editable — a reviewer may want a handle. */
  suggestedAuthorName: string;
}
