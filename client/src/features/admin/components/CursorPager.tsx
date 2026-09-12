import Link from 'next/link';
import { buttonStyles } from '@/components/ui/button-styles';

/**
 * "Next page" for a cursor-paginated admin list.
 *
 * One direction only, and that is the honest shape of a keyset cursor: it names a position to
 * read *forward* from, and there is no cursor for the page before it. The back button is the
 * way back, which works because every page is its own URL.
 *
 * Numbered pages are the storefront's requirement (FR-CAT-09) and not the back office's — nobody
 * links a colleague to page 7 of the order list, and offsets that deep get slower the more the
 * shop sells.
 */
interface CursorPagerProps {
  basePath: string;
  /** The current query, so the filters survive the page change. */
  params: Record<string, string | string[] | undefined>;
  nextCursor: string | null;
}

export function CursorPager({ basePath, params, nextCursor }: CursorPagerProps) {
  if (nextCursor === null) return null;

  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === 'cursor' || value === undefined) continue;
    next.set(key, Array.isArray(value) ? (value[0] ?? '') : value);
  }

  next.set('cursor', nextCursor);

  return (
    <nav aria-label="Pagination" className="mt-4 flex justify-center">
      <Link href={`${basePath}?${next.toString()}`} className={buttonStyles('secondary')}>
        Next page
      </Link>
    </nav>
  );
}
