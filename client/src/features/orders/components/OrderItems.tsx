import Link from 'next/link';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { formatIdr } from '@/lib/formatters';
import type { OrderItem } from '../schema';

/**
 * What was ordered, as it was at purchase (FR-ORD-05): the snapshot's name, SKU, image and price.
 * The link goes to the product as it is now, which is the one thing here that may have moved on.
 */
export function OrderItems({ items }: { items: readonly OrderItem[] }) {
  return (
    <ul className="flex flex-col divide-y divide-armor-150">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
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
      ))}
    </ul>
  );
}
