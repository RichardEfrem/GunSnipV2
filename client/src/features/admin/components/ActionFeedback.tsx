'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ActionResult } from '../action-result';

/**
 * What a Server Action had to say, rendered beside the form that ran it.
 *
 * `role="status"` rather than `role="alert"` even for a failure: these are responses to
 * something the operator just did and are already where they are looking, so interrupting a
 * screen reader mid-sentence is the wrong trade. The icon carries the meaning alongside the
 * colour, which DESIGN.md §6 requires — red and green are the one pair colour-blind users
 * cannot separate.
 */
export function ActionFeedback({ result, className }: { result: ActionResult; className?: string }) {
  if (result.status === 'idle') return null;
  if (result.status === 'ok' && result.message === undefined) return null;

  const isError = result.status === 'error';

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-1.5 text-xs',
        isError ? 'text-danger' : 'text-ok',
        className,
      )}
    >
      {isError ? (
        <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
      ) : (
        <CircleCheck className="mt-px size-4 shrink-0" aria-hidden />
      )}
      {result.message}
    </p>
  );
}
