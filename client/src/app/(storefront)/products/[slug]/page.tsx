import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchProduct, fetchRelated, fetchRequirements } from '@/features/catalog/api';
import { BuildRequirements } from '@/features/catalog/components/BuildRequirements';
import { ProductGallery } from '@/features/catalog/components/ProductGallery';
import { ProductJsonLd } from '@/features/catalog/components/ProductJsonLd';
import { ProductRail } from '@/features/catalog/components/ProductRail';
import { ProductSpecs } from '@/features/catalog/components/ProductSpecs';
import { ProductTabs, type ProductTab } from '@/features/catalog/components/ProductTabs';
import { PurchasePanel } from '@/features/catalog/components/PurchasePanel';
import type { BuildRequirement, ProductDetail, RelatedProducts } from '@/features/catalog/schema';
import { fetchCart } from '@/features/cart/api';
import { ApiError } from '@/lib/api-error';
import { formatCount, formatRating } from '@/lib/formatters';

/**
 * The product detail page (FR-PDP-01 … FR-PDP-14, DESIGN.md §3.5).
 *
 * A Server Component. Four things cross into client code and no more: the gallery (swipe and
 * arrow keys), the buy block (variant, quantity, add), the requirements block (selection), and
 * the tabs. Everything else — specs, description, related rails, structured data — is rendered
 * once on the server and ships no JavaScript.
 *
 * The page awaits the product because the whole layout depends on it, and streams the two
 * secondary reads: the requirements block and the related rails each arrive in their own
 * `Suspense` boundary rather than holding up the price and the buy button behind a third
 * round trip.
 */
export async function generateMetadata({ params }: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params;

  try {
    const product = await fetchProduct(slug);

    return {
      title: product.name,
      description: product.description ?? undefined,
      // Resolved against `metadataBase` in the root layout (FR-PDP-14).
      alternates: { canonical: `/products/${product.slug}` },
      openGraph: {
        title: product.name,
        description: product.description ?? undefined,
        images: product.image === null ? undefined : [product.image.url],
      },
    };
  } catch {
    // The page raises the 404; metadata must not be the thing that throws.
    return {};
  }
}

export default async function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params;

  let product: ProductDetail;

  try {
    product = await fetchProduct(slug);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    throw cause;
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-6 md:px-6">
      <ProductJsonLd product={product} />

      <Breadcrumbs
        crumbs={[
          { label: 'Home', href: '/' },
          ...product.breadcrumbs.map((crumb) => ({ label: crumb.name, href: `/${crumb.slug}` })),
          { label: product.name, href: `/products/${product.slug}` },
        ]}
      />

      {/* Mobile stacks gallery → title/price/stock → buy → requirements → specs → tabs
          (DESIGN.md §3.5). The grid below is the desktop two-column arrangement. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className="flex flex-col gap-8">
          <ProductGallery product={product} />

          {/* Desktop only: on mobile the specs belong below the buy block, and they are
              rendered there instead. */}
          <div className="hidden lg:block">
            <ProductSpecs product={product} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <ProductHeader product={product} />

          <PurchasePanel product={product} />

          {/* Streamed: the block is the page's reason to exist but it must not delay the price
              (DESIGN.md §3.5). */}
          <Suspense fallback={<RequirementsSkeleton />}>
            <RequirementsBlock slug={slug} />
          </Suspense>

          <div className="lg:hidden">
            <ProductSpecs product={product} />
          </div>
        </div>
      </div>

      <ProductTabs tabs={buildTabs(product)} />

      <Suspense fallback={null}>
        <RelatedRails slug={slug} />
      </Suspense>
    </div>
  );
}

/** Name, brand, and the social proof that decides whether the price is worth reading. */
function ProductHeader({ product }: { product: ProductDetail }) {
  const runner = [product.grade?.code, product.scale?.code === 'NON_SCALE' ? null : product.scale?.code]
    .filter((part) => part !== null && part !== undefined)
    .join(' · ');

  return (
    <header className="flex flex-col gap-2">
      {runner === '' ? null : (
        // Grade and scale are machine identifiers, so mono; the series is a name, so it is not
        // (DESIGN.md §2.2 — mono is only for identifiers).
        <p className="text-xs text-frame-300">
          <span className="font-mono">{runner}</span>
          {product.series === null ? null : ` · ${product.series.name}`}
        </p>
      )}

      <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">{product.name}</h1>

      <p className="text-xs text-frame-300">
        {product.brand.name}
        {product.variants[0] === undefined ? null : ` · SKU ${product.variants[0].sku}`}
      </p>

      <p className="text-xs text-frame-300">
        {product.ratingAverage === null ? (
          // Not "0 reviews": unreviewed is unknown, not badly rated.
          <span>No reviews yet</span>
        ) : (
          <span>
            <span aria-hidden>★ </span>
            {formatRating(product.ratingAverage)}
            <span className="sr-only"> out of 5</span> ({formatCount(product.reviewCount)})
          </span>
        )}
        {product.unitsSold > 0 && <span> · {formatCount(product.unitsSold)} sold</span>}
      </p>
    </header>
  );
}

/**
 * The requirements block and the cart it has to know about, fetched together.
 *
 * The cart read lives here rather than in the page so it is inside the same `Suspense`
 * boundary — it is only ever used to mark rows "Already in cart" (FR-PDP-08), and making the
 * price wait on a per-visitor, uncacheable request to learn that would be the wrong trade.
 */
async function RequirementsBlock({ slug }: { slug: string }) {
  // Only the awaits are guarded. JSX built inside a `try` would not have its *render* errors
  // caught by it — React renders the element later, by which point the block has returned —
  // so the fetch and the markup are kept apart.
  let data: { requirements: BuildRequirement[]; inCartVariantIds: string[] } | null = null;

  try {
    const [requirements, cart] = await Promise.all([fetchRequirements(slug), fetchCart()]);
    data = { requirements, inCartVariantIds: cart.lines.map((line) => line.variantId) };
  } catch {
    data = null;
  }

  // A failed requirements read must not take the buy button down with it — the page's job is
  // still to sell the kit (DESIGN.md §4.5).
  if (data === null) {
    return (
      <ErrorState
        title="Couldn't load the tool list"
        description="The kit is still available to buy."
      />
    );
  }

  return (
    <BuildRequirements
      requirements={data.requirements}
      inCartVariantIds={data.inCartVariantIds}
    />
  );
}

async function RelatedRails({ slug }: { slug: string }) {
  let related: RelatedProducts | null = null;

  try {
    related = await fetchRelated(slug);
  } catch {
    // A rail is an extra. Losing one is not worth an error message on a page that otherwise works.
    related = null;
  }

  if (related === null) return null;

  // Both rails render nothing when empty, so a product with no siblings shows no headings.
  return (
    <div className="flex flex-col gap-8">
      <ProductRail title="Also available as" products={related.sameUnit} />
      <ProductRail title="From the same series" products={related.sameSeries} />
    </div>
  );
}

function RequirementsSkeleton() {
  return (
    <div className="flex flex-col gap-3 border border-armor-150 bg-armor-050 p-4">
      <Skeleton className="h-5 w-56" />
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-11 w-full" />
      ))}
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

/**
 * The lower tabs (FR-PDP-09).
 *
 * Reviews and shipping are placeholders naming the phase that fills them, rather than tabs that
 * silently do not exist — a tab row that changes shape between products is harder to read than
 * one with an honest empty state (DESIGN.md §4.5).
 */
function buildTabs(product: ProductDetail): ProductTab[] {
  return [
    {
      id: 'description',
      label: 'Description',
      content:
        product.description === null ? (
          <p className="text-frame-300">No description yet.</p>
        ) : (
          <p className="max-w-prose">{product.description}</p>
        ),
    },
    {
      id: 'specifications',
      label: 'Specifications',
      content: <ProductSpecs product={product} />,
    },
    {
      id: 'reviews',
      label: `Reviews (${formatCount(product.reviewCount)})`,
      content: <p className="text-frame-300">Reviews arrive with the review system.</p>,
    },
    {
      id: 'shipping',
      label: 'Shipping',
      content: (
        <p className="max-w-prose text-frame-300">
          Shipped from Jakarta. Courier options and delivery estimates are calculated at checkout
          from your address.
        </p>
      ),
    },
  ];
}
