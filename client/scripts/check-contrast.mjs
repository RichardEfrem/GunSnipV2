/**
 * Proves the palette against the DESIGN.md §6 accessibility floor.
 *
 * §2.1 says to re-verify contrast on any tint change, and a design system that only claims
 * accessibility is a design system that quietly loses it. This reads the real token file, so it
 * cannot drift from what ships — change a hex and this fails before the browser does.
 *
 *   npm run check:contrast
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TOKENS = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url));

/** `--name: #hex;` or `--name: light-dark(#light, #dark);` */
const DECLARATION =
  /^\s*--([a-z0-9-]+):\s*(?:light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)|(#[0-9a-f]{6}))\s*;/gim;

function readPalette() {
  const css = readFileSync(TOKENS, 'utf8');
  const light = new Map();
  const dark = new Map();

  for (const [, name, lightValue, darkValue, single] of css.matchAll(DECLARATION)) {
    light.set(name, lightValue ?? single);
    dark.set(name, darkValue ?? single);
  }

  return { light, dark };
}

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminance(hex) {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * `min` is 4.5 for anything that is or can be small text, and 3 for boundaries that identify a
 * control. Decorative panel lines are deliberately absent — a card is identified by its
 * contents, not its divider.
 */
const PAIRS = [
  ['Body text on page', 'ink', 'armor-050', 4.5],
  ['Body text on card', 'ink', 'armor-000', 4.5],
  ['Secondary text on page', 'frame-300', 'armor-050', 4.5],
  ['Secondary text on card', 'frame-300', 'armor-000', 4.5],
  ['Price on card', 'sortie-red', 'armor-000', 4.5],
  ['Link on page', 'core-blue', 'armor-050', 4.5],
  ['In stock', 'ok', 'armor-000', 4.5],
  ['Low stock', 'warn', 'armor-000', 4.5],
  ['Error text', 'danger', 'armor-000', 4.5],
  ['Input border', 'field-border', 'armor-000', 3],
  ['Focus ring on page', 'core-blue', 'armor-050', 3],
  ['Focus ring on card', 'core-blue', 'armor-000', 3],
  ['Header text', 'armor-000-literal-white', 'frame-900', 4.5],
  ['Frame secondary text on 900', 'frame-muted', 'frame-900', 4.5],
  ['Frame secondary text on 700', 'frame-muted', 'frame-700', 4.5],
  ['Search field border', 'frame-field-border', 'frame-700', 3],
  // The reticle also lands on nav links, which sit on the frame rather than on armor.
  ['Focus ring on frame-900', 'frame-focus', 'frame-900', 3],
  ['Focus ring on frame-700', 'frame-focus', 'frame-700', 3],
];

/** White is not a token — it is the fixed text colour on every accent fill. */
const WHITE = '#ffffff';
const FILL_PAIRS = [
  ['Primary button label', 'red-fill', 4.5],
  ['Grade badge label', 'blue-fill', 4.5],
  ['Out-of-stock badge label', 'muted-fill', 4.5],
];

function resolve(palette, name) {
  if (name === 'armor-000-literal-white') return WHITE;

  const value = palette.get(name);
  if (value === undefined) throw new Error(`No such token: --${name}`);
  return value;
}

/**
 * `<meta name="theme-color">` cannot reference a CSS variable, so `lib/constants.ts` carries
 * --frame-900 as a literal. This is what stops that copy going stale.
 */
function checkThemeColorLiteral(palette, failures) {
  const source = readFileSync(fileURLToPath(new URL('../src/lib/constants.ts', import.meta.url)), 'utf8');
  const match = source.match(/BROWSER_THEME_COLOR\s*=\s*'(#[0-9a-f]{6})'/i);
  const expected = palette.get('frame-900');
  const actual = match?.[1]?.toLowerCase();

  const passed = actual === expected;
  if (!passed) {
    failures.push(`BROWSER_THEME_COLOR is ${actual ?? 'missing'}, --frame-900 is ${expected}`);
  }
  console.log(`${passed ? '  ok  ' : ' FAIL '} both          ${expected}  BROWSER_THEME_COLOR matches --frame-900`);
}

function main() {
  const palette = readPalette();
  const failures = [];

  for (const theme of ['light', 'dark']) {
    for (const [label, foreground, background, min] of PAIRS) {
      const ratio = contrast(resolve(palette[theme], foreground), resolve(palette[theme], background));
      const passed = ratio >= min;

      if (!passed) failures.push(`${theme}: ${label} — ${ratio.toFixed(2)}:1, needs ${min}:1`);
      console.log(
        `${passed ? '  ok  ' : ' FAIL '} ${theme.padEnd(5)} ${ratio.toFixed(2).padStart(6)}:1  ${label}`,
      );
    }

    // Fills hold still across themes, so white-on-fill is checked once per theme only to
    // confirm they really did hold still.
    for (const [label, fill, min] of FILL_PAIRS) {
      const ratio = contrast(WHITE, resolve(palette[theme], fill));
      const passed = ratio >= min;

      if (!passed) failures.push(`${theme}: ${label} — ${ratio.toFixed(2)}:1, needs ${min}:1`);
      console.log(
        `${passed ? '  ok  ' : ' FAIL '} ${theme.padEnd(5)} ${ratio.toFixed(2).padStart(6)}:1  ${label}`,
      );
    }
  }

  checkThemeColorLiteral(palette.light, failures);

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:\n${failures.join('\n')}`);
    process.exit(1);
  }

  console.log('\nAll pairs clear the DESIGN.md §6 contrast floor.');
}

main();
