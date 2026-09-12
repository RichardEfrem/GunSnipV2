import { Skeleton } from '@/components/ui/Skeleton';

/** The order page's loading state (DESIGN.md §4.5), at the loaded page's proportions. */
export default function OrderLoading() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-6 md:px-6" aria-busy>
      <span className="sr-only" role="status">
        Loading your order
      </span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>

      <Skeleton className="h-24 w-full" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
