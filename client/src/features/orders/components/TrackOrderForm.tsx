'use client';

import { ORDER_NUMBER_PATTERN } from '@gunsnip/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Guest order lookup (FR-ORD-02): the order number and the email it was placed with, no account.
 *
 * Checked in the browser against the same pattern the API uses, then handed to the order page as
 * a navigation — the page fetches on the server, so a looked-up order renders exactly like the
 * confirmation does.
 */
type Field = 'orderNumber' | 'email';
type Values = Record<Field, string>;

const FIELD_SCHEMAS: Record<Field, z.ZodType<string>> = {
  orderNumber: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.string().regex(ORDER_NUMBER_PATTERN, 'Order numbers look like GS-260907-4471.')),
  email: z.string().trim().pipe(z.email('Enter the email the order was placed with.')),
};

function check(field: Field, values: Values): string | undefined {
  const result = FIELD_SCHEMAS[field].safeParse(values[field]);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function TrackOrderForm() {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ orderNumber: '', email: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const next = { orderNumber: check('orderNumber', values), email: check('email', values) };
    setErrors(next);

    const firstInvalid = (['orderNumber', 'email'] as const).find((field) => next[field] !== undefined);
    if (firstInvalid !== undefined) {
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const orderNumber = values.orderNumber.trim().toUpperCase();
    router.push(`/orders/${orderNumber}?email=${encodeURIComponent(values.email.trim())}`);
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {(['orderNumber', 'email'] as const).map((field) => (
        <Input
          key={field}
          name={field}
          label={field === 'orderNumber' ? 'Order number' : 'Email'}
          type={field === 'email' ? 'email' : 'text'}
          autoComplete={field === 'email' ? 'email' : 'off'}
          placeholder={field === 'orderNumber' ? 'GS-260907-4471' : undefined}
          hint={field === 'orderNumber' ? 'Shown on your order confirmation, starting GS-.' : undefined}
          value={values[field]}
          error={errors[field]}
          onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
          onBlur={() => setErrors((current) => ({ ...current, [field]: check(field, values) }))}
        />
      ))}

      <Button type="submit" variant="secondary">
        Find order
      </Button>
    </form>
  );
}
