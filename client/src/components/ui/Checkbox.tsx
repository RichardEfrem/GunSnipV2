'use client';

import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Blue, because ticking a filter or selecting a cart line is interaction, not commerce
 * (DESIGN.md §1).
 *
 * Radix supplies the state machine and the hidden native input; everything visible is ours —
 * default shadcn styling is deliberately not shipped (DESIGN.md §7).
 */
interface CheckboxProps {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Zero-result filter options render disabled, not hidden — vanishing options make the
   *  filter set feel unstable (DESIGN.md §3.2). */
  disabled?: boolean;
  /** Count or price shown at the end of the row, e.g. a facet count. */
  detail?: ReactNode;
  className?: string;
}

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  detail,
  className,
}: CheckboxProps) {
  const id = useId();

  return (
    <div className={cn('flex min-h-11 items-center gap-2.5', className)}>
      <RadixCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        className={cn(
          'reticle grid size-5 shrink-0 place-items-center rounded-sm border border-field-border bg-armor-000',
          'transition-colors duration-fast ease-out',
          'data-[state=checked]:border-core-blue data-[state=checked]:bg-core-blue',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixCheckbox.Indicator>
          <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      <label
        htmlFor={id}
        className={cn(
          'flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm',
          disabled && 'cursor-not-allowed text-frame-300',
        )}
      >
        {label}
        {detail === undefined ? null : <span className="text-xs text-frame-300">{detail}</span>}
      </label>
    </div>
  );
}
