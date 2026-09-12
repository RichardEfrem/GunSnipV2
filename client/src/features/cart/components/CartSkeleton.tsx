import { Skeleton } from '@/components/ui/Skeleton';

/**
 * The cart's loading state (DESIGN.md §4.5), laid out on the same grid as `CartScreen` with
 * rows the height of a real line, so nothing shifts when the cart arrives.
 */
const LINES = 3;

export function CartSkeleton() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:px-6" aria-busy aria-label="Loading your cart">
      <Skeleton className="h-9 w-40" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="border border-armor-150 bg-armor-000">
          <div className="flex h-11 items-center border-b border-armor-150 px-4">
            <Skeleton className="h-5 w-32" />
          </div>

          <ul className="divide-y divide-armor-150">
            {Array.from({ length: LINES }, (_, index) => (
              <li key={index} className="flex gap-3 p-4">
                <Skeleton className="size-5 shrink-0" />
                <Skeleton className="size-20 shrink-0" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-11 w-36" />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 border border-armor-150 bg-armor-000 p-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
