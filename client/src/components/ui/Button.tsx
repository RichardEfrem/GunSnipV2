'use client';

import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * DESIGN.md §4.2. Primary is the only filled variant and there is **one per view** — it is
 * how "the thing to do here" is expressed, so a second one on screen makes both weaker.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  // The only chamfered variant. `chamfer-plate` rather than `chamfer` so the focus ring is
  // not clipped away with the corners — see the utility's note in globals.css.
  primary: 'chamfer-plate [--plate:var(--red-fill)] hover:[--plate:var(--red-fill-hover)] text-white',
  secondary: 'border border-core-blue text-core-blue hover:bg-core-blue-tint',
  ghost: 'text-ink hover:bg-ink-tint',
  danger: 'border border-danger text-danger hover:bg-danger-tint',
};

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
      // 48px on touch, 44px on pointer (DESIGN.md §4.2, §6).
      className={cn(
        'reticle relative inline-flex h-12 select-none items-center justify-center gap-2 rounded-sm px-4 md:h-11',
        'font-display text-base font-semibold',
        'transition-colors duration-fast ease-out',
        'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
        // Dimmed because it cannot be used — a loading button is busy, not unavailable, so it
        // keeps its full weight (DESIGN.md §4.2).
        disabled && 'opacity-50',
        VARIANTS[variant],
        className,
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
