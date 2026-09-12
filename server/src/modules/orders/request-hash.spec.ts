import { describe, expect, it } from 'vitest';
import { canonicalJson, requestHash } from './request-hash.js';

describe('requestHash', () => {
  it('ignores key order — the same body serialised two ways is one request', () => {
    expect(requestHash({ a: 1, b: { c: 2, d: 3 } })).toBe(requestHash({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it('treats an undefined field as absent', () => {
    expect(requestHash({ a: 1, notes: undefined })).toBe(requestHash({ a: 1 }));
  });

  it('distinguishes a changed value', () => {
    expect(requestHash({ expectedTotalIdr: 800_000 })).not.toBe(requestHash({ expectedTotalIdr: 800_001 }));
  });

  it('keeps array order, which is part of what a list means', () => {
    expect(requestHash({ items: [1, 2] })).not.toBe(requestHash({ items: [2, 1] }));
  });

  it('serialises nested structures canonically', () => {
    expect(canonicalJson({ z: [{ y: null, x: 'a' }], a: true })).toBe('{"a":true,"z":[{"x":"a","y":null}]}');
  });
});
