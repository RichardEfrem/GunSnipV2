import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Price } from '@/components/ui/Price';
import { StockPill } from '@/components/ui/StockPill';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { fetchBundle } from '@/features/bundles/api';
import { AddBundleButton } from '@/features/bundles/components/AddBundleButton';
import type { Bundle } from '@/features/bundles/schema';
import { ApiError } from '@/lib/api-error';
import { formatIdr } from '@/lib/formatters';

/**
 * One bundle, and the one action it exists for (FR-CAT-11).
 *
 * The components are listed at their **catalogue** prices — the thing the bundle is being
 * compared against — with the bundle's own price beside them. The allocated split that the cart
 * and order use underneath is deliberately not shown: it is how stock and refunds are made to
 * work per variant, not a price anyone is being asked to agree to.
 */
export async function generateMetadata({ params }: PageProps<'/bundles/[slug]'>): Promise<Metadata> {
  const { slug } = await params;

  try {
    const bundle = await fetchBundle(slug);

    return {
      title: bundle.name,
      description: bundle.description ?? undefined,
      alternates: { canonical: `/bundles/${bundle.slug}` },
    };
  } catch {
    return {};
  }
}

export default async function BundlePage({ params }: PageProps<'/bundles/[slug]'>) {
  const { slug } = await params;

  let bundle: Bundle;

  try {
    bundle = await fetchBundle(slug);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    throw cause;
  }

  const componentTotal = bundle.components.reduce(
    (total, component) => total + component.catalogueUnitPriceIdr * component.quantity,
    0,
  );

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:px-6">
      <Breadcrumbs
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Bundles', href: '/bundles' },
          { label: bundle.name, href: `/bundles/${bundle.slug}` },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-core-blue">
              <Package className="size-3" aria-hidden />
              Bundle
            </span>
            <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">{bundle.name}</h1>
            {bundle.description === null ? null : (
              <p className="max-w-prose text-sm text-frame-300">{bundle.description}</p>
            )}
          </header>

          <section aria-labelledby="whats-inside" className="flex flex-col gap-3">
            <h2 id="whats-inside" className="font-display text-lg font-semibold">
              What&rsquo;s inside
            </h2>

            <ul className="flex flex-col divide-y divide-armor-150 border border-armor-150 bg-armor-000">
              {bundle.components.map((component) => (
                <li key={component.variantId} className="flex items-center gap-3 p-3">
                  <Thumbnail
                    src={component.image?.url ?? null}
                    blurDataUrl={component.image?.blurDataUrl}
                    size={48}
                    isDimmed={component.availableQuantity === 0}
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Link
                      href={`/products/${component.productSlug}`}
                      className="reticle rounded-sm text-sm font-medium hover:text-core-blue"
                    >
                      {component.productName}
                    </Link>
                    {component.variantName === null ? null : (
                      <p className="text-xs text-frame-300">{component.variantName}</p>
                    )}
                    <p className="font-mono text-2xs text-frame-300">{component.sku}</p>
                    {component.availableQuantity === 0 ? (
                      <StockPill state="OUT_OF_STOCK" availableQuantity={0} />
                    ) : null}
                  </div>

                  <p className="shrink-0 text-sm tabular-nums text-frame-300">
                    {component.quantity} × {formatIdr(component.catalogueUnitPriceIdr)}
                  </p>
                </li>
              ))}
            </ul>

            <p className="text-xs text-frame-300">
              Bought separately: <span className="tabular-nums">{formatIdr(componentTotal)}</span>
            </p>
          </section>
        </div>

        <aside className="flex flex-col gap-4 border border-armor-150 bg-armor-050 p-4 lg:sticky lg:top-20">
          <Price amountIdr={bundle.priceIdr} compareAtIdr={bundle.compareAtPriceIdr} size="lg" />

          {bundle.savingIdr > 0 ? (
            <p className="text-sm font-medium text-success">You save {formatIdr(bundle.savingIdr)}</p>
          ) : null}

          {bundle.isPurchasable ? (
            bundle.stockState === 'LOW_STOCK' ? (
              <StockPill state="LOW_STOCK" availableQuantity={bundle.availableQuantity} />
            ) : (
              <StockPill state="IN_STOCK" availableQuantity={bundle.availableQuantity} />
            )
          ) : (
            <StockPill state="OUT_OF_STOCK" availableQuantity={0} />
          )}

          <AddBundleButton bundle={bundle} />

          <p className="text-xs text-frame-300">
            Everything in the bundle is added together, and stays together in your cart.
          </p>
        </aside>
      </div>
    </div>
  );
}
