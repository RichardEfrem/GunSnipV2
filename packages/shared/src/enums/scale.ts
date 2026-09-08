/**
 * Kit scale codes (PRD §5.1). Held as the notation builders actually use, because it is
 * also what the card, spec block and filter rail print. Reference table, like grade.
 */
export const SCALE_CODES = ['1/144', '1/100', '1/60', '1/48', '1/72', 'NON_SCALE'] as const;

export type ScaleCode = (typeof SCALE_CODES)[number];
