import type { OrderItem } from './schema';

/**
 * The order's lines as the customer bought them (FR-CAT-11).
 *
 * A bundle was one line when they chose it, and one `order_item` per component underneath —
 * because stock is reserved, consumed and refunded per variant. The order screen puts them back
 * together, in the position the first component holds so nothing reorders between visits.
 *
 * Grouped on the **name**, not an id: `order_item.bundle_id` is cleared if the bundle is ever
 * retired, and an order from last year must still read as the one item that was bought.
 */
export type OrderEntry =
  | { kind: 'item'; item: OrderItem }
  | { kind: 'bundle'; name: string; items: readonly OrderItem[]; totalIdr: number };

export function groupOrderItems(items: readonly OrderItem[]): OrderEntry[] {
  const entries: OrderEntry[] = [];
  const seen = new Map<string, number>();

  for (const item of items) {
    if (item.bundleName === null) {
      entries.push({ kind: 'item', item });
      continue;
    }

    const at = seen.get(item.bundleName);

    if (at === undefined) {
      seen.set(item.bundleName, entries.length);
      entries.push({ kind: 'bundle', name: item.bundleName, items: [item], totalIdr: item.lineTotalIdr });
      continue;
    }

    const existing = entries[at];
    if (existing?.kind === 'bundle') {
      entries[at] = {
        ...existing,
        items: [...existing.items, item],
        // The components' allocated totals add back up to what the bundle was sold for.
        totalIdr: existing.totalIdr + item.lineTotalIdr,
      };
    }
  }

  return entries;
}
