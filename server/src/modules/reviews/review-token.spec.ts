import { describe, expect, it } from 'vitest';
import { INVITE_LIFETIME_DAYS, inviteExpiry, isSameToken, mintReviewToken } from './review-token.js';

describe('mintReviewToken', () => {
  it('is long enough not to be guessed — this token is the whole authorisation', () => {
    // 32 bytes of base64url, unpadded.
    expect(mintReviewToken()).toHaveLength(43);
  });

  it('is URL-safe, so it survives a path segment and a plain-text mail', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(mintReviewToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('does not repeat', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => mintReviewToken()));

    expect(tokens.size).toBe(500);
  });
});

describe('inviteExpiry', () => {
  it('is the configured lifetime after the moment of issue', () => {
    const issued = new Date('2026-09-12T00:00:00.000Z');

    expect(inviteExpiry(issued).getTime() - issued.getTime()).toBe(
      INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it('does not mutate the date it was given', () => {
    const issued = new Date('2026-09-12T00:00:00.000Z');
    inviteExpiry(issued);

    expect(issued.toISOString()).toBe('2026-09-12T00:00:00.000Z');
  });
});

describe('isSameToken', () => {
  it('matches a token against itself', () => {
    const token = mintReviewToken();

    expect(isSameToken(token, token)).toBe(true);
  });

  it('rejects a different token', () => {
    expect(isSameToken(mintReviewToken(), mintReviewToken())).toBe(false);
  });

  it('rejects a different length without throwing, which would be the leak it prevents', () => {
    expect(isSameToken('short', 'considerably-longer')).toBe(false);
  });
});
