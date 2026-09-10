import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import type { ProductSummary } from '../schema';
import { ProductCard } from './ProductCard';

/**
 * The results grid: 5 up at ≥1280, 4 at 1024, 3 at 768, 2 on mobile (DESIGN.md §3.2).
 *
 * Loading and loaded are here; empty and error are separate components rather than props,
 * because they are rendered *instead of* a grid and carry their own copy. All four states are
 * mandatory (DESIGN.md §4.5) — the listing page wires each one.
 */
const GRID = 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4';

interface ProductGridProps {
  products: readonly ProductSummary[];
  /** The first row is above the fold and loads eagerly; the rest stay lazy. */
  priorityCount?: number;
  className?: string;
}

export function ProductGrid({ products, priorityCount = 0, className }: ProductGridProps) {
  return (
    <ul className={cn(GRID, className)}>
      {products.map((product, index) => (
        <li key={product.id} className="flex">
          <ProductCard product={product} isPriority={index < priorityCount} className="w-full" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The loading state. Every block matches the real card's dimensions exactly, so nothing shifts
 * when the data arrives — a skeleton of the wrong size is worse than none (DESIGN.md §4.5).
 */
export function ProductGridSkeleton({ count = 10, className }: { count?: number; className?: string }) {
  return (
    <div className={cn(GRID, className)} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col border border-armor-150 bg-armor-000">
          <Skeleton className="aspect-square rounded-none" />
          <div className="flex flex-col gap-2 border-t border-armor-150 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
