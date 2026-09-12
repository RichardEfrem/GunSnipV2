import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { bundleSavingIdr, type BundleComponent } from './bundle-allocation.js';
import { BundleRepository, type BundleRow } from './bundle.repository.js';
import type { BundleComponentView, BundleSummary } from './entities/bundle.entity.js';
import { toStockState } from './product-mapper.js';

/** A reasonable ceiling for a curated list nobody paginates. */
const MAX_BUNDLES = 12;

/**
 * Curated bundles (FR-CAT-11).
 *
 * A bundle is only as available as its scarcest component, so availability is computed rather
 * than stored: `min(floor(available / perBundleQuantity))` across the components. That single
 * number is what the card renders and what stops an "Add bundle" that could not be shipped —
 * and it costs nothing to keep correct, because it is derived from the same stock columns the
 * variant pages read.
 */
@Injectable()
export class BundleService {
  constructor(private readonly bundles: BundleRepository) {}

  async list(now: Date = new Date()): Promise<BundleSummary[]> {
    return (await this.bundles.listLive(now, MAX_BUNDLES)).map(toBundleSummary);
  }

  async detail(slug: string, now: Date = new Date()): Promise<BundleSummary> {
    const row = await this.bundles.findLiveBySlug(slug, now);
    if (row === null) throw new NotFoundError('No bundle with that slug.', { slug });

    return toBundleSummary(row);
  }

  /** The same read by id, for a bundle already in a cart. */
  async componentsOfId(id: string, now: Date = new Date()): Promise<{ row: BundleRow; components: BundleComponent[] }> {
    const row = await this.bundles.findLiveById(id, now);
    if (row === null) throw new NotFoundError('That bundle is no longer available.', { id });

    return { row, components: toComponents(row) };
  }

  /** The components as the allocator needs them — the shape money is spread across. */
  async componentsOf(slug: string, now: Date = new Date()): Promise<{ row: BundleRow; components: BundleComponent[] }> {
    const row = await this.bundles.findLiveBySlug(slug, now);
    if (row === null) throw new NotFoundError('No bundle with that slug.', { slug });

    return { row, components: toComponents(row) };
  }
}

export function toComponents(row: BundleRow): BundleComponent[] {
  return row.items.map((item) => ({
    variantId: item.variant.id,
    quantity: item.quantity,
    catalogueUnitPriceIdr: item.variant.priceIdr,
  }));
}

/** How many whole bundles the scarcest component allows. */
export function bundleAvailability(row: BundleRow): number {
  if (row.items.length === 0) return 0;

  return Math.min(
    ...row.items.map((item) => {
      const { variant } = item;
      const isSellable = !variant.isArchived && variant.product.status === 'PUBLISHED';
      if (!isSellable) return 0;

      const available = Math.max(0, variant.stockOnHand - variant.stockReserved);
      return Math.floor(available / Math.max(1, item.quantity));
    }),
  );
}

function toBundleSummary(row: BundleRow): BundleSummary {
  const components = toComponents(row);
  const catalogueTotal = components.reduce(
    (total, component) => total + component.catalogueUnitPriceIdr * component.quantity,
    0,
  );
  const savingIdr = bundleSavingIdr(row.priceIdr, components);
  const availableQuantity = bundleAvailability(row);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceIdr: row.priceIdr,
    // Null rather than the catalogue total when there is no saving, so the card cannot strike
    // through a price that is not actually higher (FR-PROMO-03).
    compareAtPriceIdr: savingIdr > 0 ? catalogueTotal : null,
    savingIdr,
    availableQuantity,
    stockState: toStockState(availableQuantity),
    isPurchasable: availableQuantity > 0,
    image: toImage(row.items[0]),
    components: row.items.map(toComponentView),
  };
}

function toComponentView(item: BundleRow['items'][number]): BundleComponentView {
  const { variant } = item;

  return {
    variantId: variant.id,
    quantity: item.quantity,
    productSlug: variant.product.slug,
    productName: variant.product.name,
    variantName: variant.name,
    sku: variant.sku,
    catalogueUnitPriceIdr: variant.priceIdr,
    availableQuantity: Math.max(0, variant.stockOnHand - variant.stockReserved),
    image: toImage(item),
  };
}

function toImage(item: BundleRow['items'][number] | undefined) {
  const image = item?.variant.product.images[0];

  return image === undefined ? null : { url: image.url, alt: image.alt, blurDataUrl: image.blurDataUrl };
}
