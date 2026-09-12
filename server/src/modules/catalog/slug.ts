import { ValidationError } from '../../common/errors/validation.error.js';

/**
 * Product and reference-data slugs (FR-ADM-02, FR-ADM-09).
 *
 * A slug is a URL, and a URL is a promise: `/mg-barbatos` printed on a card, pasted into chat
 * and indexed by a search engine has to keep working. So it is derived once when the operator
 * has not supplied one, and never re-derived from a later name edit — renaming "MG Barbatos" to
 * "MG Barbatos (2024)" must not break every link to it.
 */

/** Long enough for "sd-ex-standard-gundam-barbatos-lupus-rex", short enough to index. */
const MAX_SLUG_LENGTH = 96;

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * ASCII-lowercase, words joined by single hyphens. Accented characters are decomposed first so
 * "Gundam Épyon" becomes `gundam-epyon` rather than losing the letter entirely.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    // Strip the combining marks NFKD just split off, so é → e rather than e + an accent that
    // the next replace would turn into a hyphen.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * The slug to store: what the operator typed, or one derived from the name.
 *
 * A name of nothing but punctuation slugifies to an empty string. That is a 400 rather than a
 * generated id — a product called "???" wants a name, and inventing `product-3f9a` for it hides
 * the mistake behind a URL nobody can read.
 */
export function resolveSlug(name: string, supplied: string | undefined): string {
  const slug = supplied === undefined ? slugify(name) : slugify(supplied);

  if (!VALID_SLUG.test(slug)) {
    throw new ValidationError(
      supplied === undefined
        ? `Couldn't build a web address from "${name}" — give it a slug, or a name with letters or digits in it.`
        : `"${supplied}" is not a usable web address. Use lowercase letters, digits and hyphens.`,
      { name, supplied },
    );
  }

  return slug;
}

/**
 * `mg-barbatos`, `mg-barbatos-2`, `mg-barbatos-3` … the first the database does not already
 * hold. Bounded, because an unbounded loop against a unique constraint is a way to hang a
 * request rather than to report a problem.
 */
export async function uniqueSlug(
  slug: string,
  isTaken: (candidate: string) => Promise<boolean>,
  attempts = 50,
): Promise<string> {
  if (!(await isTaken(slug))) return slug;

  for (let suffix = 2; suffix <= attempts; suffix += 1) {
    const candidate = `${slug.slice(0, MAX_SLUG_LENGTH - String(suffix).length - 1)}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new ValidationError(`"${slug}" and its variations are all taken. Choose a different slug.`, { slug });
}
