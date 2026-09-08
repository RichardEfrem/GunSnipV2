/** Publication state of a product. Only PUBLISHED is visible on the storefront (FR-ADM-02). */
export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
