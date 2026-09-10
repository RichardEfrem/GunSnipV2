import type { ReactNode } from 'react';
import type { CardBadgeTone } from '@/lib/badges';
import { cn } from '@/lib/cn';

/**
 * DESIGN.md §4.3. Which badges appear on a card, and the two-per-card cap, are decided by
 * `selectCardBadges` in `lib/badges.ts` — this component only knows how each tone looks.
 */
const TONES: Record<CardBadgeTone, string> = {
  grade: 'bg-blue-fill text-white',
  discount: 'bg-red-fill text-white',
  new: 'bg-signal-yellow text-ink',
  // Outline, not fill: yellow is status and never fills larger than a badge (DESIGN.md §1),
  // and yellow text on light would not clear the contrast floor.
  preorder: 'border border-signal-yellow text-ink',
  'low-stock': 'text-warn',
  'out-of-stock': 'bg-muted-fill text-white',
};

interface BadgeProps {
  tone: CardBadgeTone;
  /** Grade codes are uppercase because they are acronyms — everything else is sentence case
   *  (DESIGN.md §2.2). */
  children: ReactNode;
  className?: string;
}

export function Badge({ tone, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 font-display text-xs font-semibold leading-none',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
