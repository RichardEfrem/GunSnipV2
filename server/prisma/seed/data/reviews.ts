/**
 * Review copy for the seed.
 *
 * Written as fragments rather than whole reviews so a few dozen lines produce a few hundred
 * distinct-sounding reviews. They read like builders because the storefront is judged on
 * whether the review block looks like a real one — "Great product, five stars" repeated 600
 * times would make the histogram, the verified badge and the kit-specific fields look like
 * placeholder furniture rather than a feature.
 */

export interface ReviewTone {
  /** Star ratings a fragment of this tone can accompany. */
  ratings: readonly number[];
  titles: readonly string[];
  bodies: readonly string[];
}

export const KIT_REVIEW_TONES: readonly ReviewTone[] = [
  {
    ratings: [5],
    titles: ['Everything the box promises', 'Best build this year', 'No notes', 'Snapped together beautifully'],
    bodies: [
      'Fit is tight everywhere, no seam lines to hide on the arms, and the inner frame holds a pose without drooping. Nub marks cleaned up in an evening.',
      'Runners are laid out sensibly and the manual is clear enough that I never had to backtrack. Articulation is far better than I expected at this size.',
      'Plastic quality is excellent — colour separation means you can leave it unpainted and it still looks finished. Stickers are the only weak part.',
      'Went together over two evenings without a single stress mark. The joints are stiff enough that it still holds the pose I put it in a week ago.',
    ],
  },
  {
    ratings: [4],
    titles: ['Great kit, one annoyance', 'Very good with caveats', 'Solid build, awkward step', 'Happy with it'],
    bodies: [
      'Lovely kit overall. The waist assembly is fiddly and I had to widen one peg, but everything after that was smooth.',
      'Detail is sharp and the proportions are right. Docking a star because the decals are stickers rather than waterslide at this price.',
      'Builds fast and looks great on the shelf. The shoulder joints loosened slightly after a few repositions — nothing a drop of topcoat did not fix.',
      'No complaints about the moulding. The backpack is heavy enough that you will want a stand, which is not included.',
    ],
  },
  {
    ratings: [3, 4],
    titles: ['Fine, not remarkable', 'Does the job', 'Middle of the road'],
    bodies: [
      'It is a perfectly decent kit but nothing about it surprised me. Colour separation is average and there is a visible seam down each leg.',
      'Good value for the part count. The hands are the old style and do not hold the weapons well.',
      'Fun weekend build. I would recommend it to someone starting out, less so if you already have a shelf of these.',
    ],
  },
  {
    ratings: [2, 3],
    titles: ['Expected more', 'Not for beginners', 'Mixed feelings'],
    bodies: [
      'The engineering is clever but several parts needed sanding before they would seat, which is not what I expect at this grade.',
      'Poses well once built, but two of my polycaps were loose out of the bag and the whole thing is nose-heavy.',
      'Detail is there if you paint it. Straight from the box it looks flat, and the sticker sheet does not cover enough.',
    ],
  },
];

export const TOOL_REVIEW_TONES: readonly ReviewTone[] = [
  {
    ratings: [5],
    titles: ['Worth the money', 'Should have bought one sooner', 'Immediate upgrade', 'Does exactly one thing perfectly'],
    bodies: [
      'The difference against a cheap pair is not subtle — nub marks are almost gone before sanding, which saves the step entirely on dark plastic.',
      'Comfortable for a long session and the finish is clean enough that I stopped reaching for the knife.',
      'Bought it after ruining a runner with blunt tools. Night and day. Just keep it away from anything harder than plastic.',
      'Consistent results from the first cut. Storage cap actually stays on, which sounds trivial until you have lost one.',
    ],
  },
  {
    ratings: [4],
    titles: ['Very good, treat it carefully', 'Great once you adjust', 'Good tool, small gripe'],
    bodies: [
      'Works exactly as described. It is delicate, so this is not the tool for gates thicker than a millimetre.',
      'Flows well and dries evenly. The tip needed a wipe more often than I expected on light colours.',
      'Solid build quality. Slightly heavier in the hand than my old one, which took a session to get used to.',
    ],
  },
  {
    ratings: [3],
    titles: ['Adequate', 'Fine for the price'],
    bodies: [
      'Does the job but nothing more. I would spend more next time and buy once.',
      'Perfectly usable. The finish is a little inconsistent between the two I ordered.',
    ],
  },
];

/** Builders sign with a handle far more often than a full name. */
export const REVIEW_AUTHORS: readonly string[] = [
  'Adit P.',
  'Bagas',
  'Citra W.',
  'Dimas R.',
  'Eka',
  'Fajar N.',
  'Gilang',
  'Hana S.',
  'Indra',
  'Joko W.',
  'Kevin T.',
  'Lestari',
  'Maulana',
  'Nadia',
  'Oki',
  'Putra A.',
  'Rangga',
  'Sari D.',
  'Tio',
  'Yusuf',
  'nubmarks',
  'panel_liner',
  'runner_gremlin',
  'snapfit_only',
  'topcoat_tuesday',
];

/** Free-text answers to FR-REV-04's "what did you use", kept plausible against the catalogue. */
export const REVIEW_TOOLS_USED: readonly string[] = [
  'God Hand nipper',
  'Tamiya side cutter',
  'panel liner',
  'Mr. Hobby topcoat',
  'sanding sponge',
  'hobby knife',
  'Gundam markers',
  'decal setter',
];
