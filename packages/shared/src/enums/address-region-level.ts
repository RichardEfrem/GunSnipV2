/**
 * Indonesian administrative levels, seeded as reference data for the dependent
 * province → city → district selects in checkout (FR-CO-03).
 */
export const ADDRESS_REGION_LEVELS = ['PROVINCE', 'CITY', 'DISTRICT'] as const;

export type AddressRegionLevel = (typeof ADDRESS_REGION_LEVELS)[number];
