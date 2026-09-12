import { ApiError } from '@/lib/api-error';
import { fetchCheckoutQuote, fetchRegions } from './api';
import { draftRegionId, type CheckoutDraft } from './draft';
import type { CheckoutQuote, Region } from './schema';

/**
 * Everything the checkout page renders, fetched on the server in one pass (FR-CO-10): the quote
 * for the saved address and tier, and the province, city and district lists that address needs.
 *
 * The saved draft is reconciled against the region tree first. A city that is not in the saved
 * province, or a district that was removed since the cookie was written, is dropped rather than
 * trusted — the form then asks for it again, which is the honest thing a stale draft can do.
 */
export interface CheckoutData {
  draft: CheckoutDraft;
  quote: CheckoutQuote;
  provinces: Region[];
  cities: Region[];
  districts: Region[];
}

export async function loadCheckout(saved: CheckoutDraft): Promise<CheckoutData> {
  const [provinces, cities, districts] = await Promise.all([
    fetchRegions(null),
    saved.provinceId === null ? [] : fetchRegions(saved.provinceId),
    saved.cityId === null ? [] : fetchRegions(saved.cityId),
  ]);

  const draft = reconcile(saved, { provinces, cities, districts });

  return {
    draft,
    quote: await quoteFor(draft),
    provinces,
    cities: draft.provinceId === null ? [] : cities,
    districts: draft.cityId === null ? [] : districts,
  };
}

function reconcile(
  draft: CheckoutDraft,
  lists: { provinces: Region[]; cities: Region[]; districts: Region[] },
): CheckoutDraft {
  const has = (list: Region[], id: string | null) => id !== null && list.some((region) => region.id === id);

  const provinceId = has(lists.provinces, draft.provinceId) ? draft.provinceId : null;
  const cityId = provinceId !== null && has(lists.cities, draft.cityId) ? draft.cityId : null;
  const districtId = cityId !== null && has(lists.districts, draft.districtId) ? draft.districtId : null;

  return { ...draft, provinceId, cityId, districtId };
}

/** A region the API no longer knows quotes as no region, rather than failing the page. */
async function quoteFor(draft: CheckoutDraft): Promise<CheckoutQuote> {
  const regionId = draftRegionId(draft);

  try {
    return await fetchCheckoutQuote({ regionId, shippingTier: draft.shippingTier });
  } catch (cause) {
    if (regionId !== null && cause instanceof ApiError && cause.isNotFound) {
      return fetchCheckoutQuote({ regionId: null, shippingTier: draft.shippingTier });
    }
    throw cause;
  }
}
