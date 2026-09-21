/**
 * What an uploaded image is for, which decides the folder it lands in and how large it is kept.
 *
 * The longest edge is capped per kind because each is shown at a different size: a product
 * photo is zoomed on the gallery, a banner spans the page, a review photo sits in a card and a
 * lightbox. Anything larger than the cap is bytes a visitor downloads and never sees.
 */
export const MEDIA_KINDS = {
  products: { maxEdge: 2000 },
  banners: { maxEdge: 2400 },
  reviews: { maxEdge: 1600 },
} as const;

export type MediaKind = keyof typeof MEDIA_KINDS;
