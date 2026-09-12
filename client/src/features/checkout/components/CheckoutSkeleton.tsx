import { Skeleton } from '@/components/ui/Skeleton';

/**
 * The checkout's loading state (DESIGN.md §4.5): the four sections and the summary at their real
 * sizes, so nothing moves when the page arrives.
 */
export function CheckoutSkeleton() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 pb-28 pt-6 md:px-6 lg:pb-6" aria-busy>
      <span className="sr-only" role="status">
        Loading checkout
      </span>
      <Skeleton className="h-9 w-40" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="flex flex-col gap-6">
          {/* Contact, address, delivery, payment — each at its loaded height. */}
          {['h-52', 'h-76', 'h-44', 'h-58'].map((height) => (
            <div key={height} className={`border border-armor-150 bg-armor-000 p-4 md:p-6 ${height}`}>
              <Skeleton className="h-7 w-44" />
            </div>
          ))}
        </div>

        <div className="flex h-96 flex-col gap-4 border border-armor-150 bg-armor-000 p-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="mt-auto h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
