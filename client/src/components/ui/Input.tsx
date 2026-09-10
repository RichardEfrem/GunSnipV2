'use client';

import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * DESIGN.md §4.4.
 *
 * The label is required and always above the field. Placeholder-as-label vanishes the moment
 * someone starts typing, which is when they most need it — it is a measured cause of form
 * errors, so it is not available here even as an option.
 *
 * Validate on blur, not per keystroke: the caller decides *when* `error` becomes set, this
 * component only renders it.
 */
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Visually hide the label but keep it for screen readers — for the header search only. */
  isLabelHidden?: boolean;
  /** Persistent help text. Disappears when an error takes its place. */
  hint?: string;
  /** The message below the field. Its presence is what puts the field in the error state. */
  error?: string;
  /**
   * Renders "(optional)" beside the label. §4.4 requires marking required fields *or* optional
   * ones — this app marks optional, because in checkout nearly everything is required and
   * flagging all of it is noise.
   */
  isOptional?: boolean;
}

export function Input({
  label,
  isLabelHidden = false,
  hint,
  error,
  isOptional = false,
  className,
  ...props
}: InputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn('text-sm font-medium', isLabelHidden && 'sr-only')}>
        {label}
        {isOptional ? <span className="ml-1 font-normal text-frame-300">(optional)</span> : null}
      </label>

      <input
        {...props}
        id={id}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : hint === undefined ? undefined : hintId}
        className={cn(
          'h-11 w-full rounded-sm bg-armor-000 px-3 text-base',
          // --field-border, not the panel line: this border is what identifies the control, so
          // it owes 3:1 (DESIGN.md §6). Width stays 1px on focus so nothing reflows — the
          // §4.6 focus ring does the announcing.
          'border border-field-border transition-colors duration-fast ease-out',
          'placeholder:text-frame-300 focus-visible:border-core-blue',
          hasError && 'border-danger focus-visible:border-danger',
          'disabled:cursor-not-allowed disabled:bg-armor-050 disabled:text-frame-300',
          className,
        )}
      />

      {hasError ? (
        // Colour is never the only signal, so the icon rides with the message (DESIGN.md §6).
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-danger">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint === undefined ? null : (
        <p id={hintId} className="text-xs text-frame-300">
          {hint}
        </p>
      )}
    </div>
  );
}
