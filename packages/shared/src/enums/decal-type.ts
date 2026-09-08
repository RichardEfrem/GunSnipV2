/**
 * What the kit includes for markings (PRD §5.1). WATERSLIDE is the value that makes
 * decal setter a recommended requirement on the PDP (FR-PDP-08).
 */
export const DECAL_TYPES = ['NONE', 'STICKER', 'FOIL', 'DRY_TRANSFER', 'WATERSLIDE'] as const;

export type DecalType = (typeof DECAL_TYPES)[number];
