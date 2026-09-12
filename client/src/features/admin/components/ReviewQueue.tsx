'use client';

import { BadgeCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/formatters';
import { DIFFICULTY_LABELS } from '@/lib/labels';
import { IDLE, type ActionResult } from '../action-result';
import { moderateReviewAction, replyToReviewAction } from '../actions';
import type { AdminReview } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminTextarea } from './AdminField';
import { AdminPanel } from './AdminPanel';
import { ReviewStatusBadge } from './OrderStatusBadge';

/**
 * The moderation queue (FR-ADM-11).
 *
 * Cards rather than a table, because a moderator has to *read* each one — the decision is about
 * the text, and a table row that truncates the body would mean opening every review to judge it.
 * The kit-specific fields (FR-REV-04) are shown for the same reason: a claimed two-hour build of
 * a Perfect Grade is exactly the kind of thing moderation exists to catch.
 */
export function ReviewQueue({ reviews, className }: { reviews: AdminReview[]; className?: string }) {
  if (reviews.length === 0) {
    return (
      <AdminPanel className={className}>
        <p className="py-10 text-center text-sm text-frame-300">
          Nothing here. Either the queue is clear, or the filter is hiding it.
        </p>
      </AdminPanel>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className ?? ''}`}>
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: AdminReview }) {
  const [result, setResult] = useState<ActionResult>(IDLE);
  const [isPending, startTransition] = useTransition();
  const [isReplying, setIsReplying] = useState(false);

  function moderate(status: 'APPROVED' | 'REJECTED'): void {
    startTransition(async () => {
      setResult(await moderateReviewAction(review.id, status));
    });
  }

  return (
    <AdminPanel>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            <h3 className="font-medium">{review.title}</h3>
            <ReviewStatusBadge status={review.status} />
          </div>

          <p className="mt-1 text-xs text-frame-300">
            {review.authorName} · {formatDate(review.createdAt)} ·{' '}
            <Link
              href={`/admin/products?q=${encodeURIComponent(review.product.name)}`}
              className="reticle rounded-sm text-core-blue hover:underline"
            >
              {review.product.name}
            </Link>
            {review.isVerifiedPurchase ? (
              <span className="ml-2 inline-flex items-center gap-1 text-ok">
                <BadgeCheck className="size-3.5" aria-hidden />
                Verified purchase
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <p className="max-w-measure whitespace-pre-line text-sm leading-relaxed">{review.body}</p>

      {review.buildTimeMinutes !== null || review.experiencedDifficulty !== null || review.toolsUsed.length > 0 ? (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-sm bg-armor-050 p-3 text-xs">
          {review.buildTimeMinutes === null ? null : (
            <Detail term="Took them">{`${Math.round(review.buildTimeMinutes / 60)} hours`}</Detail>
          )}
          {review.experiencedDifficulty === null ? null : (
            <Detail term="Found it">{DIFFICULTY_LABELS[review.experiencedDifficulty]}</Detail>
          )}
          {review.toolsUsed.length === 0 ? null : <Detail term="Used">{review.toolsUsed.join(', ')}</Detail>}
        </dl>
      ) : null}

      {review.adminReply === null ? null : (
        <p className="mt-3 border-l-2 border-core-blue bg-core-blue-tint p-3 text-sm">
          <span className="font-medium">Our reply: </span>
          {review.adminReply}
        </p>
      )}

      {isReplying ? (
        <ReplyForm review={review} onDone={() => setIsReplying(false)} />
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {review.status === 'APPROVED' ? null : (
            <Button variant="secondary" isLoading={isPending} onClick={() => moderate('APPROVED')}>
              Approve
            </Button>
          )}
          {review.status === 'REJECTED' ? null : (
            <Button variant="danger" isLoading={isPending} onClick={() => moderate('REJECTED')}>
              Reject
            </Button>
          )}
          <Button variant="ghost" onClick={() => setIsReplying(true)}>
            {review.adminReply === null ? 'Reply' : 'Edit reply'}
          </Button>
          <ActionFeedback result={result} />
        </div>
      )}
    </AdminPanel>
  );
}

function ReplyForm({ review, onDone }: { review: AdminReview; onDone: () => void }) {
  const [result, formAction, isPending] = useActionState(replyToReviewAction.bind(null, review.id), IDLE);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-armor-150 pt-4">
      <AdminTextarea
        label="Reply on behalf of the shop"
        name="adminReply"
        defaultValue={review.adminReply ?? ''}
        isOptional
        maxLength={2000}
        hint="Shown under the review on the product page. Leave it blank to remove an existing reply."
      />

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" isLoading={isPending}>
          Save reply
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Done
        </Button>
        <ActionFeedback result={result} />
      </div>
    </form>
  );
}

/** The number is in the label, not only in the stars — colour and shape are never the only signal. */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((position) => (
        <Star
          key={position}
          className={`size-3.5 ${position <= rating ? 'fill-signal-yellow text-signal-yellow' : 'text-armor-150'}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

function Detail({ term, children }: { term: string; children: string }) {
  return (
    <div>
      <dt className="inline text-frame-300">{term}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}
