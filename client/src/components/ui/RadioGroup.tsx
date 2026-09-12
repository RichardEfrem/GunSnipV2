import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A single choice from a short list, each option a full-width row: "Regular · 2–3 days ·
 * Rp 22.000", "Virtual account" (DESIGN.md §3.7).
 *
 * Native radios in a `fieldset`, not a Radix primitive: the browser already gives a radio group
 * arrow-key movement, one tab stop and a spoken "2 of 3", and there is nothing to add but the
 * chrome. Blue, because choosing an option is interaction, not commerce (DESIGN.md §1) — the price
 * in the row keeps its own colour.
 *
 * No `'use client'`: it renders what it is given and reports changes to a callback, so it is a
 * Client Component only when its parent is.
 */
export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
  /** A second line: delivery days, what the method means. */
  description?: ReactNode;
  /** Right-aligned: a price. */
  detail?: ReactNode;
}

interface RadioGroupProps<T extends string> {
  legend: string;
  isLegendHidden?: boolean;
  /** Groups the inputs; unique per page. */
  name: string;
  value: T | null;
  onValueChange: (value: T) => void;
  options: readonly RadioOption<T>[];
  disabled?: boolean;
  className?: string;
}

export function RadioGroup<T extends string>({
  legend,
  isLegendHidden = false,
  name,
  value,
  onValueChange,
  options,
  disabled = false,
  className,
}: RadioGroupProps<T>) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)} disabled={disabled}>
      <legend className={cn('mb-2 text-sm font-medium', isLegendHidden && 'sr-only')}>{legend}</legend>

      {options.map((option) => {
        const isChecked = option.value === value;

        return (
          <label
            key={option.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border bg-armor-000 px-3 py-2.5',
              'transition-colors duration-fast ease-out',
              isChecked ? 'border-core-blue bg-core-blue-tint' : 'border-armor-150 hover:border-field-border',
              'has-disabled:cursor-not-allowed has-disabled:opacity-60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isChecked}
              onChange={() => onValueChange(option.value)}
              className="reticle size-4 shrink-0 accent-core-blue"
            />

            <span className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{option.label}</span>
              {option.description === undefined ? null : (
                <span className="text-xs text-frame-300">{option.description}</span>
              )}
            </span>

            {option.detail === undefined ? null : <span className="text-sm tabular-nums">{option.detail}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
