'use client';

import { Check, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Necessity } from '@gunsnip/shared';
import { NECESSITIES } from '@gunsnip/shared';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useAddToCart } from '@/features/cart/hooks/use-add-to-cart';
import { cn } from '@/lib/cn';
import { formatIdr } from '@/lib/formatters';
import { NECESSITY_LABELS } from '@/lib/labels';
import type { BuildRequirement } from '../schema';

/**
 * "What you'll need to build this" (FR-PDP-08) — the block DESIGN.md §3.5 calls the page's
 * reason to exist.
 *
 * Three rules, all of them deliberate:
 *
 * 1. **Everything starts unticked and the total starts at Rp 0.** The customer opts in and sees
 *    the price before they do. A pre-ticked list that silently adds Rp 600.000 to a kit is a
 *    dark pattern, and it is the exact thing this block would become if the defaults flipped.
 * 2. **One action adds all of them** (DoD §13.3) — a single request, so a partial cart is not a
 *    reachable state.
 * 3. **Tools already in the cart are shown as covered, with the checkbox removed.** Not
 *    disabled and not hidden: the customer needs to see that the nipper is handled, and a
 *    checkbox they cannot tick invites a click that does nothing.
 */
interface BuildRequirementsProps {
  requirements: readonly BuildRequirement[];
  /** Variant ids the actor's cart already holds, from the server (FR-PDP-08). */
  inCartVariantIds: readonly string[];
}

/**
 * Weight and tone, not accent colour. Red is money and purchase intent only and blue is
 * navigation (DESIGN.md §1), and a necessity is neither — so "Required" is the heaviest ink on
 * the block and the lesser tiers step down in contrast.
 */
const NECESSITY_TONES: Record<Necessity, string> = {
  REQUIRED: 'text-ink',
  RECOMMENDED: 'text-ink',
  OPTIONAL: 'text-frame-300',
};

export function BuildRequirements({ requirements, inCartVariantIds }: BuildRequirementsProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const { status, error, add } = useAddToCart();

  const inCart = useMemo(() => new Set(inCartVariantIds), [inCartVariantIds]);

  // A tool with no buyable variant cannot be ticked; it still renders, so the customer knows
  // the kit needs one.
  const selectable = requirements.filter(
    (requirement) => requirement.variantId !== null && !inCart.has(requirement.variantId),
  );

  const selectedTotal = selectable
    .filter((requirement) => selectedIds.has(requirement.variantId ?? ''))
    .reduce((total, requirement) => total + requirement.tool.priceIdr, 0);

  // A tool is a tool: nobody needs two nippers because two kits asked for one, so every line
  // adds a single unit.
  const selectedCount = selectedIds.size;

  if (requirements.length === 0) return null;

  function toggle(variantId: string, isChecked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (isChecked) next.add(variantId);
      else next.delete(variantId);
      return next;
    });
  }

  async function addSelected() {
    const items = [...selectedIds].map((variantId) => ({ variantId, quantity: 1 }));
    // Cleared on success only, so the block reflects the cart it just changed and the rows come
    // back as "Already in cart" when the server tree refreshes. On failure the ticks stay: the
    // customer should be able to read the error and press the button again, not re-pick tools.
    if (await add(items)) setSelectedIds(new Set());
  }

  const grouped = NECESSITIES.map((necessity) => ({
    necessity,
    items: requirements.filter((requirement) => requirement.necessity === necessity),
  })).filter((group) => group.items.length > 0);

  return (
    <section
      aria-labelledby="build-requirements"
      className="flex flex-col gap-3 border border-armor-150 bg-armor-050 p-4"
    >
      <h2 id="build-requirements" className="flex items-center gap-2 font-display text-base font-semibold">
        <Wrench className="size-4 shrink-0 text-core-blue" aria-hidden />
        What you&rsquo;ll need to build this
      </h2>

      <ul className="flex flex-col divide-y divide-armor-150">
        {grouped.map((group) => (
          <li key={group.necessity} className="py-2 first:pt-0 last:pb-0">
            <p
              className={cn(
                // Sentence case: no tracked-out all-caps labels (DESIGN.md §2.2).
                'font-display text-sm font-semibold',
                NECESSITY_TONES[group.necessity],
              )}
            >
              {NECESSITY_LABELS[group.necessity]}
            </p>

            <ul className="flex flex-col">
              {group.items.map((requirement) => (
                <RequirementRow
                  key={requirement.tool.id}
                  requirement={requirement}
                  isInCart={requirement.variantId !== null && inCart.has(requirement.variantId)}
                  isChecked={selectedIds.has(requirement.variantId ?? '')}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Button
        onClick={addSelected}
        isLoading={status === 'adding'}
        disabled={selectedCount === 0}
        // A disabled button has to say why (DESIGN.md §4.2), and this one keeps focus so a
        // keyboard user can read it.
        disabledReason="Tick a tool to add it"
      >
        {status === 'added' ? (
          <>
            <Check className="size-4" aria-hidden />
            Added
          </>
        ) : (
          // Rp 0 until something is ticked — the total is the promise this block makes.
          `Add selected — ${formatIdr(selectedTotal)}`
        )}
      </Button>

      <p role="status" aria-live="polite" className={error === null ? 'sr-only' : 'text-sm text-danger'}>
        {error ?? (status === 'added' ? 'Tools added to your cart' : '')}
      </p>
    </section>
  );
}

interface RequirementRowProps {
  requirement: BuildRequirement;
  isInCart: boolean;
  isChecked: boolean;
  onToggle: (variantId: string, isChecked: boolean) => void;
}

function RequirementRow({ requirement, isInCart, isChecked, onToggle }: RequirementRowProps) {
  const { tool, reason, variantId } = requirement;

  const name = (
    <Link href={`/products/${tool.slug}`} className="reticle rounded-sm hover:text-core-blue">
      {tool.name}
    </Link>
  );

  if (isInCart) {
    return (
      <li className="flex min-h-11 items-center justify-between gap-2 py-1 text-sm">
        <span className="flex items-center gap-2 text-frame-300">
          <Check className="size-4 shrink-0 text-ok" aria-hidden />
          {name}
        </span>
        <span className="shrink-0 text-xs text-ok">Already in cart</span>
      </li>
    );
  }

  if (variantId === null) {
    return (
      <li className="flex min-h-11 items-center justify-between gap-2 py-1 text-sm text-frame-300">
        {name}
        <span className="shrink-0 text-xs">Out of stock</span>
      </li>
    );
  }

  return (
    <li className="flex flex-col">
      <Checkbox
        checked={isChecked}
        onCheckedChange={(checked) => onToggle(variantId, checked)}
        label={name}
        detail={<span className="tabular-nums">{formatIdr(tool.priceIdr)}</span>}
      />
      {reason === null ? null : (
        // Indented to the checkbox's label, so the justification reads as belonging to the row.
        <p className="-mt-1 pb-1 pl-7.5 text-xs text-frame-300">{reason}</p>
      )}
    </li>
  );
}
