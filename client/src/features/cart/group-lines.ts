import type { CartLine, CartLineBundle } from './schema';

/**
 * The cart's rows as the customer sees them (FR-CAT-11).
 *
 * A bundle is one line to them and one row per component underneath, so the list has to put the
 * components back together — in the position the first of them holds, so nothing jumps around
 * when a quantity changes.
 *
 * Pure, and here rather than inside the component, because "what is one line" is a rule rather
 * than a rendering detail: the selection bar counts lines, and it has to count a bundle once.
 */
export type CartEntry =
  | { kind: 'line'; line: CartLine }
  | { kind: 'bundle'; bundle: CartLineBundle; lines: readonly CartLine[] };

export function groupCartLines(lines: readonly CartLine[]): CartEntry[] {
  const entries: CartEntry[] = [];
  const seen = new Map<string, number>();

  for (const line of lines) {
    if (line.bundle === null) {
      entries.push({ kind: 'line', line });
      continue;
    }

    const at = seen.get(line.bundle.id);

    if (at === undefined) {
      seen.set(line.bundle.id, entries.length);
      entries.push({ kind: 'bundle', bundle: line.bundle, lines: [line] });
      continue;
    }

    const existing = entries[at];
    if (existing?.kind === 'bundle') {
      entries[at] = { ...existing, lines: [...existing.lines, line] };
    }
  }

  return entries;
}

/** A bundle counts once towards "3 items selected", not once per component. */
export function countEntries(entries: readonly CartEntry[]): number {
  return entries.length;
}

/**
 * Whether a bundle is selected and buyable, which is all-or-nothing: the server selects and
 * deselects its components together, and a bundle missing a component is not a bundle.
 */
export function isBundlePurchasable(lines: readonly CartLine[]): boolean {
  return lines.every((line) => line.isPurchasable);
}

export function isBundleSelected(lines: readonly CartLine[]): boolean {
  return lines.every((line) => line.isSelected);
}

/** How many of a bundle can be bought — the scarcest component decides (FR-CART-04). */
export function bundleMaxQuantity(bundle: CartLineBundle, lines: readonly CartLine[]): number {
  if (lines.length === 0) return 1;

  // Each row holds `perBundleQuantity × bundles`, so its own quantity divided by the bundles
  // currently held recovers how many of it go into one.
  const perBundle = (line: CartLine): number => Math.max(1, Math.round(line.quantity / Math.max(1, bundle.quantity)));

  return Math.max(1, Math.min(...lines.map((line) => Math.floor(line.availableQuantity / perBundle(line)))));
}
