import { LOW_STOCK_THRESHOLD, type StockState } from '@gunsnip/shared';

/**
 * Which badges a product card shows, and in what order (DESIGN.md §4.3).
 *
 * This is a rule, not markup, so it lives here rather than inside `<Badge>` — a `components/ui`
 * primitive never contains business logic (CLAUDE.md). It is a pure function of the product's
 * state, which also makes the "max two" cap testable without rendering anything.
 */

export type CardBadgeTone = 'grade' | 'discount' | 'new' | 'preorder' | 'low-stock' | 'out-of-stock';

export interface CardBadge {
  tone: CardBadgeTone;
  label: string;
}

export interface CardBadgeInput {
  /** Kit grade code. Tools have none — they get an extra status slot instead. */
  gradeCode: string | null;
  stockState: StockState;
  availableQuantity: number;
  discountPercent: number | null;
  isNew: boolean;
  isPreorder: boolean;
}

/** Highest first. DESIGN.md fixes the top four; low stock sits last because the stock pill
 *  already says it in words, so the badge is the redundant copy, not the primary signal. */
const STATUS_PRIORITY: readonly CardBadgeTone[] = [
  'out-of-stock',
  'discount',
  'new',
  'preorder',
  'low-stock',
];

/**
 * At most two badges. Grade is always shown when the product has one (it answers "is this the
 * right kind of thing" before anything else does), which leaves one status slot; a product
 * without a grade spends both slots on status.
 */
export function selectCardBadges(input: CardBadgeInput): CardBadge[] {
  const badges: CardBadge[] = [];

  if (input.gradeCode !== null) {
    badges.push({ tone: 'grade', label: input.gradeCode });
  }

  const candidates = new Map<CardBadgeTone, string>();

  if (input.stockState === 'OUT_OF_STOCK') candidates.set('out-of-stock', 'Out of stock');
  if (input.discountPercent !== null) candidates.set('discount', `−${input.discountPercent}%`);
  if (input.isNew) candidates.set('new', 'New');
  if (input.isPreorder) candidates.set('preorder', 'Preorder');
  if (input.stockState === 'LOW_STOCK' && input.availableQuantity <= LOW_STOCK_THRESHOLD) {
    candidates.set('low-stock', `${input.availableQuantity} left`);
  }

  for (const tone of STATUS_PRIORITY) {
    if (badges.length >= 2) break;

    const label = candidates.get(tone);
    if (label !== undefined) badges.push({ tone, label });
  }

  return badges;
}
