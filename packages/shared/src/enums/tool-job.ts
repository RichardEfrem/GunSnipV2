/**
 * Top level of the tools taxonomy — the job the tool does (PRD §5.1). Tool navigation is
 * job then subcategory (FR-CAT-02), so these are the parents in the category table.
 */
export const TOOL_JOBS = [
  'CUTTING',
  'SHAPING',
  'PAINTING',
  'ADHESIVE',
  'FINISHING',
  'DECAL_AIDS',
  'DISPLAY',
  'STORAGE',
  'WORKSPACE',
] as const;

export type ToolJob = (typeof TOOL_JOBS)[number];
