import { env } from '@/lib/env';
import type { ProductDetail } from '../schema';

/**
 * Product + Offer + AggregateRating structured data (FR-PDP-14).
 *
 * A Server Component emitting one script tag. The values come from the same parsed response the
 * page renders, so the markup cannot describe a different price from the one on screen — which
 * is the failure mode that gets a store's rich results suppressed.
 *
 * `AggregateRating` is omitted when nothing has been reviewed. Google treats a rating of zero
 * reviews as invalid markup, and inventing `"ratingValue": 0` would be worse than saying
 * nothing.
 */
interface ProductJsonLdProps {
  product: ProductDetail;
}

export function ProductJsonLd({ product }: ProductJsonLdProps) {
  const url = `${env.NEXT_PUBLIC_SITE_URL}/products/${product.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description === null ? {} : { description: product.description }),
    sku: product.variants[0]?.sku,
    brand: { '@type': 'Brand', name: product.brand.name },
    ...(product.image === null
      ? {}
      : { image: [`${env.NEXT_PUBLIC_SITE_URL}${product.image.url}`] }),
    offers: {
      '@type': 'Offer',
      url,
      // IDR is a zero-decimal currency and the column is whole rupiah (PRD A2), so the integer
      // is already the correct price string.
      price: String(product.priceIdr),
      priceCurrency: 'IDR',
      availability:
        product.stockState === 'OUT_OF_STOCK'
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
    },
    ...(product.ratingAverage === null || product.reviewCount === 0
      ? {}
      : {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAverage,
            reviewCount: product.reviewCount,
          },
        }),
  };

  return (
    <script
      type="application/ld+json"
      // The content is built from parsed, typed values above rather than from user input, and
      // `JSON.stringify` escapes what it serialises — this is the documented way to emit
      // structured data in the App Router.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
