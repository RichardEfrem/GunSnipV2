import { Transform } from 'class-transformer';

/**
 * Query strings are all strings, and the global ValidationPipe runs with
 * `enableImplicitConversion: false` — deliberately, because implicit conversion turns
 * `?limit=abc` into `NaN` and `?inStock=0` into `true`, both silently. These decorators do the
 * conversion explicitly so the validator that follows sees a real number or boolean and can
 * reject what does not convert.
 *
 * They only convert. Every rule about what is *allowed* stays on the validation decorators
 * beside them, so a DTO still reads as its own specification.
 */

/**
 * `?grade=MG&grade=RG` and `?grade=MG,RG` both become `['MG', 'RG']`.
 *
 * Both forms exist in the wild and a filter rail is the one place users hand-edit a URL, so
 * accepting the comma form costs one line and saves a confusing empty result. Blank entries are
 * dropped: `?grade=` is the same as not filtering, not a filter for the empty string.
 */
export function ToStringArray(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;

    const raw = Array.isArray(value) ? value : [value];
    const items = raw
      .flatMap((entry: unknown) => (typeof entry === 'string' ? entry.split(',') : []))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    return items.length === 0 ? undefined : items;
  });
}

/** A base-10 integer, or the original value untouched so `@IsInt()` reports it rather than NaN. */
export function ToInt(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return value;

    // Number() rather than parseInt(): parseInt('12abc') is 12, which would let a malformed
    // page number through as a valid one.
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  });
}

/**
 * `?inStock` (valueless), `?inStock=true` and `?inStock=1` are all true; `false` and `0` are
 * false. Anything else is left alone for `@IsBoolean()` to reject, so a typo does not quietly
 * read as "off".
 */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (value === '' || value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;

    return value;
  });
}
