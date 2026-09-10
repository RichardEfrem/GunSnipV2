import { cn } from '@/lib/cn';

/**
 * The loading state (DESIGN.md §4.5). Skeletons match the real element's dimensions exactly so
 * nothing shifts when data arrives — a skeleton that is the wrong size is worse than none.
 * The shimmer stops under `prefers-reduced-motion`.
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('shimmer rounded-sm', className)} aria-hidden />;
}
