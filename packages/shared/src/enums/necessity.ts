/** How badly a kit needs a given tool (PRD §5.3). Ordering matters — it is the display order. */
export const NECESSITIES = ['REQUIRED', 'RECOMMENDED', 'OPTIONAL'] as const;

export type Necessity = (typeof NECESSITIES)[number];
