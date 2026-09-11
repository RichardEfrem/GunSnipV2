'use client';

import { BellRing, Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api-error';
import { registerNotifyRequest } from '../client-api';

/**
 * "Tell me when it's back" on an out-of-stock product (FR-PDP-12).
 *
 * The point of this component is that the page it sits on stays useful. An out-of-stock product
 * remains reachable and indexable, and instead of a dead end it collects the one thing that
 * makes the restock worth anything: who was waiting.
 */
interface NotifyMeFormProps {
  /** Null when the product has no variant at all — then there is nothing to register against. */
  variantId: string | null;
  productName: string;
}

type Status = 'idle' | 'sending' | 'done' | 'error';

export function NotifyMeForm({ variantId, productName }: NotifyMeFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (variantId === null) return;

    setStatus('sending');
    setError(null);

    try {
      await registerNotifyRequest(variantId, email);
    } catch (cause) {
      setStatus('error');
      setError(
        cause instanceof ApiError ? cause.message : 'That could not be saved. Please try again.',
      );
      return;
    }

    setStatus('done');
  }

  if (status === 'done') {
    return (
      <p className="flex items-center gap-2 border border-ok bg-armor-050 p-3 text-sm text-ok">
        <Check className="size-4 shrink-0" aria-hidden />
        We&rsquo;ll email you when {productName} is back in stock.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border border-armor-150 bg-armor-050 p-3">
      <p className="flex items-center gap-2 font-display text-sm font-semibold">
        <BellRing className="size-4 shrink-0 text-core-blue" aria-hidden />
        Out of stock — get notified
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Input
          // The heading above already says what this is, so the label is hidden rather than
          // repeated — but it still exists, because a bare field is unusable to a screen reader.
          label={`Email address for ${productName} restock alerts`}
          isLabelHidden
          type="email"
          name="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          error={error ?? undefined}
          className="sm:flex-1"
        />
        <Button type="submit" variant="secondary" isLoading={status === 'sending'}>
          Notify me
        </Button>
      </div>
    </form>
  );
}
