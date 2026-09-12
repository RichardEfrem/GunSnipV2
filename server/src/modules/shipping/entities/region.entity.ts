import type { AddressRegionLevel } from '@gunsnip/shared';

/** One option in the checkout's province → city → district selects (FR-CO-03). */
export interface Region {
  id: string;
  name: string;
  level: AddressRegionLevel;
  /** A city's main postal code, used to prefill the field. Null where the seed has none. */
  postalCode: string | null;
  /**
   * Whether a further select follows. Districts are seeded only for the metros that generate
   * orders, so a city is sometimes the most specific level there is — and the form has to know
   * that before it asks for a district that does not exist.
   */
  hasChildren: boolean;
}
