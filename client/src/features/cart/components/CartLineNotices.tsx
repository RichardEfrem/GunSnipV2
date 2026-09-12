import { TriangleAlert } from 'lucide-react';
import { noticeText } from '../notice-copy';
import type { CartLine } from '../schema';

/**
 * What changed about a line since it was added, inline beside it (FR-CART-04, DESIGN.md §3.6).
 *
 * `--warn` with an icon and a sentence: a change is something to notice, not an error, and
 * colour is never the only signal (DESIGN.md §6). Rendered on every read for as long as it is
 * true — the server does not consume it — so the customer cannot miss it by blinking.
 */
export function CartLineNotices({ line }: { line: CartLine }) {
  if (line.notices.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1">
      {line.notices.map((notice) => (
        <li key={notice.kind} className="flex items-start gap-1.5 text-xs text-warn">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {noticeText(notice, line)}
        </li>
      ))}
    </ul>
  );
}
