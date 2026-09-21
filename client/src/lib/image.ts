/**
 * Whether an image URL points at a vector, and so must bypass the `next/image` optimizer.
 *
 * Next refuses to run SVG through the optimizer unless `dangerouslyAllowSVG` is set globally,
 * and it refuses loudly: the request returns 400 and the browser renders a broken image. The
 * flag stays off because an SVG is a script vector, and the only SVGs here are the seed's own
 * placeholders — uploads are always re-encoded to WebP by the API. Vectors have nothing to
 * optimise anyway, so they bypass it per-image instead.
 *
 * This lives in one place because getting it wrong is invisible until someone opens the page —
 * the seed's placeholders are all SVG, so a render site that forgets it shows nothing at all
 * for the entire catalogue while every other site looks fine.
 */
export function isVectorImage(url: string): boolean {
  return url.endsWith('.svg');
}
