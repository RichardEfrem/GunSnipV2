import { DIFFICULTY_LABELS } from '@/lib/labels';
import type { ProductDetail } from '../schema';

/**
 * The specification block (FR-PDP-03, DESIGN.md §3.5).
 *
 * A `<dl>`, because that is what this is — a list of terms and their values. A table would
 * claim a second axis that does not exist, and a stack of divs would tell a screen reader
 * nothing about which value belongs to which label.
 *
 * A Server Component: it is text, and a product page should not ship JavaScript to render its
 * own spec sheet.
 */
interface ProductSpecsProps {
  product: ProductDetail;
}

export function ProductSpecs({ product }: ProductSpecsProps) {
  const rows = specRows(product);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="specifications" className="flex flex-col gap-3">
      <h2 id="specifications" className="font-display text-base font-semibold">
        Specifications
      </h2>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-0 text-sm">
        {rows.map((row) => (
          // `contents` so both cells join the parent grid and every value lines up down one
          // column, however long the term beside it is.
          <div key={row.term} className="contents">
            <dt className="border-b border-armor-150 py-2 text-frame-300">{row.term}</dt>
            <dd className="border-b border-armor-150 py-2 text-right tabular-nums sm:text-left">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface SpecRow {
  term: string;
  value: string;
}

/**
 * The rows DESIGN.md §3.5 prints, in its order, with the empty ones dropped.
 *
 * A spec with no value is left out rather than rendered as "—": a dash is a row the eye still
 * has to read before learning it says nothing, and the seed has plenty of them.
 */
function specRows(product: ProductDetail): SpecRow[] {
  const { kitSpec, toolSpec } = product;
  const rows: (SpecRow | null)[] = [];

  if (kitSpec !== null) {
    rows.push(
      row('Grade', kitSpec.grade?.name),
      row('Scale', kitSpec.scale?.code === 'NON_SCALE' ? 'Non-scale' : kitSpec.scale?.code),
      row('Series', kitSpec.series?.name),
      row('Unit', kitSpec.unitName),
      row('Unit code', kitSpec.unitCode),
      row('Runners', kitSpec.runnerCount),
      row('Parts', kitSpec.partCount),
      row('Difficulty', kitSpec.difficulty === null ? undefined : DIFFICULTY_LABELS[kitSpec.difficulty]),
      row('Decals', kitSpec.decalType === null ? undefined : decalLabel(kitSpec.decalType)),
      row('Articulation', kitSpec.articulationNotes),
      row('Build time', formatBuildTime(kitSpec.runtimeMinutesEst)),
      row('Released', kitSpec.releaseYear),
      row('Includes', kitSpec.includes.length === 0 ? undefined : kitSpec.includes.join(', ')),
    );
  }

  if (toolSpec !== null) {
    rows.push(row('Brand', product.brand.name));

    // Long-tail tool specs are JSONB and differ per line — grit number, blade angle, paint code
    // (PRD §5.1). Printed as-is because the operator's key is the right label; inventing a
    // display name for a key this code has never seen would be a guess.
    for (const [key, value] of Object.entries(toolSpec.attributes)) {
      if (typeof value === 'string' || typeof value === 'number') {
        rows.push(row(humanise(key), value));
      }
    }
  }

  return rows.filter((entry): entry is SpecRow => entry !== null);
}

function row(term: string, value: string | number | null | undefined): SpecRow | null {
  if (value === null || value === undefined || value === '') return null;
  return { term, value: String(value) };
}

/** `WATERSLIDE` → `Waterslide`, `DRY_TRANSFER` → `Dry transfer`. */
function decalLabel(decalType: string): string {
  return humanise(decalType);
}

function humanise(value: string): string {
  const spaced = value.replaceAll('_', ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `~14 hours` from 840 minutes — the box estimate, phrased as the estimate it is. */
function formatBuildTime(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) return `~${minutes} minutes`;

  const hours = Math.round(minutes / 60);
  return `~${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}
