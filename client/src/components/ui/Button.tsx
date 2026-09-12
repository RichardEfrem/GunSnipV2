'use client';

import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { buttonStyles, type ButtonVariant } from './button-styles';

export type { ButtonVariant } from './button-styles';

/** DESIGN.md §4.2. The variants themselves, and the one-primary-per-view rule, live in `button-styles.ts`. */

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: ButtonVariant;
  /** Swaps the label for a spinner without changing the button's width. */
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * Why the button cannot be used. DESIGN.md §4.2 requires disabled buttons to explain
   * themselves, and a natively disabled button is unfocusable — so supplying a reason keeps the
   * button in the tab order and marks it `aria-disabled` instead, which is the only way a
   * keyboard or screen reader user ever reaches the explanation.
   */
  disabledReason?: string;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  disabled = false,
  disabledReason,
  className,
  children,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const isInert = disabled || isLoading;
  // Loading keeps the button focusable: taking focus away mid-action strands a keyboard user
  // wherever the browser decides to put them next. Only a genuinely disabled button leaves the
  // tab order, and then only when there is no reason to read.
  const isHardDisabled = disabled && !isLoading && disabledReason === undefined;

  return (
    <button
      {...props}
      type={type}
      className={buttonStyles(
        variant,
        cn(
          'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
          // Dimmed because it cannot be used — a loading button is busy, not unavailable, so it
          // keeps its full weight (DESIGN.md §4.2).
          disabled && 'opacity-50',
          className,
        ),
      )}
      disabled={isHardDisabled}
      aria-disabled={(isInert && !isHardDisabled) || undefined}
      aria-busy={isLoading || undefined}
      title={disabledReason !== undefined && disabled ? disabledReason : props.title}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (isInert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {/* The label stays in the layout while loading so the button keeps its width and
          nothing around it reflows (DESIGN.md §4.2). */}
      <span className={cn('inline-flex items-center gap-2', isLoading && 'invisible')}>{children}</span>

      {isLoading ? (
        <span className="absolute inset-0 grid place-items-center">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          <span className="sr-only">Loading</span>
        </span>
      ) : null}
    </button>
  );
}
