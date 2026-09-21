'use client';

import Image from 'next/image';
import { useRef, useState, type KeyboardEvent } from 'react';
import { CART_SOURCE_ATTRIBUTE } from '@/features/cart/cart-arc';
import { cn } from '@/lib/cn';
import type { ProductDetail } from '../schema';
import { isVectorImage } from '@/lib/image';

/**
 * The product gallery (FR-PDP-01, DESIGN.md §3.5) — a main image over a thumbnail strip.
 *
 * **Swipe is the browser's, not ours.** The main image sits in a scroll-snap track, so a touch
 * drag is native scrolling: it has the right rubber-banding, the right momentum, and it costs
 * no JavaScript. A hand-rolled pointer-drag would be a worse copy of it.
 *
 * The thumbnails are a `radiogroup` rather than a list of buttons, which is what makes arrow
 * keys work the way a keyboard user already expects — one tab stop for the whole strip, arrows
 * to move within it (DESIGN.md §6).
 */
interface ProductGalleryProps {
  product: ProductDetail;
}

export function ProductGallery({ product }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { images } = product;

  if (images.length === 0) {
    return (
      <div className="chamfer grid aspect-square w-full place-items-center bg-armor-050 text-sm text-frame-300">
        No image yet
      </div>
    );
  }

  /** Scrolls the track rather than re-rendering it, so the snap position and state agree. */
  function show(index: number) {
    const clamped = Math.max(0, Math.min(index, images.length - 1));
    setActiveIndex(clamped);

    const track = trackRef.current;
    if (track !== null) {
      track.scrollTo({ left: track.clientWidth * clamped, behavior: 'smooth' });
    }

    thumbRefs.current[clamped]?.focus();
  }

  function onThumbKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;

    event.preventDefault();
    show(activeIndex + delta);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={trackRef}
        // `onScroll` keeps the thumbnails honest when the *finger* moved the track rather than
        // a click — without it a swipe would leave the wrong thumbnail marked current.
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget;
          const index = Math.round(scrollLeft / clientWidth);
          if (index !== activeIndex) setActiveIndex(index);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto"
        aria-live="polite"
      >
        {images.map((image, index) => (
          <div key={image.url} className="chamfer relative aspect-square w-full shrink-0 snap-center bg-armor-050">
            <Image
              // The cart arc launches from the first image (DESIGN.md §2.4).
              {...(index === 0 ? { [CART_SOURCE_ATTRIBUTE]: '' } : {})}
              src={image.url}
              alt={image.alt}
              fill
              placeholder="blur"
              blurDataURL={image.blurDataUrl}
              sizes="(min-width: 1024px) 560px, 100vw"
              // The first image is the page's LCP element on every product page.
              priority={index === 0}
              unoptimized={isVectorImage(image.url)}
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {images.length === 1 ? null : (
        <div role="radiogroup" aria-label={`${product.name} images`} className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              key={image.url}
              ref={(node) => {
                thumbRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={index === activeIndex}
              // One tab stop for the strip; arrows move inside it (DESIGN.md §6).
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => show(index)}
              onKeyDown={onThumbKeyDown}
              className={cn(
                'reticle relative size-16 shrink-0 overflow-hidden border bg-armor-050 transition-colors duration-fast ease-out',
                index === activeIndex ? 'border-core-blue' : 'border-armor-150 hover:border-frame-300',
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="64px"
                unoptimized={isVectorImage(image.url)}
                className="object-cover"
              />
              <span className="sr-only">
                View image {index + 1} of {images.length}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
