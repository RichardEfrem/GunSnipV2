import { Transform } from 'class-transformer';

/**
 * Normalisation for free-text body fields. Like `query.ts`, these only reshape a value — every
 * rule about what is *allowed* stays on the validation decorators beside them — and a value of the
 * wrong type is passed through untouched for `@IsString()` to reject.
 */

/** Trims, and turns a field left blank into absent — an empty delivery note is no note. */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  });
}

/**
 * Trimmed and lower-cased. `Amuro@Example.com ` and `amuro@example.com` are one mailbox, and the
 * guest lookup (FR-ORD-02) compares emails exactly, so they have to be stored as one string.
 */
export function NormaliseEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
}

/** `0812-3456 7890` → `081234567890`. People write numbers with separators; couriers dial digits. */
export function NormalisePhone(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s().-]/g, '') : value,
  );
}

/** `gs-260907-4471 ` → `GS-260907-4471`, since order numbers get retyped from an email. */
export function NormaliseOrderNumber(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));
}
