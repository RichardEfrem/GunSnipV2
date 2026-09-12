import type { OrderStatus, ProductStatus, ReviewStatus } from '@gunsnip/shared';
import { cn } from '@/lib/cn';
import { ORDER_STATUS_LABELS } from '@/lib/labels';

/**
 * The status pills the back office lists things by.
 *
 * Not `components/ui/Badge`: that one is the card badge of DESIGN.md §4.3, whose tones are
 * commerce signals — grade, discount, new — chosen by `selectCardBadges` under a two-per-card
 * rule. A lifecycle status is a different thing wearing a similar shape, and giving it the
 * card's tone vocabulary would mean adding nine commerce tones that no card will ever use.
 *
 * Every status maps to an entry, so one added to `@gunsnip/shared` fails the build here until it
 * has been given a look. The label always accompanies the colour (DESIGN.md §6).
 */
const ORDER_TONES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-signal-yellow/20 text-warn',
  PAID: 'bg-core-blue-tint text-core-blue',
  PACKING: 'bg-core-blue-tint text-core-blue',
  SHIPPED: 'bg-core-blue-tint text-core-blue',
  DELIVERED: 'bg-ok/15 text-ok',
  COMPLETED: 'bg-ok/15 text-ok',
  CANCELLED: 'bg-ink-tint text-frame-300',
  EXPIRED: 'bg-ink-tint text-frame-300',
  REFUNDED: 'bg-danger-tint text-danger',
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return <Pill className={cn(ORDER_TONES[status], className)}>{ORDER_STATUS_LABELS[status]}</Pill>;
}

const PRODUCT_TONES: Record<ProductStatus, string> = {
  DRAFT: 'bg-ink-tint text-frame-300',
  PUBLISHED: 'bg-ok/15 text-ok',
  ARCHIVED: 'bg-ink-tint text-frame-300',
};

const PRODUCT_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export function ProductStatusBadge({ status, className }: { status: ProductStatus; className?: string }) {
  return <Pill className={cn(PRODUCT_TONES[status], className)}>{PRODUCT_LABELS[status]}</Pill>;
}

const REVIEW_TONES: Record<ReviewStatus, string> = {
  PENDING: 'bg-signal-yellow/20 text-warn',
  APPROVED: 'bg-ok/15 text-ok',
  REJECTED: 'bg-danger-tint text-danger',
};

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function ReviewStatusBadge({ status, className }: { status: ReviewStatus; className?: string }) {
  return <Pill className={cn(REVIEW_TONES[status], className)}>{REVIEW_LABELS[status]}</Pill>;
}

function Pill({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 font-display text-xs font-semibold leading-none',
        className,
      )}
    >
      {children}
    </span>
  );
}
