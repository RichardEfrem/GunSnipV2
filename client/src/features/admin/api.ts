import { adminApiFetch, queryString } from '@/lib/admin-api';
import {
  adminBannerListSchema,
  adminCategoryListSchema,
  adminOrderPageSchema,
  adminOrderSchema,
  adminProductPageSchema,
  adminProductSchema,
  adminReviewPageSchema,
  adminVoucherPageSchema,
  dashboardSchema,
  referenceListSchema,
  reviewCountsSchema,
  stockMovementPageSchema,
  type AdminBanner,
  type AdminCategory,
  type AdminDashboard,
  type AdminOrder,
  type AdminOrderSummary,
  type AdminProduct,
  type AdminProductSummary,
  type AdminReview,
  type AdminVoucher,
  type CursorPage,
  type ReferenceItem,
  type ReviewCounts,
  type StockMovement,
} from './schema';

/**
 * Every read the back office makes (CLAUDE.md: no fetch calls in components).
 *
 * Reads only. The writes are Server Actions in `actions.ts`, because a mutation has to
 * revalidate the pages it invalidated and a plain fetch cannot.
 */

export async function fetchDashboard(): Promise<AdminDashboard> {
  return adminApiFetch('/admin/dashboard', { schema: dashboardSchema });
}

// -------------------------------------------------------------------------------- products

export interface ProductListQuery {
  status?: string;
  type?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export async function fetchProducts(query: ProductListQuery): Promise<CursorPage<AdminProductSummary>> {
  return adminApiFetch(`/admin/products${queryString({ ...query })}`, { schema: adminProductPageSchema });
}

export async function fetchProduct(id: string): Promise<AdminProduct> {
  return adminApiFetch(`/admin/products/${id}`, { schema: adminProductSchema });
}

export async function fetchStockMovements(variantId: string, limit = 20): Promise<CursorPage<StockMovement>> {
  return adminApiFetch(`/admin/variants/${variantId}/movements${queryString({ limit })}`, {
    schema: stockMovementPageSchema,
  });
}

// ---------------------------------------------------------------------------------- orders

export interface OrderListQuery {
  status?: string;
  q?: string;
  placedFrom?: string;
  placedTo?: string;
  cursor?: string;
  limit?: number;
}

export async function fetchOrders(query: OrderListQuery): Promise<CursorPage<AdminOrderSummary>> {
  return adminApiFetch(`/admin/orders${queryString({ ...query })}`, { schema: adminOrderPageSchema });
}

export async function fetchOrder(orderNumber: string): Promise<AdminOrder> {
  return adminApiFetch(`/admin/orders/${orderNumber}`, { schema: adminOrderSchema });
}

// -------------------------------------------------------------------------- reference data

/** The five reference tables, fetched together because they are one screen. */
export async function fetchReference(): Promise<{
  grades: ReferenceItem[];
  scales: ReferenceItem[];
  series: ReferenceItem[];
  brands: ReferenceItem[];
  categories: AdminCategory[];
}> {
  const [grades, scales, series, brands, categories] = await Promise.all([
    adminApiFetch('/admin/reference/grades', { schema: referenceListSchema }),
    adminApiFetch('/admin/reference/scales', { schema: referenceListSchema }),
    adminApiFetch('/admin/reference/series', { schema: referenceListSchema }),
    adminApiFetch('/admin/reference/brands', { schema: referenceListSchema }),
    adminApiFetch('/admin/reference/categories', { schema: adminCategoryListSchema }),
  ]);

  return { grades, scales, series, brands, categories };
}

// -------------------------------------------------------------------------------- vouchers

export async function fetchVouchers(query: {
  isActive?: string;
  q?: string;
  cursor?: string;
}): Promise<CursorPage<AdminVoucher>> {
  return adminApiFetch(`/admin/vouchers${queryString({ ...query })}`, { schema: adminVoucherPageSchema });
}

// --------------------------------------------------------------------------------- reviews

export async function fetchReviews(query: { status?: string; q?: string; cursor?: string }): Promise<
  CursorPage<AdminReview>
> {
  return adminApiFetch(`/admin/reviews${queryString({ ...query })}`, { schema: adminReviewPageSchema });
}

export async function fetchReviewCounts(): Promise<ReviewCounts> {
  return adminApiFetch('/admin/reviews/counts', { schema: reviewCountsSchema });
}

// --------------------------------------------------------------------------------- banners

export async function fetchBanners(): Promise<AdminBanner[]> {
  return adminApiFetch('/admin/banners', { schema: adminBannerListSchema });
}
