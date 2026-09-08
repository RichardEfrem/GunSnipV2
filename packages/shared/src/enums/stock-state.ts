/**
 * Stock state as shown on cards and the PDP (FR-PDP-05). Derived server-side from
 * `stock_on_hand - stock_reserved` so the client never recomputes availability.
 */
export const STOCK_STATES = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PREORDER'] as const;

export type StockState = (typeof STOCK_STATES)[number];

/** Available quantity at or below which a variant reads as LOW_STOCK (DESIGN.md §4.3). */
export const LOW_STOCK_THRESHOLD = 5;
