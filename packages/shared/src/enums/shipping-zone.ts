/**
 * Flat-rate shipping zones (A4 — no live courier rate API in v1). Coarse on purpose: a rate
 * table with one row per city is a maintenance burden that a flat tier does not have, and
 * swapping in RajaOngkir/Biteship later replaces the lookup, not the schema.
 */
export const SHIPPING_ZONES = [
  'JABODETABEK',
  'JAVA',
  'BALI_NUSA',
  'SUMATRA',
  'KALIMANTAN',
  'SULAWESI',
  'MALUKU_PAPUA',
] as const;

export type ShippingZone = (typeof SHIPPING_ZONES)[number];
