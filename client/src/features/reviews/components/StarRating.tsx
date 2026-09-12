import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * A 1–5 rating as stars (FR-REV-01).
 *
 * The stars are decorative and the number is the accessible name: five separate icons read out
 * as "star star star star star" tell a screen-reader user nothing, while "4 out of 5" is the
 * whole content. So the row is one labelled image, not five.
 */
interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function StarRating({ rating, size = 'sm', className }: StarRatingProps) {
  const rounded = Math.round(rating);

  return (
    <span role="img" aria-label={`${rating} out of 5`} className={cn('inline-flex gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            size === 'sm' ? 'size-3.5' : 'size-4',
            star <= rounded ? 'fill-signal-yellow text-signal-yellow' : 'text-armor-300',
          )}
        />
      ))}
    </span>
  );
}
