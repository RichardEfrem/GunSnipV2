import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The token in a review invite link (FR-REV-02).
 *
 * In Phase 0 this token *is* the authorisation: there is no account to log into, so possession
 * of the link is what proves the reviewer bought the thing. That makes it a credential, and it
 * is sized like one — 32 random bytes from the CSPRNG, which is not guessable at any rate an
 * attacker can reach and not enumerable at any rate a rate limiter would miss.
 *
 * `base64url` so it survives being a path segment, a query parameter and a line in a plain-text
 * email that a mail client might helpfully "fix" — none of `+`, `/` or `=` appear.
 */
const TOKEN_BYTES = 32;

export function mintReviewToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * How long a link stays usable. Long enough that a kit bought as a present and built over a
 * holiday can still be reviewed; short enough that a link forwarded or left in an old mailbox
 * does not stay a live credential forever.
 */
export const INVITE_LIFETIME_DAYS = 90;

export function inviteExpiry(from: Date): Date {
  return new Date(from.getTime() + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Constant-time comparison, for the one place a supplied token is checked against a stored one.
 *
 * The database lookup that finds the invite is already the comparison in practice, and an index
 * probe is not constant time — this exists for callers that have both strings in hand and would
 * otherwise reach for `===`, whose early exit leaks the length of the matching prefix.
 */
export function isSameToken(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  // `timingSafeEqual` throws on a length mismatch, which would itself be the leak it prevents.
  return left.length === right.length && timingSafeEqual(left, right);
}
