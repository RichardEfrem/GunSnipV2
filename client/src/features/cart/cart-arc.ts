/**
 * The one signature moment (DESIGN.md §2.4): the product thumbnail scales to 40px and arcs to
 * the cart icon over 220ms, reading as a part snapping into place.
 *
 * Implemented with the Web Animations API on a throwaway clone rather than by animating the
 * image itself — the real image must stay where it is, and a clone in a fixed-position layer
 * cannot be clipped by any `overflow: hidden` between the gallery and the header.
 *
 * Everything here is decoration. It never blocks, never reports failure, and never gates the
 * add: if the cart icon is off-screen or the browser refuses the animation, the item is still
 * in the cart and the badge still pops.
 */

/** Marks the header's cart icon as the arc's destination. */
export const CART_TARGET_ATTRIBUTE = 'data-cart-target';

/**
 * Marks the gallery's main image as the arc's launch point.
 *
 * A data attribute rather than a React ref, deliberately: the gallery and the buy block are
 * siblings under a Server Component, so a shared ref would mean promoting the whole left column
 * to client code just to carry it. The arc is decoration reaching across the page, and the DOM
 * is the thing both halves already share.
 */
export const CART_SOURCE_ATTRIBUTE = 'data-cart-source';

/** The element the arc should launch from, or null when this page has no image to throw. */
export function cartArcSource(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[${CART_SOURCE_ATTRIBUTE}]`);
}

const ARC_MS = 220;
const EASING = 'cubic-bezier(.2,.8,.2,1)';
const LANDING_SIZE = 40;

export function flyToCart(source: HTMLElement | null): void {
  if (source === null || typeof document === 'undefined') return;

  // DESIGN.md §2.4 and §6: reduced motion disables the arc outright. The badge pop is CSS and
  // is cancelled by the same query in globals.css.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const target = document.querySelector(`[${CART_TARGET_ATTRIBUTE}]`);
  if (target === null) return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();

  if (from.width === 0 || to.width === 0) return;

  const clone = source.cloneNode(true) as HTMLElement;

  Object.assign(clone.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    borderRadius: '2px',
    objectFit: 'cover',
    pointerEvents: 'none',
    zIndex: '80',
  } satisfies Partial<CSSStyleDeclaration>);

  clone.setAttribute('aria-hidden', 'true');
  document.body.append(clone);

  const scale = LANDING_SIZE / from.width;
  // Translate the *centres*, so the part lands on the icon rather than beside it — the clone
  // scales about its own centre, which a corner-to-corner translation would not account for.
  const deltaX = to.left + to.width / 2 - (from.left + from.width / 2);
  const deltaY = to.top + to.height / 2 - (from.top + from.height / 2);

  const animation = clone.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      // The arc: two thirds of the way across, still most of the way up. Without this
      // midpoint the part travels in a straight line, which reads as a slide rather than a throw.
      {
        transform: `translate(${deltaX * 0.65}px, ${deltaY * 0.35}px) scale(${(1 + scale) / 2})`,
        opacity: 0.9,
        offset: 0.6,
      },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})`, opacity: 0.4 },
    ],
    { duration: ARC_MS, easing: EASING, fill: 'forwards' },
  );

  animation.onfinish = () => clone.remove();
  // A cancelled animation still has to clean up its clone, or a fast double-click leaves
  // debris pinned over the page.
  animation.oncancel = () => clone.remove();
}
