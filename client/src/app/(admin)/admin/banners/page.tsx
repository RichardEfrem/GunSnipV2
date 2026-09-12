import type { Metadata } from 'next';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchBanners } from '@/features/admin/api';
import { AdminPageHeader } from '@/features/admin/components/AdminPanel';
import { BannerManager } from '@/features/admin/components/BannerManager';
import { ApiError } from '@/lib/api-error';
import type { AdminBanner } from '@/features/admin/schema';

export const metadata: Metadata = { title: 'Banners' };

/**
 * Home-page banner curation (FR-ADM-12, FR-PROMO-04).
 *
 * Shows every banner, scheduled and finished alike — the point of a schedule is being able to
 * see what is queued. Which of them is actually showing right now is the server's `isLive`,
 * because the rule (active, and the clock inside the window) is the storefront's and must not be
 * recomputed here.
 */
export default async function AdminBannersPage() {
  let banners: AdminBanner[];

  try {
    banners = await fetchBanners();
  } catch (error) {
    return (
      <>
        <AdminPageHeader title="Banners" />
        <ErrorState
          title="The banners didn't load"
          description={error instanceof ApiError ? error.message : "The API didn't respond. Try again in a moment."}
        />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Banners"
        description="The home-page promo rail, in the order they appear. A banner shows when it is switched on and the clock is inside its window."
      />

      <BannerManager banners={banners} />
    </>
  );
}
