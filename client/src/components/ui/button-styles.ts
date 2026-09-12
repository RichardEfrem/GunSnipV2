import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * DESIGN.md §4.2. Primary is the only filled variant and there is **one per view** — it is
 * how "the thing to do here" is expressed, so a second one on screen makes both weaker.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  // The only chamfered variant. `chamfer-plate` rather than `chamfer` so the focus ring is
  // not clipped away with the corners — see the utility's note in globals.css.
  primary: 'chamfer-plate [--plate:var(--red-fill)] hover:[--plate:var(--red-fill-hover)] text-white',
  secondary: 'border border-core-blue text-core-blue hover:bg-core-blue-tint',
  ghost: 'text-ink hover:bg-ink-tint',
  danger: 'border border-danger text-danger hover:bg-danger-tint',
};

/**
 * The button look, for a navigation that has to *be* a link but read as a button — "View cart",
 * "Browse kits". Wrapping a `<Button>` in a `<Link>` instead nests one interactive element in
 * another, which is invalid HTML and announces twice to a screen reader.
 *
 * A plain module rather than an export of `Button.tsx`: that file is a Client Component, and a
 * function exported from one arrives in a Server Component as a reference it cannot call.
 */
export function buttonStyles(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(
    // 48px on touch, 44px on pointer (DESIGN.md §4.2, §6).
    'reticle relative inline-flex h-12 select-none items-center justify-center gap-2 rounded-sm px-4 md:h-11',
    'font-display text-base font-semibold',
    'transition-colors duration-fast ease-out',
    VARIANTS[variant],
    className,
  );
}
