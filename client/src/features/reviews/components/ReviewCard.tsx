import { BadgeCheck, Clock, Wrench } from 'lucide-react';
import Image from 'next/image';
import { DIFFICULTY_LABELS } from '@/lib/labels';
import { formatDate } from '@/lib/formatters';
import type { ProductReview } from '../schema';
import { StarRating } from './StarRating';

/**
 * One review (FR-REV-01, FR-REV-03, FR-REV-04).
 *
 * The build facts get their own row rather than being buried in the prose, because they are the
 * reason this review widget was written instead of installed: "8h · Intermediate · God Hand
 * nipper" is what another builder is actually scanning for, and it is not something a star
 * rating can carry.
 *
 * The verified badge is a fact the server established — a review can only exist against a
 * delivered order line — so it is never rendered from anything the author typed.
 */
export function ReviewCard({ review }: { review: ProductReview }) {
  return (
    <article className="flex flex-col gap-2 border-b border-armor-150 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StarRating rating={review.rating} />
        <h4 className="font-display text-sm font-semibold">{review.title}</h4>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-frame-300">
        <span>{review.authorName}</span>
        <span aria-hidden>·</span>
        <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
        {review.isVerifiedPurchase ? (
          <span className="inline-flex items-center gap-1 text-success">
            <BadgeCheck className="size-3.5" aria-hidden />
            Verified purchase
          </span>
        ) : null}
      </p>

      <p className="max-w-prose whitespace-pre-line text-sm">{review.body}</p>

      <BuildFacts review={review} />

      {review.photos.length === 0 ? null : (
        <ul className="flex flex-wrap gap-2 pt-1">
          {review.photos.map((photo) => (
            <li key={photo.id}>
              {/* The alt text is the reviewer's, and it is required on submission — an image with
                  no description is invisible to a screen reader (PRD §12 Accessibility). */}
              <Image
                src={photo.url}
                alt={photo.alt}
                width={96}
                height={96}
                className="size-24 rounded-sm border border-armor-150 object-cover"
              />
            </li>
          ))}
        </ul>
      )}

      {review.adminReply === null ? null : (
        <div className="mt-1 border-l-2 border-core-blue bg-armor-050 px-3 py-2">
          <p className="text-xs font-semibold text-core-blue">GunSnip replied</p>
          <p className="max-w-prose whitespace-pre-line text-sm">{review.adminReply}</p>
        </div>
      )}
    </article>
  );
}

/** The kit-specific fields, when the reviewer gave any. Nothing renders for a tool review. */
function BuildFacts({ review }: { review: ProductReview }) {
  const facts = [
    review.buildTimeMinutes === null
      ? null
      : { icon: Clock, text: formatBuildTime(review.buildTimeMinutes) },
    review.experiencedDifficulty === null
      ? null
      : { icon: Wrench, text: `Felt ${DIFFICULTY_LABELS[review.experiencedDifficulty].toLowerCase()}` },
  ].filter((fact) => fact !== null);

  if (facts.length === 0 && review.toolsUsed.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-frame-300">
      {facts.map((fact) => (
        <span key={fact.text} className="inline-flex items-center gap-1">
          <fact.icon className="size-3.5" aria-hidden />
          {fact.text}
        </span>
      ))}

      {review.toolsUsed.length === 0 ? null : <span>Used: {review.toolsUsed.join(', ')}</span>}
    </div>
  );
}

/** `480` → `8h`, `90` → `1h 30m`, `45` → `45m`. A build time is read, not calculated. */
function formatBuildTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
