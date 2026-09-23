import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { buttonStyles } from '@/components/ui/button-styles';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchBundles } from '@/features/bundles/api';
import { BundleCard } from '@/features/bundles/components/BundleCard';
import type { Bundle } from '@/features/bundles/schema';
import { fetchHome } from '@/features/catalog/api';
import { GradeShortcuts } from '@/features/catalog/components/GradeShortcuts';
import { ProductRail } from '@/features/catalog/components/ProductRail';
import type { HomeContent } from '@/features/catalog/schema';
import { isVectorImage } from '@/lib/image';

/**
 * The home page (FR-CAT-01).
 *
 * One static hero and **no carousel** (DESIGN.md §3.1): slide two is rarely seen and rotation
 * steals attention from navigation. Promotions get their own rail lower down instead.
 *
 * The grade shortcuts are real navigation, not decoration — for most visitors the grade is the
 * first decision, so it is the first thing under the hero.
 */
export default async function HomePage() {
  let content: HomeContent;

  try {
    content = await fetchHome();
  } catch {
    return (
      <div className="mx-auto max-w-content px-4 py-6 md:px-6">
        <ErrorState
          title="Couldn't load the shop"
          description="The catalogue didn't respond. Everything in your cart is still there — try again in a moment."
          action={
            <Link href="/" className={buttonStyles('secondary')}>
              Try again
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 py-6">
      <Hero />

      <GradeShortcuts grades={content.gradeShortcuts} className="mx-auto w-full max-w-content px-4 md:px-6" />

      <ProductRail title="New arrivals" products={content.newArrivals} href="/kits" isPriority />

      <FirstBuild />

      {/* "See all" lands on the nearest sort the listing has. `top_rated` orders by the raw
          average where the rail weights it by review count, so the listing's first row is a
          close relative of the rail rather than a copy of it. */}
      <ProductRail title="Most popular" products={content.mostPopular} href="/kits?sort=top_rated" />
      <ProductRail title="Tools and supplies" products={content.tools} href="/tools" />

      {/* Streamed: a curated set is worth showing, but it must not hold up the rails above it. */}
      <Suspense fallback={null}>
        <BundleRail />
      </Suspense>

      {content.banners.length === 0 ? null : (
        <section className="mx-auto w-full max-w-content px-4 md:px-6">
          <h2 className="mb-3 text-xl">Offers</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {content.banners.map((banner) => (
              <li key={banner.id}>
                <Link
                  href={banner.href}
                  className="reticle chamfer flex flex-col border border-armor-150 bg-armor-000 transition-colors duration-fast ease-out hover:border-core-blue"
                >
                  {/* The banner's own 1600×540 ratio: artwork is composed for it, so a different
                      box would crop through the subject rather than scale it. */}
                  <div className="relative aspect-1600/540 overflow-hidden bg-armor-050">
                    <Image
                      src={banner.imageUrl}
                      alt={banner.alt}
                      fill
                      // Two up from 768px inside the 1280px content column, full width below.
                      sizes="(min-width: 1280px) 620px, (min-width: 768px) 50vw, 100vw"
                      unoptimized={isVectorImage(banner.imageUrl)}
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-4">
                    <span className="font-display text-base font-semibold">{banner.title}</span>
                    {banner.subtitle === null ? null : (
                      <span className="text-sm text-frame-300">{banner.subtitle}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Curated bundles (FR-CAT-11), below the catalogue rails. */
async function BundleRail() {
  // Only the await is guarded. JSX built inside a `try` would not have its *render* errors caught
  // by it — React renders the element later, by which point this function has returned — so the
  // fetch and the markup are kept apart, as the product page does.
  let bundles: Bundle[] = [];

  try {
    bundles = await fetchBundles();
  } catch {
    // A rail is an extra. Losing one is not worth an error message on a page that works.
    return null;
  }

  // Renders nothing when there are none, rather than an empty heading — a bundle is an operator's
  // choice, and a shop with none should not advertise the absence.
  if (bundles.length === 0) return null;

  return (
    <section aria-labelledby="bundles-rail" className="mx-auto w-full max-w-content px-4 md:px-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="bundles-rail" className="text-xl">
          Bundles
        </h2>
        <Link href="/bundles" className="reticle rounded-sm text-sm font-medium text-core-blue">
          See all
        </Link>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.slice(0, 3).map((bundle) => (
          <li key={bundle.id}>
            <BundleCard bundle={bundle} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One static image, no carousel (DESIGN.md §3.1). Layout rather than data, which is why it
 * takes no props — nothing about it is operator-curated.
 *
 * `hero.jpg` is a lineup of Real Grade kits on a --frame-900 canvas, composed by
 * `scripts/fetch-banner-images.mjs`: the left 2/5 is plain canvas, the kits fill the rest.
 * Stacked below `lg`; side by side from `lg`, with the text in that plain 2/5 (`lg:w-2/5` here
 * and `HERO_TEXT_SHARE` there — change one, change both).
 *
 * Between `lg` and `xl` the box is narrower than the image's ratio, so `object-cover` trims the
 * left and the first kit slides under the text. The scrim holds the text column at solid
 * --frame-900 regardless, so the pairs `check-contrast.mjs` verified hold at every width; at
 * full width it lands on the image's own fade and changes nothing.
 */
function Hero() {
  return (
    <section className="mx-auto w-full max-w-content px-4 md:px-6">
      <div className="chamfer relative flex flex-col overflow-hidden border border-armor-150 bg-frame-900 lg:min-h-104">
        <div className="relative aspect-4/3 sm:aspect-video lg:absolute lg:inset-0 lg:aspect-auto">
          <Image
            src="/media/promo/hero.jpg"
            alt="Real Grade Wing Gundam Zero EW, RX-78-2, Sazabi and Strike Freedom standing in a row"
            fill
            priority
            // Full width of the content column: 1232px inside its padding at ≥1280.
            sizes="(min-width: 1280px) 1232px, 100vw"
            className="object-cover object-right"
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-frame-900 from-40% to-transparent to-44% lg:block"
        />
        <div className="relative flex flex-col items-start gap-3 px-6 py-8 md:px-10 lg:w-2/5 lg:py-16">
          <p className="font-display text-sm font-semibold text-frame-muted">
            Gunpla, shipped across Indonesia
          </p>
          <h1 className="text-3xl text-white md:text-4xl">From your first Entry Grade to a Perfect Grade</h1>
          <p className="max-w-measure text-frame-muted">
            Kits from 1/144 to 1/48, and the nippers, panel liners and topcoats that finish them.
            Every kit page lists the tools it needs, so they arrive in the same box.
          </p>
          <Link href="/kits" className={buttonStyles('primary', 'mt-2')}>
            Browse kits
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The first-build entry point (FR-CAT-01). */
function FirstBuild() {
  return (
    <section className="mx-auto w-full max-w-content px-4 md:px-6">
      <div className="chamfer flex flex-col items-start gap-2 border border-armor-150 bg-armor-000 p-6">
        <h2 className="text-xl">First kit?</h2>
        <p className="max-w-measure text-frame-300">
          Three kits, one tool, no glue. About two hours each, and nothing you buy here is wasted
          on the next one.
        </p>
        <Link href="/kits?difficulty=BEGINNER&inStock=true" className={buttonStyles('secondary', 'mt-2')}>
          Start here
        </Link>
      </div>
    </section>
  );
}
