import { pruneBannerPlaceholders, writeBannerPlaceholder } from '../banner-placeholder.ts';
import { loadBannerPhotos } from '../banner-photo.ts';
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

  await pruneBannerPlaceholders(BANNERS.map((banner) => bannerSlug(banner.href)));
  const photos = await loadBannerPhotos();

  for (const banner of BANNERS) {
    // Photography when the manifest has it, a generated placeholder otherwise — either way the
    // seed points at a file that exists, so the rail and the admin screen render something
    // real. An operator replaces the image in admin (Banners → Edit) later (FR-ADM-12).
    const slug = bannerSlug(banner.href);
    const photo = photos.get(slug);

    await prisma.banner.create({
      data: {
        title: banner.title,
        subtitle: banner.subtitle,
        imageUrl: photo?.url ?? (await writeBannerPlaceholder({ slug, code: banner.href })),
        alt: photo?.alt ?? banner.alt,
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

/** A banner's file is named after where it links, so the pruner and the writer agree on it. */
function bannerSlug(href: string): string {
  return href.replaceAll('/', '-').replace(/^-/, '');
}
