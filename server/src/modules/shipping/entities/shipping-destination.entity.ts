import type { AddressRegionLevel, ShippingZone } from '@gunsnip/shared';

/**
 * A region resolved into everything checkout needs from it: the names an address is written
 * with, and the zone its rate is read from (A4).
 *
 * The zone is set on provinces and inherited downward, so a district added by an operator later
 * is priced correctly without anyone remembering to set a zone on it.
 */
export interface ShippingDestination {
  regionId: string;
  level: AddressRegionLevel;
  province: string;
  /** Null when the region is itself a province. */
  city: string | null;
  /** Null when the region is a city or a province. */
  district: string | null;
  /** The city's main postal code, when the seed has one. */
  postalCode: string | null;
  /** Null only for a province seeded without one — a data fault, answered with "no delivery". */
  zone: ShippingZone | null;
  /**
   * True when nothing more specific exists below this region. An order is addressed to a leaf,
   * so "Jawa Barat" is enough to quote a rate but not enough to ship a parcel to.
   */
  isLeaf: boolean;
}
