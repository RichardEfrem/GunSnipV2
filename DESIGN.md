# GunSnip — Design Specification

**Companion to:** PRD.md · **Version:** 0.2

---

## 1. Direction — Frame and Armor

A Gunpla kit is an **inner frame** (dark structural skeleton) with **armor panels** clipped over it. That's the system.

- **Frame** = chrome. Header, footer, filter rail, sticky bars, modals, admin sidebar. Dark gunmetal.
- **Armor** = content. Product grids, product pages, forms, cart. Light cool grey — the colour of unpainted runner plastic.

Merchandise lives on Armor. A fully dark storefront destroys colour accuracy on grey and pastel plastic, which is most of the catalogue. The mecha identity lives in the structure instead.

Accents are the RX-78-2 tricolor with **strict, non-overlapping roles**. Break these and the palette looks like a circus:

- **Red** — money and purchase intent only. Price, primary CTA, discount badge. Nowhere else.
- **Blue** — navigation and non-purchase interaction. Links, active nav, selected filters, focus.
- **Yellow** — status only. Never a fill larger than a badge.

---

## 2. Tokens

### 2.1 Colour

```css
/* Frame — structure */
--frame-900: #14161B;   /* header, footer, mobile tab bar */
--frame-700: #23272F;   /* raised frame surfaces, admin sidebar */
--frame-500: #3A404B;   /* borders on dark, disabled on dark */
--frame-300: #767C88;   /* secondary text on light, placeholder */

/* Armor — content */
--armor-000: #FFFFFF;   /* cards, inputs, sheets */
--armor-050: #F4F5F7;   /* page background */
--armor-150: #E3E6EA;   /* dividers, panel lines, card borders */
--ink:       #14161B;   /* primary text */

/* Accent */
--sortie-red:    #D6273C;  /* commerce only */
--core-blue:     #1F44A6;  /* navigation and interaction */
--signal-yellow: #FFC42E;  /* status only */

/* Semantic */
--ok:     #1E8E5A;
--warn:   #B4630F;
--danger: #98101F;
```

`--sortie-red` (CTA) and `--danger` (error) are both red, so errors **always** pair colour with an icon and text, never colour alone.

**Dark mode:** armor tokens take frame values, `--ink` → `#EDEFF2`, accents lighten ~12%. Frame is unchanged.

### 2.2 Type

One superfamily — **IBM Plex** — in three roles.

| Role | Face | Used for |
|---|---|---|
| Display | IBM Plex Sans Condensed 600 | Headings, product titles, nav, prices, buttons |
| Body | IBM Plex Sans 400/500 | Descriptions, labels, help text |
| Machine | IBM Plex Mono 400 | SKU, order number, unit code (`RX-78-2`), runner tag |

Condensed is a density decision — product titles need two lines in a 5-across grid. Mono is **only** for machine identifiers; using it for generic small labels is banned.

**Scale** (1.25 modular, 16px base): `12 · 14 · 16 · 20 · 24 · 30 · 38 · 48`

- Line height: body 1.55, headings 1.2, mono 1.4
- Measure capped at 68 characters
- Sentence case everywhere. No tracked-out all-caps eyebrow labels
- Grade badges (`HG`, `MG`, `PG`) are uppercase because they're acronyms
- Prices use tabular figures so they align down a grid column

### 2.3 Spacing, grid, shape

```css
--space: 4px base → 4 8 12 16 24 32 48 64 96
--content-max: 1280px
--gutter: 24px desktop / 16px mobile
--columns: 12
--radius: 2px          /* inputs, chips, secondary buttons */
--chamfer: 8px;        /* product cards + primary buttons only */
```

Gunpla armor is chamfered, not rounded. Cut the top-left and bottom-right corners:

```css
clip-path: polygon(var(--chamfer) 0, 100% 0, 100% calc(100% - var(--chamfer)),
                   calc(100% - var(--chamfer)) 100%, 0 100%, 0 var(--chamfer));
```

**Panel lines replace shadows.** Cards are separated by a 1px `--armor-150` border and divided internally by the same line. Shadows exist only where something genuinely floats — dropdowns, sheets, modals: `0 8px 24px rgba(20,22,27,.16)`.

### 2.4 Motion

One signature moment: **add to cart**. Thumbnail scales to 40px, arcs to the cart icon over 220ms `cubic-bezier(.2,.8,.2,1)`, badge pops 1 → 1.15 → 1 over 120ms. Reads as a part snapping into place.

Everything else: 120–180ms ease-out on state change. No scroll reveals. No hover transform on cards — hover raises the border to `--core-blue` only. `prefers-reduced-motion` disables the arc and all transforms.

---

## 3. Screens

### 3.1 Home

```
┌──────────────────────────────────────────────────────────────┐
│ FRAME-900                                                     │
│  GUNSNIP  [ Search kits, tools, mobile suits…   🔍 ]  ♡  🛒  │
│  Kits ▾   Tools ▾   Bundles   Guides         Track order     │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  HERO — one static image, no carousel                         │
│  Full-bleed runner photo, parts still attached                │
│      RG Nu Gundam                                             │
│      374 parts. A weekend, if you're quick.                   │
│      [ View kit ]                                             │
└──────────────────────────────────────────────────────────────┘
  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌─────┐   grade shortcuts
  │ EG ││ HG ││ RG ││ MG ││ PG ││ SD ││Tools│   ← real navigation
  └────┘└────┘└────┘└────┘└────┘└────┘└─────┘

  New arrivals                                    See all →
  ┌────┐┌────┐┌────┐┌────┐┌────┐

  ┌──────────────────────────────────────────┐
  │ First kit?                                │
  │ Three kits, one tool, no glue. ~2h each.  │
  │ [ Start here ]                            │
  └──────────────────────────────────────────┘

  Tools & supplies · Back in stock · Promo rail · Guides
```

**No hero carousel.** Slide two is rarely seen and rotation steals attention from navigation. Promotions get a dedicated rail lower down.

### 3.2 Category listing — desktop

```
Home / Kits / Master Grade

Master Grade                                          218 kits
1/100 scale. Full inner frame, high part count, 8–20 hours.

┌─ FILTERS ──────┐  ┌────────────────────────────────────────┐
│ Grade       ▾  │  │ Applied: [MG ×] [UC ×] [In stock ×]     │
│ ☑ MG    (218)  │  │                          Clear all      │
│ ☐ MGEX   (12)  │  ├────────────────────────────────────────┤
│ ☐ PG     (24)  │  │                     Sort: Newest    ▾  │
│ ☐ RG    (146)  │  ├────────────────────────────────────────┤
│                │  │ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐          │
│ Scale       ▾  │  │ │crd│ │crd│ │crd│ │crd│ │crd│          │
│ Series      ▾  │  │ └───┘ └───┘ └───┘ └───┘ └───┘          │
│ Difficulty  ▾  │  │ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐          │
│ Price       ▾  │  │ │crd│ │crd│ │crd│ │crd│ │crd│          │
│ Availability▾  │  │ └───┘ └───┘ └───┘ └───┘ └───┘          │
│ Brand       ▾  │  │        [ Load more ]                    │
│                │  │        1  2  3 … 12                     │
└────────────────┘  └────────────────────────────────────────┘
  240px sticky        5 @ ≥1280 · 4 @ 1024 · 3 @ 768 · 2 mobile
```

Grade and Series expand by default — they carry the most filtering power. Every option shows a count. Zero-result options render **disabled, not hidden** — vanishing options make the filter set feel unstable.

Applied-filter chips are non-negotiable: without them users misread filtered results as the whole catalogue.

### 3.3 Category listing — mobile

```
┌─────────────────────────┐
│ ← Master Grade      🔍  │  sticky, frame-900
├─────────────────────────┤
│ [MG ×][UC ×][In stock ×]│  chips, horizontal scroll
├─────────────────────────┤
│ 218 kits                │
│ [⚙ Filter]  [↕ Sort]    │  sticky → bottom sheets
├─────────────────────────┤
│ ┌───────┐   ┌───────┐   │
│ │ card  │   │ card  │   │
│ └───────┘   └───────┘   │
├─────────────────────────┤
│  🏠    ⊞    🛒    📦   ☰│  tab bar, frame-900
│ Home  Shop  Cart Orders │
└─────────────────────────┘
```

Filter sheet covers ~85% height. The apply button shows a **live** count — "Show 218 kits" — updating as options are ticked, before committing.

### 3.4 Product card

```
┌──────────────────────────┐  chamfer TL + BR
│      product image       │  1:1, --armor-050 backdrop
│                     [MG] │  grade badge, --core-blue
│  [−25%]                  │  discount badge, --sortie-red
├──────────────────────────┤  panel line
│ RG 1/144 Nu Gundam       │  condensed 600, 16px, max 2 lines
│ Ver.Ka                   │
│ Rp 1.250.000             │  condensed 600, 20px, --sortie-red
│ Rp 1.680.000             │  14px strikethrough, --frame-300
│ ★ 4.8 (142) · 1.2k sold  │  12px, --frame-300
│ ● In stock               │  12px, --ok
│ ┌──────────┐             │
│ │MG · 1/100│             │  runner tag, mono 12px
│ └──────────┘             │
└──────────────────────────┘
```

The card's job is to let someone **discard** it without a click. Grade and scale answer "right kind of thing"; price and stock answer "can I have it"; rating and sold count answer "is it good". Omitting stock state costs a click every time an item is out.

Hover: border → `--core-blue`, image scales 1.02 inside its clip. No lift, no shadow.

### 3.5 Product detail

```
Home / Kits / Master Grade / MG Nu Gundam Ver.Ka

┌────────────────────┐  ┌──────────────────────────────────┐
│                    │  │ MG · 1/100 · Universal Century    │
│     main image     │  │ MG 1/100 RX-93 Nu Gundam Ver.Ka   │
│                    │  │ Bandai · SKU MG-RX93-VKA          │
│                    │  │ ★ 4.8 (142) · 1.2k sold           │
├──┬──┬──┬──┬──┐     │  │                                   │
│▪ │▪ │▪ │▪ │▪ │     │  │ Rp 1.250.000    Rp 1.680.000      │
└──┴──┴──┴──┴──┘     │  │ Save 25%                          │
                      │  │ ● In stock — 8 left               │
  SPECIFICATIONS      │  │ Qty  [ − ] 1 [ + ]                │
  ─────────────────   │  │ [  Add to cart  ] [  Buy now  ]   │
  Grade      MG       │  │ ♡ Save to Stash                   │
  Scale      1/100    │  │ ┌───────────────────────────────┐ │
  Runners    21       │  │ │ What you'll need to build this│ │
  Parts      483      │  │ │ ☐ Required                    │ │
  Difficulty Advanced │  │ │   God Hand nipper  Rp 385.000 │ │
  Decals     Waterslide│ │ │ ☐ Required                    │ │
  Build time ~14 hours│  │ │   Hobby knife      Rp  95.000 │ │
  Released   2014     │  │ │ ☐ Recommended                 │ │
                      │  │ │   Decal setter     Rp  65.000 │ │
                      │  │ │   Waterslide decals need this │ │
                      │  │ │ [ Add selected — Rp 0 ]       │ │
                      │  │ └───────────────────────────────┘ │
                      │  └──────────────────────────────────┘

  Description │ Specifications │ Reviews (142) │ Shipping
  Also available as    ┌───┐┌───┐┌───┐   RG 1/144 · HG 1/144
  From the same series ┌───┐┌───┐┌───┐┌───┐┌───┐
```

The build-requirements block is the page's reason to exist and sits above the fold on desktop. **All boxes start unticked, total starts at Rp 0** — the customer opts in and sees the price before they do. Tools already in cart render as "Already in cart" with the checkbox removed.

Mobile stacks: gallery → title/price/stock → buy → requirements → specs → tabs. Sticky bar appears once the buy block scrolls out:

```
┌─────────────────────────┐
│ Rp 1.250.000            │
│ [♡] [  Add to cart  ]   │  frame-900, safe-area padded
└─────────────────────────┘
```

### 3.6 Cart

```
Cart (4 items)
┌──────────────────────────────────────┐  ┌──────────────────┐
│ ☑ Select all                  Delete │  │ Order summary    │
├──────────────────────────────────────┤  │ Subtotal (3)     │
│ ☑ ▪ MG Nu Gundam Ver.Ka              │  │    Rp 1.730.000  │
│     Rp 1.250.000                     │  │ Voucher          │
│     [−] 1 [+]     ♡ Stash    Remove  │  │    − Rp 100.000  │
├──────────────────────────────────────┤  │ Shipping (est.)  │
│ ☑ ▪ God Hand SPN-120 nipper          │  │      Rp  22.000  │
│     Rp 385.000                       │  │ ───────────────  │
├──────────────────────────────────────┤  │ Total            │
│ ☐ ▪ Mr. Hobby Top Coat — Flat        │  │    Rp 1.652.000  │
│     Rp 95.000    ⚠ Only 2 left       │  │ [ Voucher code ] │
├──────────────────────────────────────┤  │ [   Checkout   ] │
│ ☑ ▪ Tamiya panel liner — Black       │  └──────────────────┘
└──────────────────────────────────────┘        sticky
```

Per-line checkboxes drive the totals. Unchecked lines stay in the cart and are excluded from checkout — the cart doubles as a shortlist, which is how people actually use it.

Changes since add appear as an inline notice, never a silent update: "Price changed from Rp 320.000", "Only 2 left — quantity reduced to 2."

### 3.7 Checkout

Single scrolling page, not a wizard. Wizards hide the total until the end, which is the fee-surprise dark pattern in structural form.

```
Checkout                                    Back to cart
┌──────────────────────────────────────┐  ┌──────────────────┐
│ 1  Contact                           │  │ 4 items  ▪▪▪▪    │
│    Name / Email / Phone              │  │ Subtotal 1.730.000│
│ 2  Shipping address                  │  │ Voucher  − 100.000│
│    Province ▾ City ▾ District ▾      │  │ Shipping    22.000│
│    Postal code / Street / Notes      │  │ ──────────────── │
│ 3  Delivery                          │  │ Total Rp1.652.000│
│    ◉ Regular   2–3 days   Rp 22.000  │  │ [ Place order  ] │
│    ○ Express   1 day      Rp 45.000  │  └──────────────────┘
│ 4  Payment                           │        sticky
│    ◉ Bank transfer                   │
│    ○ Virtual account  ○ E-wallet     │
└──────────────────────────────────────┘
```

Summary is a sidebar on desktop, a collapsible sticky panel on mobile. **The total is visible at every scroll position.** Payment methods are the Phase 0 mock (PRD §6.6) but this screen is final — swapping in a real gateway changes what happens *after* "Place order".

### 3.8 Order confirmation

```
        ✓  Order placed
        GS-260907-4471                     mono
        Complete payment within 23:47:12
        ┌──────────────────────────────────┐
        │ Bank transfer                     │
        │ BCA · 8801 2345 6789      [Copy] │  mono
        │ Rp 1.652.000                      │
        └──────────────────────────────────┘
        ●───────○───────○───────○───────○
      Placed  Paid  Packing Shipped Delivered
```

Timeline is horizontal on desktop, vertical on mobile. Done steps `--ok`, current `--core-blue` filled, future `--armor-150`.

---

## 4. Components

### 4.1 Header

Two rows on `--frame-900`.

- **Row 1** — wordmark · search (flex-grows) · Stash · cart with count badge
- **Row 2** — Kits ▾ · Tools ▾ · Bundles · Guides · (right) Track order

Search sits on `--frame-700` with a `--frame-500` border → `--core-blue` on focus. Placeholder rotates between real examples on page load only, never while focused: `RX-78-2`, `Master Grade`, `panel liner`, `1/100 Barbatos`.

Dropdowns are two-column panels, max two levels, **opened on click not hover** — hover menus misfire and don't exist on touch. On scroll past 200px, row 2 collapses and row 1 compresses to 56px.

### 4.2 Buttons

| Variant | Fill | Text | Use |
|---|---|---|---|
| Primary | `--sortie-red` | white | Add to cart, Place order, Checkout. **One per view** |
| Secondary | transparent, 1px `--core-blue` | `--core-blue` | Buy now, Apply filters |
| Ghost | transparent | `--ink` | Cancel, tertiary |
| Danger | transparent, 1px `--danger` | `--danger` | Remove, Cancel order |

44px tall (48px touch). Chamfer on primary only. Loading state swaps the label for a spinner and **preserves width** so nothing reflows. Disabled buttons carry a `title` explaining why.

### 4.3 Badges

| Badge | Style | Rule |
|---|---|---|
| Grade | `--core-blue` fill, white | Always on kit cards |
| Discount | `--sortie-red` fill, white | Only when `compare_at_price` exists |
| New | `--signal-yellow` fill, `--ink` | Added within 30 days |
| Preorder | `--signal-yellow` outline | Not yet released |
| Low stock | `--warn` text, no fill | Available ≤ 5 |
| Out of stock | `--frame-300` fill, white | Available = 0 |

Max two per card. Priority: out of stock > discount > new > preorder.

### 4.4 Forms

Labels **above** inputs, always visible — placeholder-as-label vanishes on focus and causes errors. Inputs 44px, `--armor-000`, 1px `--armor-150`, 2px `--core-blue` on focus.

Validate on blur, not per keystroke. Errors below the field in `--danger` with an icon; input border turns `--danger`. Invalid submit moves focus to the first bad field and announces the error count. Mark required fields *or* optional fields — never neither.

### 4.5 The four states

Every list, grid and panel needs all four designed, not just the happy path.

**Loading** — skeletons matching real dimensions exactly so nothing shifts on arrival. 1.4s shimmer, disabled under reduced-motion.

**Empty** — a reason and a route out:
```
No kits match these filters.
Try removing "In stock" — 42 Master Grade kits are on preorder.
[ Clear filters ]   [ Browse all Master Grade ]
```

**Error** — what failed and what to do. No apology, no "Oops":
```
Couldn't load these products.
The catalogue didn't respond. Your cart is safe.
[ Try again ]
```

**Offline** — `--frame-900` bar pinned bottom: "You're offline. Cart changes will sync when you reconnect."

### 4.6 Focus

2px `--core-blue` outline at 2px offset, plus four corner brackets — a targeting reticle. On-theme *and* more visible than a plain ring on busy backgrounds.

```
 ┌╴      ╶┐
  [ Button ]
 └╴      ╶┘
```

`:focus-visible` only. Never removed.

---

## 5. Copy rules

| Don't | Do |
|---|---|
| "Oops! Something went wrong 😅" | "Couldn't load these products." |
| "Amazing kits at unbeatable prices!" | "218 Master Grade kits. 194 in stock." |
| Toast: "Success!" | Toast: "Added to cart." |
| "You might also like" | "Also available as RG and HG" |
| "Difficulty: 4/5" | "Advanced — waterslide decals, no stickers" |

- An action keeps its name through the whole flow: button "Add to cart" → toast "Added to cart" → page "Cart".
- Numbers over adjectives. "8 left" not "Almost gone".
- Sentence case in every label, heading and button.
- No exclamation marks except one: order placed.
- Domain words used correctly and untranslated — runner, nub, gate, panel line, topcoat. Guides pages exist for people who don't know them.
- Wishlist is **Stash**. Everything else in navigation uses the boring obvious word.

---

## 6. Accessibility floor

Build conditions, not a later pass.

- Contrast ≥ 4.5:1 body, ≥ 3:1 large text and UI boundaries. `--sortie-red` on white is 5.1:1 — re-verify any tint change.
- Everything keyboard-operable in logical tab order. Focus never suppressed.
- Colour is never the only signal: stock pairs a dot with a word, errors pair colour with an icon and text.
- Touch targets ≥ 44×44px.
- Product alt text describes the kit, never "product image".
- Sheets and modals trap focus, close on Escape, return focus to trigger.
- Live regions announce cart updates, filter counts, form errors.
- `prefers-reduced-motion` disables the cart arc, shimmer, transforms.
- 200% zoom without horizontal scroll.

---

## 7. Implementation notes

- **Tailwind v4**, tokens declared as CSS custom properties in `@theme` so they work as utilities and in raw CSS.
- **shadcn/ui** is fine as a base for dialogs, sheets, selects, comboboxes — but restyle to these tokens before shipping. Default shadcn looks like every other project using it.
- Fonts self-hosted via `next/font/local`, `display: swap`, Latin subset. Load Condensed + Sans eagerly, Mono lazily.
- Images via `next/image` with explicit dimensions, AVIF → WebP, blur placeholder from a stored `blurDataUrl`.
- Chamfer is `clip-path`, not a rotated pseudo-element — respects overflow, costs nothing.
- Build all four states of a component before wiring data. Faster than finding the empty state in QA.

**Do not** reach for: neon cyan on black (kills colour accuracy on grey plastic), Orbitron/Rajdhani (illegible under 24px), uniform rounded cards with soft shadows, auto-rotating hero carousels, all-caps eyebrow labels, `01/02/03` markers on anything that isn't genuinely a sequence. Only two things on this site are sequences: checkout sections and the order timeline.