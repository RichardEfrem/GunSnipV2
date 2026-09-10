/**
 * A seeded pseudo-random generator, so the catalogue is the same shop on every reset.
 *
 * `Math.random()` would give a different set of ratings, sold counts and restock dates each
 * time the seed runs, which makes a screenshot, a performance number or a bug report from
 * yesterday impossible to reproduce today. Keying every stream off the product's slug also
 * means adding a product cannot shift the numbers of the ones around it.
 *
 * mulberry32: 32 bits of state, a handful of operations, good enough distribution for demo
 * data. Nothing here is security-sensitive — `randomUUID` is used where unpredictability
 * actually matters.
 */
export interface Random {
  /** `[0, 1)`. */
  next(): number;
  /** Inclusive at both ends. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** True with the given probability. */
  chance(probability: number): boolean;
}

export function randomFor(seed: string): Random {
  let state = fnv1a(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    chance: (probability) => next() < probability,
  };
}

/** FNV-1a, 32-bit. Turns a slug into a well-spread starting state. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}
