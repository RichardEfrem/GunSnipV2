import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ProductSummary } from '../schema';
import { ProductCard } from './ProductCard';

/**
 * A horizontal shelf of products on the home page (DESIGN.md §3.1).
 *
 * Scrolls rather than wraps, with snap points so a swipe lands on a card edge. The cards are
 * fixed-width here instead of grid-sized — a rail that reflowed to the grid's column count
 * would show a different number of products per breakpoint and lose the "there is more this
 * way" affordance entirely.
 *
 * Renders nothing when empty. A titled rail with no contents reads as broken, and the home page
 * has five of them — one being unavailable should be invisible, not an error.
 */
interface ProductRailProps {
  title: string;
  products: readonly ProductSummary[];
  /** "See all →". Omitted when the rail has no natural listing behind it. */
  href?: string;
  /** Set on the first rail only, so its images are fetched eagerly. */
  isPriority?: boolean;
}

export function ProductRail({ title, products, href, isPriority = false }: ProductRailProps) {
  if (products.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-4 px-4 md:px-6">
        <h2 className="text-xl">{title}</h2>
        {href === undefined ? null : (
          <Link
            href={href}
            className="reticle inline-flex shrink-0 items-center gap-0.5 text-sm text-core-blue hover:underline"
          >
            See all
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </header>

      {/* Padding on the scroller rather than the section, so the first and last card sit flush
          with the page gutter at either end of the scroll. */}
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:gap-4 md:px-6">
        {products.map((product, index) => (
          <li key={product.id} className="w-40 shrink-0 snap-start sm:w-48 md:w-56">
            <ProductCard product={product} isPriority={isPriority && index < 4} />
          </li>
        ))}
      </ul>
    </section>
  );
}
