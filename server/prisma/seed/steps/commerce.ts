import { prisma } from '../client.ts';
import { BANNERS, BUNDLES, VOUCHERS } from '../data/commerce.ts';
import type { ReferenceIds } from './reference.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vouchers, bundles and home-page banners. */
export async function seedCommerce(
  refs: ReferenceIds,
  variantIdBySku: Map<string, string>,
): Promise<{ vouchers: number; bundles: number; banners: number }> {
  const now = Date.now();

  for (const voucher of VOUCHERS) {
    await prisma.voucher.create({
      data: {
        code: voucher.code,
        type: voucher.type,
        percentOff: voucher.percentOff ?? null,
        amountIdr: voucher.amountIdr ?? null,
        minSpendIdr: voucher.minSpendIdr ?? null,
        maxDiscountIdr: voucher.maxDiscountIdr ?? null,
        startsAt: new Date(now + voucher.startsInDays * DAY_MS),
        endsAt: new Date(now + voucher.endsInDays * DAY_MS),
        usageLimit: voucher.usageLimit ?? null,
        perSessionLimit: voucher.perSessionLimit ?? null,
        usedCount: voucher.usedCount ?? 0,
        isActive: voucher.isActive ?? true,
        description: voucher.description,
        categories: {
          connect: (voucher.categorySlugs ?? []).map((slug) => ({
            id: required(refs.categoryIdBySlug, slug, 'category'),
          })),
        },
      },
    });
  }

  for (const bundle of BUNDLES) {
    await prisma.bundle.create({
      data: {
        slug: bundle.slug,
        name: bundle.name,
        description: bundle.description,
        priceIdr: bundle.priceIdr,
        items: {
          create: bundle.items.map((item, index) => ({
            variantId: required(variantIdBySku, item.sku, 'variant'),
            quantity: item.quantity,
            position: index * 10,
          })),
        },
      },
    });
  }

  for (const banner of BANNERS) {
    await prisma.banner.create({
      data: {
        title: banner.title,
        subtitle: banner.subtitle,
        // Banner artwork is out of scope for the seed; Phase 10 curates real imagery
        // (FR-ADM-12). The path is shaped like the one an upload will produce.
        imageUrl: `/media/banners/${banner.href.replaceAll('/', '-').replace(/^-/, '')}.svg`,
        alt: banner.alt,
        href: banner.href,
        position: banner.position,
      },
    });
  }

  return { vouchers: VOUCHERS.length, bundles: BUNDLES.length, banners: BANNERS.length };
}

function required(source: Map<string, string>, key: string, what: string): string {
  const id = source.get(key);
  if (id === undefined) throw new Error(`Seed refers to unknown ${what} "${key}"`);
  return id;
}
