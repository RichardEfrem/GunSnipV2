/** The two product types that share the base product table (PRD §5.1). */
export const PRODUCT_TYPES = ['MODEL_KIT', 'TOOL_SUPPLY'] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];
