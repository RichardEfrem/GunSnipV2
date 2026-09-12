'use client';

import { Star } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Choosing a rating (FR-REV-01).
 *
 * Five radio inputs, visually a row of stars. A radio group rather than five buttons because the
 * choice is one of five mutually exclusive values, which is exactly what a radio group is and
 * what arrow keys already navigate — a row of buttons would have to reimplement that and would
 * announce as five unrelated controls.
 */
const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

interface RatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  error?: string;
}

export function RatingInput({ value, onChange, error }: RatingInputProps) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">Your rating</legend>

      <div
        className="flex items-center gap-1"
        aria-describedby={error === undefined ? undefined : errorId}
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <label
            key={rating}
            className="reticle cursor-pointer rounded-sm p-1 has-[:focus-visible]:outline-none"
            title={LABELS[rating - 1]}
          >
            <input
              type="radio"
              name={name}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
              className="sr-only"
            />
            <Star
              aria-hidden
              className={cn(
                'size-7 transition-colors duration-fast ease-out',
                rating <= value ? 'fill-signal-yellow text-signal-yellow' : 'text-armor-300',
              )}
            />
            <span className="sr-only">
              {rating} star{rating === 1 ? '' : 's'} — {LABELS[rating - 1]}
            </span>
          </label>
        ))}

        {value > 0 ? <span className="ml-2 text-sm text-frame-300">{LABELS[value - 1]}</span> : null}
      </div>

      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
