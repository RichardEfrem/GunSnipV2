import { z } from 'zod';
import {
  DIFFICULTIES,
  INVENTORY_MOVEMENT_REASONS,
  NECESSITIES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  REVIEW_STATUSES,
  SHIPPING_TIERS,
  TOOL_JOBS,
  VOUCHER_TYPES,
} from '@gunsnip/shared';

/**
 * The back office's wire contract (CLAUDE.md non-negotiable #4).
 *
 * Every admin response is parsed through one of these, so a field the API stopped sending is a
 * failure at the fetch rather than an `undefined` three components deep. The enums come from
 * `@gunsnip/shared`, which is the same source the Postgres enums and the DTOs use — a status
 * added to the database cannot be forgotten here without the type failing to compile.
 *
 * These mirror the server's entity interfaces rather than its database rows. Where the server
 * decided something — `availableQuantity`, `nextStatuses`, `isLive` — this trusts it, because
 * recomputing a server's derivation on the client is how the two end up disagreeing.
 */
const isoDate = z.string();

/** One page of a cursor-paginated admin list. */
function cursorPage<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

// ------------------------------------------------------------------------------- dashboard

export const dashboardSchema = z.object({
  today: z.object({ orderCount: z.number().int(), revenueIdr: z.number().int() }),
  queues: z.object({
    awaitingPayment: z.number().int(),
    awaitingShipment: z.number().int(),
    pendingReviews: z.number().int(),
    lowStockCount: z.number().int(),
  }),
  lowStock: z.array(
    z.object({
      variantId: z.string(),
      sku: z.string(),
      productId: z.string(),
      productName: z.string(),
      variantName: z.string().nullable(),
      availableQuantity: z.number().int(),
    }),
  ),
  topProducts: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      slug: z.string(),
      unitsSold: z.number().int(),
    }),
  ),
  recentOrders: z.array(
    z.object({
      orderNumber: z.string(),
      status: z.enum(ORDER_STATUSES),
      customerName: z.string(),
      totalIdr: z.number().int(),
      placedAt: isoDate,
    }),
  ),
  generatedAt: isoDate,
});

export type AdminDashboard = z.infer<typeof dashboardSchema>;

// -------------------------------------------------------------------------------- products

const adminRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });

export const adminVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string().nullable(),
  optionValues: z.record(z.string(), z.string()),
  priceIdr: z.number().int(),
  compareAtPriceIdr: z.number().int().nullable(),
  stockOnHand: z.number().int(),
  stockReserved: z.number().int(),
  availableQuantity: z.number().int(),
  weightGrams: z.number().int(),
  barcode: z.string().nullable(),
  position: z.number().int(),
  isArchived: z.boolean(),
});

export const adminImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string(),
  blurDataUrl: z.string(),
  position: z.number().int(),
  isPrimary: z.boolean(),
});

export const adminRequirementSchema = z.object({
  toolProductId: z.string(),
  toolName: z.string(),
  toolSlug: z.string(),
  necessity: z.enum(NECESSITIES),
  reason: z.string().nullable(),
  position: z.number().int(),
});

export const adminProductSchema = z.object({
  id: z.string(),
  type: z.enum(PRODUCT_TYPES),
  status: z.enum(PRODUCT_STATUSES),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  brand: adminRefSchema,
  category: adminRefSchema,
  tags: z.array(z.string()),
  kit: z
    .object({
      gradeId: z.string().nullable(),
      scaleId: z.string().nullable(),
      seriesId: z.string().nullable(),
      unitName: z.string().nullable(),
      unitCode: z.string().nullable(),
      runnerCount: z.number().int().nullable(),
      partCount: z.number().int().nullable(),
      difficulty: z.enum(DIFFICULTIES).nullable(),
      decalType: z.string().nullable(),
      articulationNotes: z.string().nullable(),
      includes: z.array(z.string()),
      releaseYear: z.number().int().nullable(),
      runtimeMinutesEst: z.number().int().nullable(),
    })
    .nullable(),
  tool: z
    .object({ toolJob: z.enum(TOOL_JOBS).nullable(), attributes: z.record(z.string(), z.unknown()) })
    .nullable(),
  variants: z.array(adminVariantSchema),
  images: z.array(adminImageSchema),
  requirements: z.array(adminRequirementSchema),
  minPriceIdr: z.number().int(),
  maxPriceIdr: z.number().int(),
  unitsSold: z.number().int(),
  reviewCount: z.number().int(),
  publishedAt: isoDate.nullable(),
  updatedAt: isoDate,
});

export type AdminProduct = z.infer<typeof adminProductSchema>;
export type AdminVariant = z.infer<typeof adminVariantSchema>;
export type AdminImage = z.infer<typeof adminImageSchema>;

export const adminProductSummarySchema = z.object({
  id: z.string(),
  type: z.enum(PRODUCT_TYPES),
  status: z.enum(PRODUCT_STATUSES),
  name: z.string(),
  slug: z.string(),
  brandName: z.string(),
  categoryName: z.string(),
  imageUrl: z.string().nullable(),
  variantCount: z.number().int(),
  availableQuantity: z.number().int(),
  minPriceIdr: z.number().int(),
  maxPriceIdr: z.number().int(),
  updatedAt: isoDate,
});

export type AdminProductSummary = z.infer<typeof adminProductSummarySchema>;
export const adminProductPageSchema = cursorPage(adminProductSummarySchema);

// ---------------------------------------------------------------------------------- orders

export const adminOrderSummarySchema = z.object({
  orderNumber: z.string(),
  status: z.enum(ORDER_STATUSES),
  paymentStatus: z.enum(PAYMENT_STATUSES).nullable(),
  customerName: z.string(),
  customerEmail: z.string(),
  itemCount: z.number().int(),
  totalIdr: z.number().int(),
  placedAt: isoDate,
});

export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;
export const adminOrderPageSchema = cursorPage(adminOrderSummarySchema);

export const adminOrderSchema = z.object({
  orderNumber: z.string(),
  status: z.enum(ORDER_STATUSES),
  placedAt: isoDate,
  canCancel: z.boolean(),
  cancelReason: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      productName: z.string(),
      variantName: z.string().nullable(),
      sku: z.string(),
      productSlug: z.string(),
      imageUrl: z.string().nullable(),
      unitPriceIdr: z.number().int(),
      quantity: z.number().int(),
      lineTotalIdr: z.number().int(),
    }),
  ),
  totals: z.object({
    subtotalIdr: z.number().int(),
    discountIdr: z.number().int(),
    shippingIdr: z.number().int(),
    totalIdr: z.number().int(),
  }),
  voucherCode: z.string().nullable(),
  contact: z.object({ name: z.string(), email: z.string(), phone: z.string() }),
  address: z.object({
    street: z.string(),
    district: z.string().nullable(),
    city: z.string().nullable(),
    province: z.string(),
    postalCode: z.string(),
    notes: z.string().nullable(),
  }),
  delivery: z.object({ tier: z.enum(SHIPPING_TIERS), minDays: z.number().int(), maxDays: z.number().int() }),
  payment: z
    .object({
      method: z.enum(PAYMENT_METHODS),
      status: z.enum(PAYMENT_STATUSES),
      amountIdr: z.number().int(),
      expiresAt: isoDate,
      instructions: z.unknown().nullable(),
    })
    .nullable(),
  internalNote: z.string().nullable(),
  shipment: z
    .object({
      courier: z.string(),
      trackingNumber: z.string().nullable(),
      estimatedDays: z.number().int(),
      shippedAt: isoDate.nullable(),
      deliveredAt: isoDate.nullable(),
    })
    .nullable(),
  nextStatuses: z.array(z.enum(ORDER_STATUSES)),
  timeline: z.array(
    z.object({
      status: z.enum(ORDER_STATUSES),
      at: isoDate,
      note: z.string().nullable(),
      actorKind: z.string(),
      actorId: z.string().nullable(),
    }),
  ),
  paymentProviderRef: z.string().nullable(),
  paymentStatus: z.enum(PAYMENT_STATUSES).nullable(),
  sessionId: z.string(),
});

export type AdminOrder = z.infer<typeof adminOrderSchema>;

// ------------------------------------------------------------------------- reference data

export const referenceItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  usageCount: z.number().int(),
});

export type ReferenceItem = z.infer<typeof referenceItemSchema>;
export const referenceListSchema = z.array(referenceItemSchema);

export const adminCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(PRODUCT_TYPES),
  parentId: z.string().nullable(),
  position: z.number().int(),
  usageCount: z.number().int(),
  depth: z.number().int(),
});

export type AdminCategory = z.infer<typeof adminCategorySchema>;
export const adminCategoryListSchema = z.array(adminCategorySchema);

// -------------------------------------------------------------------------------- vouchers

export const adminVoucherSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(VOUCHER_TYPES),
  description: z.string().nullable(),
  percentOff: z.number().int().nullable(),
  amountIdr: z.number().int().nullable(),
  minSpendIdr: z.number().int().nullable(),
  maxDiscountIdr: z.number().int().nullable(),
  startsAt: isoDate,
  endsAt: isoDate,
  usageLimit: z.number().int().nullable(),
  perSessionLimit: z.number().int().nullable(),
  usedCount: z.number().int(),
  redemptionCount: z.number().int(),
  isActive: z.boolean(),
  categoryIds: z.array(z.string()),
  productIds: z.array(z.string()),
  createdAt: isoDate,
});

export type AdminVoucher = z.infer<typeof adminVoucherSchema>;
export const adminVoucherPageSchema = cursorPage(adminVoucherSchema);

// --------------------------------------------------------------------------------- reviews

export const adminReviewSchema = z.object({
  id: z.string(),
  status: z.enum(REVIEW_STATUSES),
  product: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  authorName: z.string(),
  rating: z.number().int(),
  title: z.string(),
  body: z.string(),
  isVerifiedPurchase: z.boolean(),
  buildTimeMinutes: z.number().int().nullable(),
  experiencedDifficulty: z.enum(DIFFICULTIES).nullable(),
  toolsUsed: z.array(z.string()),
  photos: z.array(z.object({ id: z.string(), url: z.string(), alt: z.string() })),
  adminReply: z.string().nullable(),
  moderatedAt: isoDate.nullable(),
  createdAt: isoDate,
});

export type AdminReview = z.infer<typeof adminReviewSchema>;
export const adminReviewPageSchema = cursorPage(adminReviewSchema);

export const reviewCountsSchema = z.object({
  pending: z.number().int(),
  approved: z.number().int(),
  rejected: z.number().int(),
});

export type ReviewCounts = z.infer<typeof reviewCountsSchema>;

// --------------------------------------------------------------------------------- banners

export const adminBannerSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  imageUrl: z.string(),
  alt: z.string(),
  href: z.string(),
  position: z.number().int(),
  startsAt: isoDate.nullable(),
  endsAt: isoDate.nullable(),
  isActive: z.boolean(),
  isLive: z.boolean(),
});

export type AdminBanner = z.infer<typeof adminBannerSchema>;
export const adminBannerListSchema = z.array(adminBannerSchema);

// ----------------------------------------------------------------------------------- stock

export const stockLevelSchema = z.object({
  variantId: z.string(),
  sku: z.string(),
  productName: z.string(),
  variantName: z.string().nullable(),
  stockOnHand: z.number().int(),
  stockReserved: z.number().int(),
  availableQuantity: z.number().int(),
});

export const stockMovementSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  sku: z.string(),
  productName: z.string(),
  delta: z.number().int(),
  reason: z.enum(INVENTORY_MOVEMENT_REASONS),
  note: z.string().nullable(),
  actorKind: z.string(),
  orderNumber: z.string().nullable(),
  createdAt: isoDate,
});

export type StockMovement = z.infer<typeof stockMovementSchema>;
export const stockMovementPageSchema = cursorPage(stockMovementSchema);
