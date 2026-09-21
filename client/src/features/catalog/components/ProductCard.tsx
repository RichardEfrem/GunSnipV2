import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { StockPill } from '@/components/ui/StockPill';
import { selectCardBadges } from '@/lib/badges';
import { cn } from '@/lib/cn';
import { discountPercent, formatCount, formatIdr, formatRating } from '@/lib/formatters';
import type { ProductSummary } from '../schema';
import { isVectorImage } from '@/lib/image';

/**
 * DESIGN.md §3.4.
 *
 * The card's job is to let someone **discard** it without a click: grade and scale answer "the
 * right kind of thing", price and stock answer "can I have it", rating and sold count answer
 * "is it good". Every one of those is present, which is why the card is this dense.
 *
 * A Server Component — it is a link and some text, with no interactivity to hydrate. A grid of
 * 24 of these ships no JavaScript at all.
 */
interface ProductCardProps {
  product: ProductSummary;
  /** Rails above the fold pass true for the first few; the rest stay lazy. */
  isPriority?: boolean;
  className?: string;
}

export function ProductCard({ product, isPriority = false, className }: ProductCardProps) {
  const badges = selectCardBadges({
    gradeCode: product.grade?.code ?? null,
    stockState: product.stockState,
    availableQuantity: product.availableQuantity,
    discountPercent: discountPercent(product.priceIdr, product.compareAtPriceIdr),
    isNew: product.isNew,
    // PRD §14 Q1 leaves preorder open, so nothing sets it yet. The card already has the slot.
    isPreorder: false,
  });

  return (
    <article
      className={cn(
        'group relative flex flex-col border border-armor-150 bg-armor-000',
        'transition-colors duration-fast ease-out focus-within:border-core-blue hover:border-core-blue',
        className,
      )}
    >
      <div className="chamfer relative aspect-square overflow-hidden bg-armor-050">
        {product.image === null ? null : (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            placeholder="blur"
            blurDataURL={product.image.blurDataUrl}
            // Matches the grid: 5 up at ≥1280, 4 at 1024, 3 at 768, 2 on mobile (DESIGN.md §3.2).
            sizes="(min-width: 1280px) 240px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            priority={isPriority}
            unoptimized={isVectorImage(product.image.url)}
            // Scales inside its clip on hover. No lift, no shadow (DESIGN.md §3.4).
            className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}

        {badges.length === 0 ? null : (
          <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
            {/* Status badge left, grade right — DESIGN.md §3.4 puts the grade in the corner. */}
            <span className="flex flex-wrap gap-1">
              {badges
                .filter((badge) => badge.tone !== 'grade')
                .map((badge) => (
                  <Badge key={badge.tone} tone={badge.tone}>
                    {badge.label}
                  </Badge>
                ))}
            </span>
            <span className="flex flex-wrap justify-end gap-1">
              {badges
                .filter((badge) => badge.tone === 'grade')
                .map((badge) => (
                  <Badge key={badge.tone} tone={badge.tone}>
                    {badge.label}
                  </Badge>
                ))}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-armor-150 p-3">
        <h3 className="font-display text-base font-semibold leading-tight">
          {/* Stretched over the whole card, so the hit area is the card and not just the words.
              The card is `relative` for exactly this. */}
          <Link href={`/products/${product.slug}`} className="reticle line-clamp-2 after:absolute after:inset-0">
            {product.name}
          </Link>
        </h3>

        <p className="flex flex-wrap items-baseline gap-x-2 font-display tabular-nums">
          <span className="text-lg font-semibold text-sortie-red">
            {product.hasPriceRange ? (
              <>
                <span className="text-xs font-medium text-frame-300">From </span>
                {formatIdr(product.priceIdr)}
              </>
            ) : (
              formatIdr(product.priceIdr)
            )}
          </span>

          {product.compareAtPriceIdr === null ||
          discountPercent(product.priceIdr, product.compareAtPriceIdr) === null ? null : (
            <s className="text-sm text-frame-300">
              <span className="sr-only">Was </span>
              {formatIdr(product.compareAtPriceIdr)}
            </s>
          )}
        </p>

        <p className="text-xs text-frame-300">
          {product.ratingAverage === null ? (
            // Not "0 reviews" — an unreviewed product is unknown, not badly rated, and a zero
            // beside a star reads as the latter.
            <span>No reviews yet</span>
          ) : (
            <span>
              <span aria-hidden>★ </span>
              {formatRating(product.ratingAverage)}
              <span className="sr-only"> out of 5</span> ({formatCount(product.reviewCount)})
            </span>
          )}
          {product.unitsSold > 0 && <span> · {formatCount(product.unitsSold)} sold</span>}
        </p>

        <StockPill state={product.stockState} />

        {/* The runner tag: what it is, in the shorthand a builder scans for. Pushed to the
            bottom so cards with two-line names still align along it. */}
        {product.grade === null && product.scale === null ? null : (
          <p className="mt-auto pt-1">
            <span className="inline-block border border-armor-150 px-1.5 py-0.5 font-mono text-xs text-frame-300">
              {[product.grade?.code, product.scale?.code === 'NON_SCALE' ? null : product.scale?.code]
                .filter((part) => part !== null && part !== undefined)
                .join(' · ')}
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
