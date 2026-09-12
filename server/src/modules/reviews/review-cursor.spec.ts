import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../common/errors/validation.error.js';
import {
  decodeReviewCursor,
  encodeReviewCursor,
  reviewCursorFilter,
  reviewOrderBy,
} from './review-cursor.js';

const AT = new Date('2026-09-12T10:00:00.000Z');
const KEYSET = { rating: 4, at: AT, id: 'r-2' };

describe('review cursors', () => {
  it('round-trips the three-part key', () => {
    expect(decodeReviewCursor(encodeReviewCursor(KEYSET))).toEqual(KEYSET);
  });

  it('is undefined with no cursor — the first page', () => {
    expect(decodeReviewCursor(undefined)).toBeUndefined();
  });

  it('rejects a cursor that cannot be read rather than silently starting over', () => {
    expect(() => decodeReviewCursor('not-a-cursor')).toThrow(ValidationError);
  });

  it('is opaque, so nobody builds one by hand against the sort we chose today', () => {
    expect(encodeReviewCursor(KEYSET)).not.toContain('rating');
  });
});

describe('reviewOrderBy', () => {
  it('breaks a rating tie by recency in every sort, never by id', () => {
    for (const sort of ['newest', 'highest', 'lowest'] as const) {
      expect(reviewOrderBy(sort).at(-2)).toEqual({ createdAt: 'desc' });
    }
  });

  it('leads with the rating for the two rating sorts and with recency for newest', () => {
    expect(reviewOrderBy('highest')[0]).toEqual({ rating: 'desc' });
    expect(reviewOrderBy('lowest')[0]).toEqual({ rating: 'asc' });
    expect(reviewOrderBy('newest')[0]).toEqual({ createdAt: 'desc' });
  });
});

describe('reviewCursorFilter', () => {
  it('filters nothing on the first page', () => {
    expect(reviewCursorFilter('newest', undefined)).toBeUndefined();
  });

  it('degrades to the two-part walk when there is no leading rating column', () => {
    expect(reviewCursorFilter('newest', KEYSET)).toEqual({
      OR: [{ createdAt: { lt: AT } }, { createdAt: AT, id: { lt: 'r-2' } }],
    });
  });

  it('leaves the lower ratings still to come when sorting highest first', () => {
    expect(reviewCursorFilter('highest', KEYSET)).toEqual({
      OR: [
        { rating: { lt: 4 } },
        { rating: 4, OR: [{ createdAt: { lt: AT } }, { createdAt: AT, id: { lt: 'r-2' } }] },
      ],
    });
  });

  it('leaves the higher ratings still to come when sorting lowest first', () => {
    expect(reviewCursorFilter('lowest', KEYSET)).toEqual({
      OR: [
        { rating: { gt: 4 } },
        { rating: 4, OR: [{ createdAt: { lt: AT } }, { createdAt: AT, id: { lt: 'r-2' } }] },
      ],
    });
  });

  it('keeps the recency tie-break descending in both rating sorts, so pages do not overlap', () => {
    for (const sort of ['highest', 'lowest'] as const) {
      const filter = reviewCursorFilter(sort, KEYSET) as { OR: { OR?: unknown[] }[] };

      expect(filter.OR[1]?.OR).toEqual([{ createdAt: { lt: AT } }, { createdAt: AT, id: { lt: 'r-2' } }]);
    }
  });
});
