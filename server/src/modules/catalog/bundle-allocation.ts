/**
 * Spreading a bundle's price across the variants it is made of (FR-CAT-11).
 *
 * A bundle is one line to the customer at one price, but underneath it is one cart row and one
 * order row per component, because stock lives on variants. Those rows need unit prices, and
 * they have to add back up to the bundle's price — otherwise the subtotal the customer is shown
 * is not the sum of what the order records, and every downstream rule that reads a line total
 * (the voucher's minimum spend, its scope, the order's subtotal) is reading a different number
 * from the one on the screen.
 *
 * Pure, and in its own file, because this is price calculation — a mandatory unit-test target
 * (CLAUDE.md Testing) — and because the cart and the order both have to reach the same answer.
 *
 * **Proportional to catalogue value.** A component worth twice as much carries twice as much of
 * the bundle price, so the discount falls evenly rather than being concentrated on whichever
 * component happened to be listed first. That matters beyond tidiness: a percentage voucher
 * scoped to one category is applied to these line totals, and an arbitrary split would make the
 * discount depend on the order the components were entered in.
 *
 * **Integer arithmetic, rounded down.** Each unit price is floored and the remainder is handed
 * back out one rupiah at a time. Anything that cannot be handed out is left on the table, so the
 * charged total is at most the advertised bundle price and never above it — the same principle
 * the voucher rules round by, pointed the same way: the store never charges more than it said.
 */
export interface BundleComponent {
  variantId: string;
  /** How many of this variant are in one bundle. */
  quantity: number;
  /** What the variant sells for on its own, in whole rupiah. */
  catalogueUnitPriceIdr: number;
}

export interface AllocatedComponent extends BundleComponent {
  /** What one of this variant costs inside the bundle. Always ≤ its catalogue price in practice. */
  unitPriceIdr: number;
  /** `unitPriceIdr × quantity` — this component's share of one bundle. */
  lineTotalIdr: number;
}

export interface BundleAllocation {
  components: readonly AllocatedComponent[];
  /**
   * What one bundle actually costs once the shares are integers: `Σ lineTotalIdr`.
   *
   * Equal to the advertised price whenever any component has a quantity of one, which is every
   * curated bundle in practice. When every component comes in twos or threes a rupiah or two can
   * be unallocatable, and it is dropped rather than rounded up — see the note above.
   */
  chargedPriceIdr: number;
}

export function allocateBundlePrice(
  bundlePriceIdr: number,
  components: readonly BundleComponent[],
): BundleAllocation {
  if (components.length === 0) return { components: [], chargedPriceIdr: 0 };

  const catalogueTotal = components.reduce(
    (total, component) => total + component.catalogueUnitPriceIdr * component.quantity,
    0,
  );

  // A bundle of components that are all free has no proportions to go on, so value is spread by
  // unit count instead. Vanishingly rare, but the alternative is a division by zero.
  const weightOf = (component: BundleComponent): number =>
    catalogueTotal === 0 ? component.quantity : component.catalogueUnitPriceIdr * component.quantity;

  const totalWeight = catalogueTotal === 0
    ? components.reduce((total, component) => total + component.quantity, 0)
    : catalogueTotal;

  const shares = components.map((component) => {
    const exact = (bundlePriceIdr * weightOf(component)) / totalWeight / component.quantity;
    const unitPriceIdr = Math.floor(exact);

    return { component, unitPriceIdr, fraction: exact - unitPriceIdr };
  });

  let remainder = bundlePriceIdr - shares.reduce((total, share) => total + share.unitPriceIdr * share.component.quantity, 0);

  // Largest fractional part first — the component that lost the most to flooring is the one with
  // the best claim to the next rupiah. Raising a unit price by one costs that component's
  // quantity, so a component can only take a rupiah when the remainder can afford its whole line;
  // the pass repeats because one component taking its share may leave enough for a later one.
  const byClaim = [...shares].sort((a, b) => b.fraction - a.fraction);
  let handedOut = true;

  while (remainder > 0 && handedOut) {
    handedOut = false;

    for (const share of byClaim) {
      if (share.component.quantity > remainder) continue;

      share.unitPriceIdr += 1;
      remainder -= share.component.quantity;
      handedOut = true;
    }
  }

  const allocated = shares.map((share) => ({
    ...share.component,
    unitPriceIdr: share.unitPriceIdr,
    lineTotalIdr: share.unitPriceIdr * share.component.quantity,
  }));

  return {
    components: allocated,
    chargedPriceIdr: allocated.reduce((total, component) => total + component.lineTotalIdr, 0),
  };
}

/**
 * What the bundle saves against buying the same components separately — the figure the card
 * prints as "Save Rp 120.000".
 *
 * Never negative. A bundle priced above its parts is an operator mistake, not a surcharge to
 * advertise, and showing "Save −Rp 20.000" would be worse than showing nothing.
 */
export function bundleSavingIdr(
  bundlePriceIdr: number,
  components: readonly BundleComponent[],
): number {
  const catalogueTotal = components.reduce(
    (total, component) => total + component.catalogueUnitPriceIdr * component.quantity,
    0,
  );

  return Math.max(0, catalogueTotal - bundlePriceIdr);
}
