import type { ReactNode } from 'react';

/**
 * One numbered section of the single-page checkout (FR-CO-02, DESIGN.md §3.7).
 *
 * Checkout is one of the two genuine sequences on the site, so it is one of the two places a
 * number marker is allowed (DESIGN.md §7) — the other is the order timeline.
 */
interface CheckoutSectionProps {
  step: number;
  title: string;
  children: ReactNode;
}

export function CheckoutSection({ step, title, children }: CheckoutSectionProps) {
  const headingId = `checkout-step-${step}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 border border-armor-150 bg-armor-000 p-4 md:p-6">
      <h2 id={headingId} className="flex items-center gap-3 text-xl">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-sm bg-frame-900 font-display text-sm font-semibold text-white"
        >
          {step}
        </span>
        {title}
      </h2>

      {children}
    </section>
  );
}
