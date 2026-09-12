'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { IDLE } from '../action-result';
import { signInAction } from '../sign-in-actions';

/**
 * The sign-in form.
 *
 * The key goes straight to a Server Action and never into React state — nothing here holds it,
 * so it cannot end up in a devtools snapshot or a client error report. `type="password"` and
 * `autoComplete="off"` keep it out of the browser's own stores too.
 */
export function SignInForm({ next }: { next?: string }) {
  const [result, formAction, isPending] = useActionState(signInAction, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next === undefined ? null : <input type="hidden" name="next" value={next} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="adminKey" className="text-sm font-medium text-white">
          Admin key
        </label>
        <input
          id="adminKey"
          name="adminKey"
          type="password"
          autoComplete="off"
          autoFocus
          required
          aria-invalid={result.status === 'error' || undefined}
          aria-describedby={result.status === 'error' ? 'sign-in-error' : undefined}
          className="h-11 w-full rounded-sm border border-frame-field-border bg-frame-700 px-3 text-base text-white transition-colors duration-fast ease-out placeholder:text-frame-muted focus-visible:border-frame-focus"
        />
      </div>

      {result.status === 'error' ? (
        // `role="alert"` here, unlike elsewhere in admin: a failed sign-in moves focus nowhere
        // and the operator may be looking at the key field, so this one interrupts.
        <p id="sign-in-error" role="alert" className="text-xs text-danger">
          {result.message}
        </p>
      ) : null}

      <Button type="submit" isLoading={isPending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
