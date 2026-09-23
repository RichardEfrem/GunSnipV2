import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Removes generated files whose slug is no longer in the seed data, and nothing else.
 *
 * The placeholder directories live under `client/public`, which every database shares: the
 * dev and test databases both point at the same files. They used to be wiped wholesale before
 * each seed, so seeding the test database deleted images the dev database was still serving.
 *
 * Scoping by slug keeps the reason the wipe existed — a renamed or removed product must not
 * leave files behind forever — without touching anything another database can reference.
 * Filenames are deterministic per slug, so a file kept here is byte-identical to the one the
 * next seed would write. It is deliberately NOT "delete what this run didn't write": when the
 * seed itself changes (a product switching from placeholder to photography), a database seeded
 * before the change still points at the old files until it is reseeded.
 *
 * A filename belongs to a slug when it is `<slug>.svg` or starts with `<slug>-`. Slugs can be
 * prefixes of one another (`…-barbatos` and `…-barbatos-lupus-rex`), which can only ever make
 * this keep a file it could have removed — never remove one a live slug owns.
 */
export async function pruneOrphans(directory: string, liveSlugs: Iterable<string>): Promise<number> {
  await mkdir(directory, { recursive: true });

  const slugs = [...liveSlugs];
  const isLive = (filename: string): boolean =>
    slugs.some((slug) => filename === `${slug}.svg` || filename.startsWith(`${slug}-`));

  let removed = 0;

  for (const filename of await readdir(directory)) {
    if (isLive(filename)) continue;
    await rm(join(directory, filename), { force: true });
    removed += 1;
  }

  return removed;
}
