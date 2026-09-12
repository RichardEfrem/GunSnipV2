import { describe, expect, it } from 'vitest';
import { startOfJakartaDay } from './jakarta-day.js';

/**
 * The dashboard's day boundary (FR-ADM-01). Worth testing because the failure is invisible: a
 * UTC boundary produces a plausible-looking number that is simply wrong for seven hours a day.
 */
const JAKARTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  dateStyle: 'short',
  timeStyle: 'medium',
  hourCycle: 'h23',
});

describe('startOfJakartaDay', () => {
  it('lands on local midnight, not UTC midnight', () => {
    // 06:30 WIB on 12 September is 23:30 UTC on 11 September — the window the UTC boundary gets
    // wrong, because it would call this "yesterday".
    const start = startOfJakartaDay(new Date('2026-09-11T23:30:00Z'));

    expect(JAKARTA.format(start)).toBe('2026-09-12, 00:00:00');
  });

  it('is the UTC instant seven hours before the local date, since WIB is UTC+7', () => {
    expect(startOfJakartaDay(new Date('2026-09-12T05:00:00Z')).toISOString()).toBe('2026-09-11T17:00:00.000Z');
  });

  it('is idempotent — the start of the day is already the start of its own day', () => {
    const start = startOfJakartaDay(new Date('2026-09-12T05:00:00Z'));

    expect(startOfJakartaDay(start).toISOString()).toBe(start.toISOString());
  });

  it('never returns an instant in the future', () => {
    for (const iso of ['2026-01-01T00:00:00Z', '2026-06-30T16:59:59Z', '2026-12-31T23:59:59Z']) {
      const now = new Date(iso);
      expect(startOfJakartaDay(now).getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it('is never more than 24 hours back', () => {
    for (const iso of ['2026-03-15T00:00:00Z', '2026-03-15T12:00:00Z', '2026-03-15T23:59:59Z']) {
      const now = new Date(iso);
      expect(now.getTime() - startOfJakartaDay(now).getTime()).toBeLessThan(24 * 60 * 60 * 1000);
    }
  });

  it('gives two instants on the same Jakarta day the same start', () => {
    const morning = startOfJakartaDay(new Date('2026-09-12T01:00:00Z')); // 08:00 WIB
    const evening = startOfJakartaDay(new Date('2026-09-12T14:00:00Z')); // 21:00 WIB

    expect(morning.toISOString()).toBe(evening.toISOString());
  });

  it('gives instants either side of local midnight different starts', () => {
    const before = startOfJakartaDay(new Date('2026-09-12T16:59:00Z')); // 23:59 WIB, 12 Sep
    const after = startOfJakartaDay(new Date('2026-09-12T17:01:00Z')); // 00:01 WIB, 13 Sep

    expect(before.toISOString()).not.toBe(after.toISOString());
  });

  it('drops sub-second precision, so the boundary is exactly midnight', () => {
    expect(startOfJakartaDay(new Date('2026-09-12T05:00:00.437Z')).getMilliseconds()).toBe(0);
  });
});
