import { Package } from 'lucide-react';
import Link from 'next/link';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { formatIdr } from '@/lib/formatters';
import { groupOrderItems, type OrderEntry } from '../group-items';
import type { OrderItem } from '../schema';

/**
 * What was ordered, as it was at purchase (FR-ORD-05): the snapshot's name, SKU, image and price.
 * The link goes to the product as it is now, which is the one thing here that may have moved on.
 *
 * A bundle bought as one item renders as one line with its components beneath it (FR-CAT-11) —
 * the same shape the cart showed, so the order the customer receives matches the order they
 * placed rather than expanding into rows they never chose.
 */
export function OrderItems({ items }: { items: readonly OrderItem[] }) {
  return (
    <ul className="flex flex-col divide-y divide-armor-150">
      {groupOrderItems(items).map((entry) =>
        entry.kind === 'item' ? (
          <ItemRow key={entry.item.id} item={entry.item} />
        ) : (
          <BundleRow key={entry.name} entry={entry} />
        ),
      )}
    </ul>
  );
}

function ItemRow({ item }: { item: OrderItem }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <Thumbnail src={item.imageUrl} size={80} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/products/${item.productSlug}`}
          className="reticle line-clamp-2 font-display text-base font-semibold hover:text-core-blue"
        >
          {item.productName}
        </Link>
        {item.variantName === null ? null : <p className="text-sm text-frame-300">{item.variantName}</p>}
        <p className="font-mono text-xs text-frame-300">{item.sku}</p>
        <p className="text-sm tabular-nums text-frame-300">
          {item.quantity} × {formatIdr(item.unitPriceIdr)}
        </p>
      </div>

      <p className="font-medium tabular-nums">{formatIdr(item.lineTotalIdr)}</p>
    </li>
  );
}

/**
 * The components are listed without prices of their own. They have them — the bundle's price is
 * spread across them so stock and refunds work per variant — but printing them would invite the
 * reader to add them up and find the same total twice, worded two ways.
 */
function BundleRow({ entry }: { entry: Extract<OrderEntry, { kind: 'bundle' }> }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <Thumbnail src={entry.items[0]?.imageUrl ?? null} size={80} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-core-blue">
          <Package className="size-3" aria-hidden />
          Bundle
        </span>
        <p className="font-display text-base font-semibold">{entry.name}</p>

        <ul className="flex flex-col gap-0.5 text-xs text-frame-300">
          {entry.items.map((item) => (
            <li key={item.id} className="flex gap-1.5">
              <span aria-hidden>·</span>
              <Link
                href={`/products/${item.productSlug}`}
                className="reticle min-w-0 flex-1 rounded-sm hover:text-core-blue"
              >
                {item.quantity} × {item.productName}
                {item.variantName === null ? null : ` — ${item.variantName}`}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="font-medium tabular-nums">{formatIdr(entry.totalIdr)}</p>
    </li>
  );
}
