'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { StockPill } from '@/components/ui/StockPill';
import { cartArcSource } from '@/features/cart/cart-arc';
import { useAddToCart } from '@/features/cart/hooks/use-add-to-cart';
import { MAX_QUANTITY_PER_LINE } from '@gunsnip/shared';
import { NotifyMeForm } from '@/features/notifications/components/NotifyMeForm';
import type { ProductDetail } from '../schema';
import { StickyPurchaseBar } from './StickyPurchaseBar';
import { VariantSelector } from './VariantSelector';

/**
 * The buy block (FR-PDP-04 … FR-PDP-07, FR-PDP-13).
 *
 * One client island for the whole purchase decision, because variant, quantity and the two
 * buttons are one piece of state — splitting them would mean lifting that state into a context
 * to hold something only this panel ever reads.
 *
 * The sticky mobile bar is rendered from here for the same reason (FR-PDP-13): it is a second
 * view of this panel's state, not a component with state of its own.
 */
interface PurchasePanelProps {
  product: ProductDetail;
}

export function PurchasePanel({ product }: PurchasePanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [selectedId, setSelectedId] = useState(() => defaultVariantId(product));
  const [quantity, setQuantity] = useState(1);

  const { status, error, add } = useAddToCart(cartArcSource);

  const selected = useMemo(
    () => product.variants.find((variant) => variant.id === selectedId),
    [product.variants, selectedId],
  );

  // A product whose every variant is archived has nothing to sell; the page still renders,
  // because an unbuyable product must stay reachable and indexable (FR-PDP-12).
  const available = selected?.availableQuantity ?? 0;
  const isOutOfStock = available <= 0;

  /** Bounded by real availability *and* the per-order cap (FR-PDP-06). */
  const maxQuantity = Math.max(1, Math.min(available, MAX_QUANTITY_PER_LINE));

  function chooseVariant(variantId: string) {
    setSelectedId(variantId);
    // A variant with less stock than the current quantity would otherwise leave the stepper
    // showing a number the customer cannot actually buy.
    const next = product.variants.find((variant) => variant.id === variantId);
    if (next !== undefined) setQuantity((current) => Math.min(current, Math.max(1, next.availableQuantity)));
  }

  async function addToCart() {
    if (selected === undefined) return;
    await add([{ variantId: selected.id, quantity }]);
  }

  async function buyNow() {
    if (selected === undefined) return;
    await add([{ variantId: selected.id, quantity }]);
    router.push('/cart');
  }

  return (
    <>
      <div ref={panelRef} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Price
            amountIdr={selected?.priceIdr ?? product.priceIdr}
            compareAtIdr={selected?.compareAtPriceIdr ?? product.compareAtPriceIdr}
            size="lg"
          />
          <StockPill
            state={selected?.stockState ?? product.stockState}
            // A real number, not "almost gone" (FR-PDP-05, DESIGN.md §5).
            availableQuantity={available}
          />
        </div>

        <VariantSelector
          variants={product.variants}
          selectedId={selectedId}
          onSelect={chooseVariant}
        />

        {isOutOfStock ? (
          // Never a dead end: the page stays up and offers to tell them when it is back.
          <NotifyMeForm variantId={selected?.id ?? null} productName={product.name} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                max={maxQuantity}
                label={product.name}
              />
              <p className="text-xs text-frame-300">
                {maxQuantity === MAX_QUANTITY_PER_LINE
                  ? `Up to ${MAX_QUANTITY_PER_LINE} per order`
                  : `${available} available`}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={addToCart}
                isLoading={status === 'adding'}
                className="sm:flex-1"
                // The confirmation is inline and the page does not navigate (FR-PDP-07).
                aria-describedby="add-to-cart-status"
              >
                {status === 'added' ? (
                  <>
                    <Check className="size-4" aria-hidden />
                    Added
                  </>
                ) : (
                  'Add to cart'
                )}
              </Button>

              <Button variant="secondary" onClick={buyNow} className="sm:flex-1">
                Buy now
              </Button>
            </div>
          </>
        )}

        {/* Always in the DOM so a screen reader hears the change rather than the region
            appearing (DESIGN.md §6). */}
        <p
          id="add-to-cart-status"
          role="status"
          aria-live="polite"
          className={error === null ? 'sr-only' : 'text-sm text-danger'}
        >
          {error ?? (status === 'added' ? `${product.name} added to your cart` : '')}
        </p>
      </div>

      <StickyPurchaseBar
        anchorRef={panelRef}
        priceIdr={selected?.priceIdr ?? product.priceIdr}
        isOutOfStock={isOutOfStock}
        status={status}
        onAdd={addToCart}
      />
    </>
  );
}

/**
 * The variant the page opens on: the cheapest one a customer could actually buy, falling back
 * to the first when everything is out — so an out-of-stock product still has a variant selected
 * and can offer a notify-me against it.
 */
function defaultVariantId(product: ProductDetail): string {
  const buyable = product.variants
    .filter((variant) => variant.availableQuantity > 0)
    .sort((left, right) => left.priceIdr - right.priceIdr);

  return buyable[0]?.id ?? product.variants[0]?.id ?? '';
}
