import Link from 'next/link';
import { gradeHref } from '@/lib/navigation';
import type { HomeContent } from '../schema';

/**
 * The grade row (DESIGN.md §3.1) — real navigation, not decoration. For most visitors the grade
 * is the first decision, so it is the first thing under the home hero and the first way back
 * into the catalogue from an empty cart (FR-CART-07).
 */
interface GradeShortcutsProps {
  grades: HomeContent['gradeShortcuts'];
  className?: string;
}

const CHIP =
  'reticle chamfer flex min-h-11 items-center gap-2 border border-armor-150 bg-armor-000 px-3 font-display text-sm font-semibold transition-colors duration-fast ease-out hover:border-core-blue';

export function GradeShortcuts({ grades, className }: GradeShortcutsProps) {
  return (
    <nav aria-label="Browse by grade" className={className}>
      <ul className="flex flex-wrap gap-2">
        {grades.map((grade) => (
          <li key={grade.code}>
            <Link href={gradeHref(grade.code)} className={CHIP}>
              {grade.code}
              <span className="font-normal tabular-nums text-frame-300">{grade.productCount}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/tools" className={CHIP}>
            Tools
          </Link>
        </li>
      </ul>
    </nav>
  );
}
