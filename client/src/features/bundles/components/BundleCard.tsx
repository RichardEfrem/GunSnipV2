import { Package } from 'lucide-react';
import Link from 'next/link';
import { Price } from '@/components/ui/Price';
import { StockPill } from '@/components/ui/StockPill';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { formatIdr } from '@/lib/formatters';
import type { Bundle } from '../schema';

/**
 * A bundle on a rail or a listing (FR-CAT-11).
 *
 * Leads with what is in it rather than with a picture of one component: the reason to buy a
 * bundle is the set, and a card showing only the kit reads as a kit that happens to cost less.
 * The saving is computed on the server from the components' current prices, never typed by hand
 * (the same rule `compare_at_price` follows, FR-PROMO-03).
 */
export function BundleCard({ bundle }: { bundle: Bundle }) {
  return (
    <article className="flex h-full flex-col gap-3 border border-armor-150 bg-armor-000 p-4">
      <div className="flex items-start gap-3">
        <Thumbnail
          src={bundle.image?.url ?? null}
          blurDataUrl={bundle.image?.blurDataUrl}
          size={48}
          isDimmed={!bundle.isPurchasable}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-core-blue">
            <Package className="size-3" aria-hidden />
            Bundle
          </span>
          <h3 className="font-display text-base font-semibold leading-tight">
            <Link href={`/bundles/${bundle.slug}`} className="reticle rounded-sm hover:text-core-blue">
              {bundle.name}
            </Link>
          </h3>
        </div>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 text-xs text-frame-300">
        {bundle.components.map((component) => (
          <li key={component.variantId} className="line-clamp-1">
            {component.quantity} × {component.productName}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-baseline gap-2">
        <Price amountIdr={bundle.priceIdr} compareAtIdr={bundle.compareAtPriceIdr} />
        {bundle.savingIdr > 0 ? (
          <span className="text-xs font-medium text-success">Save {formatIdr(bundle.savingIdr)}</span>
        ) : null}
      </div>

      {bundle.isPurchasable ? (
        bundle.stockState === 'LOW_STOCK' ? (
          <StockPill state="LOW_STOCK" availableQuantity={bundle.availableQuantity} />
        ) : null
      ) : (
        <StockPill state="OUT_OF_STOCK" availableQuantity={0} />
      )}
    </article>
  );
}
