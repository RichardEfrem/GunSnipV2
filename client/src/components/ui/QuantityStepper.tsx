'use client';

import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Bounded quantity control (DESIGN.md §3.5).
 *
 * The bounds are enforced here as well as server-side — this stops the click, it does not
 * decide what is allowed. `max` comes from real availability, so the upper button explains
 * itself when it stops working rather than going quietly dead.
 */
interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Usually the available stock. */
  max: number;
  /** The thing being counted, for the screen-reader label: "Quantity of MG Nu Gundam". */
  label: string;
  disabled?: boolean;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  disabled = false,
  className,
}: QuantityStepperProps) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <div
      className={cn(
        'inline-flex h-11 items-center rounded-sm border border-field-border bg-armor-000',
        disabled && 'opacity-50',
        className,
      )}
    >
      <StepButton
        icon={<Minus className="size-4" aria-hidden />}
        srLabel={`Decrease quantity of ${label}`}
        onClick={() => onChange(value - 1)}
        enabled={canDecrease}
        title={value <= min ? `Minimum is ${min}` : undefined}
      />

      <output
        aria-live="polite"
        aria-label={`Quantity of ${label}`}
        className="min-w-10 text-center font-display text-base font-semibold tabular-nums"
      >
        {value}
      </output>

      <StepButton
        icon={<Plus className="size-4" aria-hidden />}
        srLabel={`Increase quantity of ${label}`}
        onClick={() => onChange(value + 1)}
        enabled={canIncrease}
        title={value >= max ? `Only ${max} available` : undefined}
      />
    </div>
  );
}

interface StepButtonProps {
  icon: ReactNode;
  srLabel: string;
  onClick: () => void;
  enabled: boolean;
  title: string | undefined;
}

/** `aria-disabled` rather than `disabled` so the button keeps focus and can say why it
 *  stopped (DESIGN.md §4.2). */
function StepButton({ icon, srLabel, onClick, enabled, title }: StepButtonProps) {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      aria-disabled={!enabled || undefined}
      title={title}
      className={cn(
        'reticle grid h-full w-11 place-items-center rounded-sm transition-colors duration-fast ease-out',
        enabled ? 'hover:bg-ink-tint' : 'cursor-not-allowed text-frame-300',
      )}
    >
      {icon}
      <span className="sr-only">{srLabel}</span>
    </button>
  );
}
