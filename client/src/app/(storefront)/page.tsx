import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchHome } from '@/features/catalog/api';
import { ProductRail } from '@/features/catalog/components/ProductRail';
import type { HomeContent } from '@/features/catalog/schema';

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
            <Link href="/">
              <Button variant="secondary">Try again</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 py-6">
      <Hero />

      <section className="mx-auto w-full max-w-content px-4 md:px-6">
        <h2 className="sr-only">Browse by grade</h2>
        <ul className="flex flex-wrap gap-2">
          {content.gradeShortcuts.map((grade) => (
            <li key={grade.code}>
              <Link
                href={`/kits?grade=${grade.code}`}
                className="reticle chamfer flex min-h-11 items-center gap-2 border border-armor-150 bg-armor-000 px-3 font-display text-sm font-semibold transition-colors duration-fast ease-out hover:border-core-blue"
              >
                {grade.code}
                <span className="font-normal tabular-nums text-frame-300">{grade.productCount}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/tools"
              className="reticle chamfer flex min-h-11 items-center border border-armor-150 bg-armor-000 px-3 font-display text-sm font-semibold transition-colors duration-fast ease-out hover:border-core-blue"
            >
              Tools
            </Link>
          </li>
        </ul>
      </section>

      <ProductRail title="New arrivals" products={content.newArrivals} href="/kits" isPriority />

      <FirstBuild />

      <ProductRail title="Back in stock" products={content.backInStock} href="/kits?inStock=true" />
      <ProductRail title="Tools and supplies" products={content.tools} href="/tools" />

      {content.banners.length === 0 ? null : (
        <section className="mx-auto w-full max-w-content px-4 md:px-6">
          <h2 className="mb-3 text-xl">Offers</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {content.banners.map((banner) => (
              <li key={banner.id}>
                <Link
                  href={banner.href}
                  className="reticle chamfer flex flex-col gap-1 border border-armor-150 bg-armor-000 p-4 transition-colors duration-fast ease-out hover:border-core-blue"
                >
                  <span className="font-display text-base font-semibold">{banner.title}</span>
                  {banner.subtitle === null ? null : (
                    <span className="text-sm text-frame-300">{banner.subtitle}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * One static image, no carousel (DESIGN.md §3.1). Layout rather than data, which is why it
 * takes no props — nothing about it is operator-curated.
 */
function Hero() {
  return (
    <section className="mx-auto w-full max-w-content px-4 md:px-6">
      <div className="chamfer flex flex-col items-start gap-3 border border-armor-150 bg-frame-900 px-6 py-12 md:px-10 md:py-16">
        <p className="font-display text-sm font-semibold uppercase tracking-wide text-frame-muted">
          Gunpla, shipped across Indonesia
        </p>
        <h1 className="max-w-measure text-3xl text-white md:text-4xl">
          Kits, tools, and the parts list nobody tells you about.
        </h1>
        <p className="max-w-measure text-frame-muted">
          Every kit page lists what you actually need to build it — so the nipper arrives in the
          same box.
        </p>
        <Link href="/kits" className="mt-2">
          <Button>Browse kits</Button>
        </Link>
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
        <Link href="/kits?difficulty=BEGINNER&inStock=true" className="mt-2">
          <Button variant="secondary">Start here</Button>
        </Link>
      </div>
    </section>
  );
}
