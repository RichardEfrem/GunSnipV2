/**
 * Gunpla grade codes (PRD §5.1). Grades are a reference table so the operator can edit
 * their copy (FR-ADM-09); these codes are the stable keys the seed and filter rail use.
 */
export const GRADE_CODES = [
  'EG',
  'SD',
  'HG',
  'RG',
  'MG',
  'MGEX',
  'PG',
  'FM',
  'RE100',
  'HIRM',
  'MEGA',
] as const;

export type GradeCode = (typeof GRADE_CODES)[number];
