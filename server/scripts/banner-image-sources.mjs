/**
 * The home hero (DESIGN.md §3.1): one static image, a lineup of four Real Grade kits.
 *
 * Not a banner row — the hero is layout, not operator-curated data — so it has no manifest
 * entry and the page references the file directly.
 *
 * Real Grade because the RG galleries are all shot on the same black studio backdrop: once each
 * photo's black is lifted onto --frame-900 the backdrops are one colour, and the columns can be
 * cross-faded into a single row without a visible join. Mixing grades means mixing backdrops.
 * Four, spread across Wing, UC and SEED; a fifth (the Nu) made every column too narrow to hold
 * its kit without clipping a neighbour.
 *
 * `centre` is where the kit stands in its source photo, as a fraction of the width, so its
 * column is cut around it.
 */
export const HERO_LINEUP = [
  { handle: 'rg-xxxg-00w0-wing-gundam-zero-custom', image: 0, centre: 0.52 },
  { handle: 'rg-rx-78-2-gundam-ver-2-0', image: 0, centre: 0.5 },
  { handle: 'rg-msn-04-sazabi', image: 0, centre: 0.5 },
  { handle: 'rg-zgmf-x20a-strike-freedom-gundam', image: 1, centre: 0.5 },
];

/**
 * Banner slug → the one store photo it is cut from, and how.
 *
 * Keyed by the slug `steps/commerce.ts` derives from the banner's href, so the seed and this
 * map cannot drift apart without the seed falling back to a placeholder, visibly.
 *
 * `fit` is chosen per photo because the sources are square and the banner is 3:1:
 *
 *   - `cover` crops a band. Right for a full-bleed scene with the subject across the middle.
 *   - `compose` scales the whole photo to the banner's height and continues the backdrop
 *     sideways by repeating each row's edge pixel. Right for a single object on a plain studio
 *     backdrop, where any 3:1 band would cut through the subject. It also means the photo only
 *     has to be as tall as the banner — the frame shot below is 600px, a crop would upscale it.
 *
 * `alt` lives here, not in the seed data, because it describes this photo. A banner that falls
 * back to its placeholder keeps the seed's own alt.
 *
 * Rejected, so nobody tries them again: the MG Barbatos frame (edge-copy streaks on its noisy
 * backdrop), and the SPN-120 cutting close-up (the best story of the three, but a 500px source
 * — `cover` would upscale it ~2.4× on a retina card).
 */
export const BANNER_SOURCES = {
  'kits-mg': {
    handle: 'mg-rx-78-2-gundam-ver-3-0',
    image: 3,
    fit: 'compose',
    alt: 'The bare inner frame of the Master Grade RX-78-2 Ver. 3.0, lit against a dark backdrop',
  },
  'bundles-first-build-starter': {
    handle: 'entry-grade-rx-78-2-gundam',
    image: 7,
    fit: 'cover',
    alt: 'Two hands snapping an Entry Grade part off its runner, no tools',
  },
  'tools-nippers': {
    handle: 'gh-spn-120-ultimate-nipper-5-0-side-cutter',
    image: 1,
    fit: 'compose',
    alt: 'A God Hand single-blade nipper with blue grips',
  },
};
