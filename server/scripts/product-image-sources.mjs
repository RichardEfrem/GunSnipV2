/**
 * Seed slug → GundamPlanet product handle.
 *
 * Curated by hand rather than fuzzy-matched. Automated title matching was tried first and got
 * it wrong in both directions: it scored the correct "GH-SPN-120 Ultimate Nipper 5.0 Side
 * Cutter" at 0.28 because the seed spells the brand out, and confidently paired "Mr. Mark
 * Softer" with an unrelated blurring marker. A catalogue of 64 is small enough to read.
 *
 * A slug absent from this map keeps its generated placeholder. That is a deliberate outcome,
 * not a gap to paper over: putting a photo of Tamiya's straight tweezers on a product called
 * "Reverse-Action Tweezers" would be a wrong product image, which is worse than an honest
 * placeholder. The absent ones are listed in UNAVAILABLE below with the reason.
 */
export const SOURCES = {
  // ------------------------------------------------------------------ Entry Grade
  'eg-1-144-rx-78-2-gundam': 'entry-grade-rx-78-2-gundam',
  'eg-1-144-strike-gundam': 'entry-grade-strike-gundam',
  'eg-1-144-nu-gundam': 'entry-grade-nu-gundam',

  // ------------------------------------------------------------------ SD
  'sdcs-gundam-aerial': 'sd-gundam-ex-standard-gundam-aerial',
  'sd-ex-standard-barbatos': 'sd-gundam-ex-standard-gundam-barbatos',
  'sdcs-sazabi': 'sd-gundam-ex-standard-sazabi',

  // ------------------------------------------------------------------ High Grade
  'hg-1-144-rx-78-2-gundam-beyond-global': 'hg-rx-78-2-gundam-beyond-global',
  'hg-1-144-gundam-aerial': 'hg-gundam-aerial',
  'hg-1-144-gundam-barbatos-lupus-rex': 'hg-ibo-gundam-barbatos-lupus-rex',
  'hg-1-144-gundam-exia': 'hg00-gundam-exia',
  // "Custom", not the plain XXXG-00W0: Wing Zero Custom IS the Endless Waltz design, the one
  // with the feathered wings. The store's plain listing is the TV-series airframe.
  'hg-1-144-wing-gundam-zero-ew': 'hg-1-144-xxgx-00w0-wing-gundam-zero-custom',
  'hg-1-144-zaku-ii-chars-custom': 'hguc-ms-06s-zaku-ii-char-custom-revive',
  'hg-1-144-gundam-calibarn': 'hg-gundam-calibarn',
  'hg-1-144-gundam-barbatos': 'hg-ibo-gundam-barbatos',
  'hg-1-144-strike-freedom': 'hgce-zgmf-x20a-strike-freedom-gundam',

  // ------------------------------------------------------------------ Real Grade
  'rg-1-144-rx-78-2-gundam-ver-2': 'rg-rx-78-2-gundam-ver-2-0',
  'rg-1-144-nu-gundam': 'rg-rx-93-nu-gundam',
  'rg-1-144-sazabi': 'rg-msn-04-sazabi',
  'rg-1-144-strike-freedom': 'rg-zgmf-x20a-strike-freedom-gundam',
  'rg-1-144-wing-gundam-zero-ew': 'rg-xxxg-00w0-wing-gundam-zero-custom',
  'rg-1-144-zaku-ii-chars-custom': 'rg-ms-06s-zaku-ii-char-custom',
  'rg-1-144-gundam-exia': 'rg-gn-001-gundam-exia',

  // ------------------------------------------------------------------ Master Grade
  'mg-1-100-nu-gundam-verka': 'mg-rx-93-nu-gundam-ver-ka',
  'mg-1-100-sazabi-verka': 'mg-msn-04-sazabi-ver-ka',
  'mg-1-100-barbatos': 'mg-asw-g-08-gundam-barbatos',
  'mg-1-100-wing-gundam-zero-ew-verka': 'mg-xxxg-00w0-wing-gundam-zero-custom-ver-ka',
  'mg-1-100-rx-78-2-gundam-ver-3': 'mg-rx-78-2-gundam-ver-3-0',
  'mg-1-100-strike-freedom-ver-2': 'mg-zgmf-x20a-strike-freedom-gundam',
  'mg-1-100-unicorn-gundam-verka': 'mg-rx-0-unicorn-gundam-ver-ka',
  'mg-1-100-gundam-exia': 'mg-gn-001-gundam-exia',
  'mgex-1-100-unicorn-gundam-verka': 'mgex-rx-0-unicorn-gundam-ver-ka',

  // ------------------------------------------------------------------ Perfect Grade
  'pg-unleashed-1-60-rx-78-2-gundam': 'pg-unleashed-rx-78-2-gundam',
  'pg-1-60-unicorn-gundam': 'pg-rx-0-unicorn-gundam',
  'pg-1-60-strike-freedom': 'pg-zgmf-x20a-strike-freedom-gundam',

  // ------------------------------------------------------------------ other kit lines
  'fm-1-100-gundam-barbatos-lupus': '1-100-full-mechanics-gundam-barbatos-lupus',
  're100-1-100-nightingale': 're-1-100-msn-04-ii-nightingale',
  'hirm-1-100-gundam-astray-red-frame': 'high-resolution-model-gundam-astray-red-frame',
  'mega-1-48-rx-78-2-gundam': 'mega-size-1-48-rx-78-2-gundam',

  // ------------------------------------------------------------------ cutting
  'god-hand-spn-120-ultimate-nipper': 'gh-spn-120-ultimate-nipper-5-0-side-cutter',
  'dspiae-st-a-single-blade-nipper': 'st-a-3-0-single-blade-nipper',
  'tamiya-sharp-pointed-side-cutter': 'sharp-pointed-side-cutter',
  'tamiya-modelers-knife': 'modeler-s-knife-red',

  // ------------------------------------------------------------------ shaping
  'tamiya-sanding-sponge-sheet': 'sanding-sponge-sheet-1000',
  'dspiae-glass-file': 'sf-15-siren-glass-file',
  'god-hand-nub-polishing-set': 'gh-ks-sp-sanding-sponge-special-set',

  // ------------------------------------------------------------------ painting & finishing
  'tamiya-panel-line-accent-color': 'tamiya-panel-line-accent-color',
  'gundam-marker-panel-liner': 'fine-point-gundam-marker-for-panel-lines',
  'mr-hobby-mr-super-clear': 'mr-super-clear-spray-170ml-matt',
  'mr-hobby-mr-top-coat': 'mr-top-coat-spray-88ml-flat',
  'gundam-marker-basic-set': 'gms105-gundam-marker-basic-set-set-of-6',
  'mr-color-lacquer-paint': 'mr-color-gx-series-gloss',

  // ------------------------------------------------------------------ adhesive & decal
  'tamiya-extra-thin-cement': 'extra-thin-cement-40ml',
  'mr-hobby-mr-cement-s': 'mr-cement-s',
  'mr-hobby-mr-mark-setter': 'mr-mark-setter-40ml',
  'mr-hobby-mr-mark-softer': 'mr-mark-softer-40ml',

  // ------------------------------------------------------------------ display & workspace
  'bandai-action-base-5': '1-144-display-stand-action-base-5-black',
  'tamiya-cutting-mat-a4': 'cutting-mat-a4-size',
};

/** Why the remaining seven keep their placeholder, so nobody re-litigates it from scratch. */
export const UNAVAILABLE = {
  'olfa-art-knife-pro': 'Olfa is not carried by the source store.',
  'god-hand-kamiyasu-sanding-stick': 'Store stocks Kamiyasu Towel only, which is a different product.',
  'gaia-notes-surface-primer': 'Store carries Gaia paints but no Gaia surfacer.',
  'tamiya-reverse-action-tweezers': 'Tamiya straight and angled only; reverse-action is not stocked.',
  'wave-display-case-medium': 'Wave is not carried by the source store.',
  'dspiae-led-magnifier-lamp': 'No DSPIAE lamp in the catalogue.',
  'dspiae-parts-storage-tray': 'No DSPIAE tray in the catalogue.',
};
