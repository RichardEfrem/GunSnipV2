/** Build difficulty (PRD §5.1). Drives the filter rail and the PDP spec block. */
export const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
