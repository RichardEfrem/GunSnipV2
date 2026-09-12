import { describe, expect, it } from 'vitest';
import { allocateBundlePrice, bundleSavingIdr, type BundleComponent } from './bundle-allocation.js';

/** The seeded "First build starter": an entry-grade kit, a nipper and a panel liner. */
const STARTER: BundleComponent[] = [
  { variantId: 'kit', quantity: 1, catalogueUnitPriceIdr: 165_000 },
  { variantId: 'nipper', quantity: 1, catalogueUnitPriceIdr: 385_000 },
  { variantId: 'liner', quantity: 1, catalogueUnitPriceIdr: 48_000 },
];

function totalOf(components: readonly { lineTotalIdr: number }[]): number {
  return components.reduce((total, component) => total + component.lineTotalIdr, 0);
}

describe('allocateBundlePrice', () => {
  it('adds back up to exactly the bundle price', () => {
    const allocation = allocateBundlePrice(545_000, STARTER);

    expect(allocation.chargedPriceIdr).toBe(545_000);
    expect(totalOf(allocation.components)).toBe(545_000);
  });

  it('splits in proportion to catalogue value, so the discount falls evenly', () => {
    const allocation = allocateBundlePrice(545_000, STARTER);
    const byId = new Map(allocation.components.map((component) => [component.variantId, component]));

    // The nipper is the most valuable component, so it carries the largest share.
    expect(byId.get('nipper')!.unitPriceIdr).toBeGreaterThan(byId.get('kit')!.unitPriceIdr);
    expect(byId.get('kit')!.unitPriceIdr).toBeGreaterThan(byId.get('liner')!.unitPriceIdr);
  });

  it('does not depend on the order the components are listed in', () => {
    const forwards = allocateBundlePrice(545_000, STARTER);
    const backwards = allocateBundlePrice(545_000, [...STARTER].reverse());

    const priceOf = (allocation: typeof forwards, id: string): number =>
      allocation.components.find((component) => component.variantId === id)!.unitPriceIdr;

    for (const id of ['kit', 'nipper', 'liner']) {
      expect(priceOf(backwards, id)).toBe(priceOf(forwards, id));
    }
  });

  it('produces whole rupiah only — money never becomes a float', () => {
    const allocation = allocateBundlePrice(545_000, STARTER);

    for (const component of allocation.components) {
      expect(Number.isInteger(component.unitPriceIdr)).toBe(true);
      expect(Number.isInteger(component.lineTotalIdr)).toBe(true);
    }
  });

  it('keeps lineTotal equal to unitPrice × quantity for every component', () => {
    const allocation = allocateBundlePrice(700_000, [
      { variantId: 'a', quantity: 3, catalogueUnitPriceIdr: 100_000 },
      { variantId: 'b', quantity: 1, catalogueUnitPriceIdr: 450_000 },
    ]);

    for (const component of allocation.components) {
      expect(component.lineTotalIdr).toBe(component.unitPriceIdr * component.quantity);
    }
  });

  it('is exact whenever some component comes as a single unit, which curated bundles do', () => {
    const awkward = allocateBundlePrice(100_001, [
      { variantId: 'a', quantity: 7, catalogueUnitPriceIdr: 33_333 },
      { variantId: 'b', quantity: 1, catalogueUnitPriceIdr: 11_111 },
    ]);

    expect(awkward.chargedPriceIdr).toBe(100_001);
  });

  it('never charges more than the advertised price when a remainder cannot be split', () => {
    // Every component comes in twos, so an odd rupiah has nowhere to go.
    const allocation = allocateBundlePrice(1_001, [
      { variantId: 'a', quantity: 2, catalogueUnitPriceIdr: 500 },
      { variantId: 'b', quantity: 2, catalogueUnitPriceIdr: 500 },
    ]);

    expect(allocation.chargedPriceIdr).toBeLessThanOrEqual(1_001);
    expect(allocation.chargedPriceIdr).toBe(1_000);
  });

  it('spreads by unit count when every component is free, rather than dividing by zero', () => {
    const allocation = allocateBundlePrice(300, [
      { variantId: 'a', quantity: 1, catalogueUnitPriceIdr: 0 },
      { variantId: 'b', quantity: 2, catalogueUnitPriceIdr: 0 },
    ]);

    expect(allocation.chargedPriceIdr).toBe(300);
    expect(Number.isInteger(allocation.components[0]!.unitPriceIdr)).toBe(true);
  });

  it('handles a single-component bundle', () => {
    const allocation = allocateBundlePrice(90_000, [
      { variantId: 'only', quantity: 1, catalogueUnitPriceIdr: 120_000 },
    ]);

    expect(allocation.components[0]!.unitPriceIdr).toBe(90_000);
    expect(allocation.chargedPriceIdr).toBe(90_000);
  });

  it('is empty and free for a bundle with nothing in it', () => {
    expect(allocateBundlePrice(50_000, [])).toEqual({ components: [], chargedPriceIdr: 0 });
  });

  it('adds up for every seeded-shaped bundle price', () => {
    for (let price = 500_000; price <= 500_050; price += 1) {
      expect(allocateBundlePrice(price, STARTER).chargedPriceIdr).toBe(price);
    }
  });
});

describe('bundleSavingIdr', () => {
  it('is the difference between the parts and the bundle', () => {
    expect(bundleSavingIdr(545_000, STARTER)).toBe(53_000);
  });

  it('counts each component as many times as the bundle contains it', () => {
    expect(
      bundleSavingIdr(100_000, [{ variantId: 'a', quantity: 3, catalogueUnitPriceIdr: 50_000 }]),
    ).toBe(50_000);
  });

  it('is zero rather than negative when a bundle costs more than its parts', () => {
    expect(bundleSavingIdr(900_000, STARTER)).toBe(0);
  });
});
