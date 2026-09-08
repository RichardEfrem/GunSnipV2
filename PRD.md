# GunSnip — Product Requirements Document

**Version:** 0.1 (draft)
**Owner:** Efrem
**Last updated:** 2026-09-07
**Status:** Ready for build

---

## 1. Overview

GunSnip is an online store for Gunpla — Gundam plastic model kits — and everything needed to build them: nippers, knives, files, sanding sticks, panel line markers, paints, cements, topcoats, decals, display bases and storage.

The name comes from the first real action in every build: snipping a part off the runner. That's the positioning. GunSnip is not just a box shop; it sells the *build*, which means the kit and the tools are treated as one connected catalogue rather than two unrelated departments.

**Stack:** Next.js (storefront + admin UI) · NestJS (REST API) · PostgreSQL

### 1.1 Why this exists

Most kit shops list model kits with a photo, a price, and nothing else. A buyer choosing between a High Grade and a Master Grade of the same mobile suit has no idea what actually differs, and a first-time builder has no idea they need a nipper at all until the box arrives. GunSnip's differentiator is a catalogue that understands grade, scale and skill level, and that can answer "what do I need to build this?" on the product page itself.

### 1.2 Assumptions

These were not specified in the brief. Flagging them so they can be corrected early rather than unwound late.

| # | Assumption | Impact if wrong |
|---|---|---|
| A1 | Single-vendor store (GunSnip is the seller). Not a marketplace. | Marketplace adds seller accounts, per-seller carts, payouts — roughly doubles scope |
| A2 | Currency is IDR, formatted `Rp 1.250.000`. Prices stored as integer minor units | Multi-currency would need a rate table and price-per-currency |
| A3 | Interface language is English, with the string layer structured so `id-ID` can be added later | Bilingual from day one changes every content table |
| A4 | Shipping is domestic Indonesia, flat-rate per courier tier. No live courier rate API in v1 | Live rates need a RajaOngkir/Biteship integration |
| A5 | Backend framework is NestJS (a Node.js framework), matching the earlier stack decision | — |

---

## 2. Goals and non-goals

### 2.1 Goals

- **G1** — A complete, working purchase path: browse → find → evaluate → cart → checkout → order placed → order tracked.
- **G2** — A catalogue model that genuinely fits Gunpla (grade, scale, series, runner count, difficulty), not a generic product table with the domain crammed into tags.
- **G3** — Cross-sell tools from kit pages: a kit page can tell you what you need to build it and let you add it in one action.
- **G4** — A back office good enough that the store can actually be operated: products, stock, orders, vouchers, reviews.
- **G5** — Build order that defers auth and real payments to the end **without requiring rework**. Every seam they will eventually plug into exists from day one.

### 2.2 Non-goals for v1

- Multi-vendor / seller onboarding
- Live chat or ticketing
- Subscriptions, pre-orders with deposits, group buys
- Loyalty points, referrals, affiliate program
- Mobile app
- Live courier rate lookup and real tracking-number webhooks
- Recommendation engine driven by ML (v1 uses hand-authored + rule-based relations)

---

## 3. Users

| Persona | Who | What they need | Design consequence |
|---|---|---|---|
| **First kit** | Never built one. Saw a show, wants the robot. | To not be overwhelmed. To learn that tools exist. To not buy a Perfect Grade by accident. | Difficulty labels, "start here" entry points, required-tools block on the kit page |
| **Regular builder** | 5–50 kits built. Knows grades. Buying specific kits and consumables. | Fast filtering by grade/series, stock accuracy, restock visibility, quick reorder of paints and blades | Dense filterable grid, stock state on the card, saved list |
| **Finisher** | Paints, airbrushes, scratch-builds. High basket value on supplies. | Deep tool/paint catalogue with real specs — grit numbers, paint codes, nozzle sizes | Variant model that handles paint colour and file grit properly |
| **Operator (admin)** | Efrem / store staff | Add products fast, see what sold, fulfil orders, fix mistakes | Admin CRUD, order state controls, stock adjustments with an audit trail |

---

## 4. Scope and build phases

The brief specifies auth and real payments last. That splits the build into two phases with a hard rule attaching to Phase 0.

### Phase 0 — Everything else (the bulk of the work)

Full catalogue, search, filters, product pages, cart, checkout, order lifecycle, mock payment, admin. Runs on an **anonymous guest session**, not a user account.

> **Phase 0 rule:** every place that will eventually hold a `user_id` gets a nullable `user_id` column *now*, and every service reads identity through a single `CurrentActor` abstraction. See §11. This is what makes Phase 1 a small change rather than a migration.

### Phase 1 — Auth and real payment

Registration/login, sessions, guest-cart adoption, account area, address book, order history bound to an account, real payment gateway, role-based admin protection.

---

## 5. Domain model — the Gunpla part

### 5.1 Product types

Two product types share one base table, discriminated by `type`.

**`MODEL_KIT`**

| Attribute | Type | Notes |
|---|---|---|
| `grade` | enum FK | `EG`, `SD`, `HG`, `RG`, `MG`, `MGEX`, `PG`, `FM` (Full Mechanics), `RE100`, `HIRM`, `MEGA` |
| `scale` | enum FK | `1/144`, `1/100`, `1/60`, `1/48`, `1/72`, `NON_SCALE` |
| `series` | FK | Universal Century, SEED, 00, Iron-Blooded Orphans, Wing, Witch from Mercury, Build series, Origin, … |
| `unit_name` | text | The mobile suit itself, e.g. "RX-78-2 Gundam". Distinct from product name |
| `unit_code` | text | e.g. `RX-78-2`, `MS-06S`. Highly searched — index it |
| `runner_count` | int | |
| `part_count` | int | |
| `difficulty` | enum | `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT` |
| `decal_type` | enum | `NONE`, `STICKER`, `FOIL`, `DRY_TRANSFER`, `WATERSLIDE` |
| `articulation_notes` | text | |
| `includes` | text[] | Weapons, stands, extra hands, LED-ready parts |
| `release_year` | int | |
| `runtime_minutes_est` | int | Estimated build time — powers "a weekend build" style copy |

**`TOOL_SUPPLY`** — subcategories: `CUTTING` (nippers, knives, blades), `SHAPING` (files, sanding sticks, sponges, polishing), `PAINTING` (markers, sprays, bottled paint, thinner, airbrush, compressors), `ADHESIVE` (cement, plastic glue, CA), `FINISHING` (panel liner, topcoat, weathering, pigments), `DECAL_AIDS` (setter, softener, tweezers), `DISPLAY` (action bases, cases, LED units), `STORAGE`, `WORKSPACE` (mats, lamps, magnifiers).

Tool-specific attributes live in `attributes JSONB` (grit number, paint code, blade angle, nozzle mm, capacity ml) with a GIN index. Kits get first-class columns because those fields drive the filter rail and must be fast and consistent.

### 5.2 Variants

Every product has at least one variant. Kits almost always have exactly one; tools often don't — a paint line has 40 colours, a file set has 5 grits.

```
product (1) ──< product_variant (n)
                 ├─ sku (unique)
                 ├─ option_values  {colour: "Mr. Color 8 Silver"} | {grit: "600"}
                 ├─ price_idr, compare_at_price_idr
                 ├─ stock_on_hand, stock_reserved
                 └─ weight_grams, barcode
```

Single-variant products hide the selector entirely in the UI.

### 5.3 Build compatibility — the differentiating relation

```
kit ──< product_requirement >── tool_product
         └─ necessity: REQUIRED | RECOMMENDED | OPTIONAL
         └─ reason: "Waterslide decals need setting solution"
```

Powers the "What you'll need to build this" block on every kit page (FR-PDP-08) and the starter bundle (FR-CAT-11). Curated per grade by default (every kit needs a nipper), overridable per product.

---

## 6. Functional requirements — storefront

### 6.1 Catalogue and navigation

| ID | Requirement | Priority |
|---|---|---|
| FR-CAT-01 | Home page with hero, grade shortcuts, new arrivals, back in stock, tools rail, and a "first build" entry point | Must |
| FR-CAT-02 | Two-level category navigation: Kits (by grade → by series) and Tools (by job → by subcategory) | Must |
| FR-CAT-03 | Category listing page with server-rendered products, breadcrumbs, and a total result count always visible | Must |
| FR-CAT-04 | Filter rail — kits: grade, scale, series, difficulty, price range, availability, brand. Tools: subcategory, brand, price, availability | Must |
| FR-CAT-05 | Multiple values of the same filter combine as OR; different filters combine as AND. Applied filters shown as removable chips above the grid | Must |
| FR-CAT-06 | Sort by: relevance, newest, price ascending, price descending, best selling, highest rated | Must |
| FR-CAT-07 | Filter and sort state serialised to the URL query string; the page is shareable and back-button safe | Must |
| FR-CAT-08 | Returning from a product page restores scroll position and the loaded page of results | Should |
| FR-CAT-09 | Pagination: "Load more" plus numbered pages. Not infinite scroll — it breaks footer access and deep linking | Must |
| FR-CAT-10 | Each filter option shows a result count; options that would yield zero results are disabled, not hidden | Should |
| FR-CAT-11 | Curated bundles: kit + tool set at a bundle price, purchasable as a single line item | Should |
| FR-CAT-12 | Editorial pages: grade comparison explainer, tool buying guide, build-order guide. Static MDX, linked from filters | Should |

### 6.2 Search

| ID | Requirement | Priority |
|---|---|---|
| FR-SRCH-01 | Persistent search input in the header on every page | Must |
| FR-SRCH-02 | PostgreSQL full-text search across name, unit name, unit code, series, brand, tags | Must |
| FR-SRCH-03 | Autosuggest after 2 characters, debounced 250ms — product suggestions with thumbnail and price, plus category suggestions | Must |
| FR-SRCH-04 | Synonym table so community names resolve: "Barbatos" → Gundam Barbatos, "Zaku II" ↔ MS-06, "nipper" ↔ "cutter" ↔ "sprue cutter", "topcoat" ↔ "top coat" | Should |
| FR-SRCH-05 | Typo tolerance via trigram similarity (`pg_trgm`) fallback when full-text returns nothing | Should |
| FR-SRCH-06 | Search results page uses the identical filter/sort rail as category pages | Must |
| FR-SRCH-07 | Zero-result page suggests corrected spelling, related categories, and popular products — never a dead end | Must |
| FR-SRCH-08 | Log queries and result counts to a `search_log` table for later merchandising | Could |

### 6.3 Product detail page

| ID | Requirement | Priority |
|---|---|---|
| FR-PDP-01 | Image gallery: thumbnails, zoom, keyboard navigable, swipeable on touch | Must |
| FR-PDP-02 | Name, brand, price, compare-at price with computed discount percentage, rating summary, units sold | Must |
| FR-PDP-03 | Kit spec block: grade, scale, series, unit code, runner count, part count, difficulty, decal type, estimated build time, release year | Must |
| FR-PDP-04 | Variant selector for multi-variant products; unavailable combinations shown as disabled, never silently missing | Must |
| FR-PDP-05 | Stock state on page: in stock, low stock with a real number, out of stock, preorder | Must |
| FR-PDP-06 | Quantity stepper bounded by available stock and a per-order cap | Must |
| FR-PDP-07 | Add to cart with an inline confirmation that does not navigate away; plus a separate Buy now | Must |
| FR-PDP-08 | **"What you'll need to build this"** — required and recommended tools from `product_requirement`, each with a checkbox and a single "Add selected" action. Items already in cart are shown as already covered | Must |
| FR-PDP-09 | Tabbed lower section: description, full specifications, reviews, shipping and returns | Must |
| FR-PDP-10 | Related products: same series, same unit at other grades ("also available as MG, RG"), frequently bought together | Should |
| FR-PDP-11 | Save to Stash (wishlist) | Should |
| FR-PDP-12 | Out-of-stock products stay reachable and indexable, with a "notify me" email capture | Should |
| FR-PDP-13 | Sticky purchase bar on mobile once the main buy block scrolls out of view | Must |
| FR-PDP-14 | SEO: unique title/description, Product + Offer + AggregateRating JSON-LD, canonical URL | Should |

### 6.4 Cart

| ID | Requirement | Priority |
|---|---|---|
| FR-CART-01 | Cart persists across sessions against the guest session ID (Phase 0) or user ID (Phase 1) | Must |
| FR-CART-02 | Line items show image, name, variant, unit price, quantity stepper, line total, remove | Must |
| FR-CART-03 | Per-line checkbox selection; the summary totals only selected lines. (Direct lift from Tokopedia/Shopee — buyers habitually park items in the cart and check out a subset) | Must |
| FR-CART-04 | Cart revalidates price and stock on load; changes are surfaced explicitly ("Price changed from Rp 320.000") rather than applied silently | Must |
| FR-CART-05 | Sticky order summary: subtotal, discount, shipping estimate, total | Must |
| FR-CART-06 | Voucher code entry with inline validation and a clear reason for rejection | Must |
| FR-CART-07 | Empty cart state links to grade shortcuts and best sellers | Must |
| FR-CART-08 | Move to Stash from cart | Could |
| FR-CART-09 | Mini-cart drawer from the header without leaving the page | Should |

### 6.5 Checkout

| ID | Requirement | Priority |
|---|---|---|
| FR-CO-01 | Guest checkout — no account required in either phase. Phase 1 adds an *optional* login | Must |
| FR-CO-02 | Single-page checkout with sections (contact, shipping address, delivery, payment, review), not a multi-step wizard | Must |
| FR-CO-03 | Address form: name, phone, email, province, city, district, postal code, street address, notes. Province/city/district as dependent selects from a seeded reference table | Must |
| FR-CO-04 | Delivery options: flat-rate courier tiers (regular / express / same-day where eligible) with cost and estimated days | Must |
| FR-CO-05 | Order summary persistently visible — sidebar on desktop, collapsible panel on mobile | Must |
| FR-CO-06 | Inline field-level validation on blur; on submit failure, focus moves to the first invalid field | Must |
| FR-CO-07 | Order creation is idempotent — the client sends an `Idempotency-Key`; a repeat submit returns the same order rather than creating a second | Must |
| FR-CO-08 | Stock is reserved at order creation; insufficient stock blocks the order with a specific message naming the line | Must |
| FR-CO-09 | Order confirmation page with order number, items, totals, payment instructions, and delivery estimate | Must |
| FR-CO-10 | Checkout draft survives a refresh (persisted client-side against the session) | Should |

### 6.6 Payment — Phase 0 mock

The mock and the real gateway must be interchangeable. Everything downstream of `Payment.status` is written once and never rewritten.

| ID | Requirement | Priority |
|---|---|---|
| FR-PAY-01 | `Payment` record created with every order: `PENDING` status, amount, method, expiry timestamp | Must |
| FR-PAY-02 | Checkout offers pseudo-methods (bank transfer, virtual account, e-wallet) that all resolve to the mock provider. Chosen method is stored — real routing later needs no schema change | Must |
| FR-PAY-03 | Confirmation page shows mock payment instructions and a countdown to expiry | Must |
| FR-PAY-04 | Admin can transition a payment to `PAID` or `FAILED` from the order detail screen | Must |
| FR-PAY-05 | Dev-only endpoint `POST /dev/payments/:id/simulate {status}` — disabled outside development by environment flag | Must |
| FR-PAY-06 | Scheduled job expires unpaid payments past their window, cancels the order, releases reserved stock | Must |
| FR-PAY-07 | Payment transitions are appended to a `payment_event` log, mirroring the shape of a real gateway webhook payload | Should |
| FR-PAY-08 | Provider selected behind a `PaymentProvider` interface (see §11.3) | Must |

### 6.7 Orders

| ID | Requirement | Priority |
|---|---|---|
| FR-ORD-01 | Human-readable order number: `GS-YYMMDD-XXXX` | Must |
| FR-ORD-02 | Guest order lookup by order number + email, no account needed | Must |
| FR-ORD-03 | Order detail: status timeline, items, address, totals breakdown, payment status, tracking number when shipped | Must |
| FR-ORD-04 | Buyer can cancel while status is `PENDING_PAYMENT` | Must |
| FR-ORD-05 | Orders capture a **snapshot** of product name, variant, image and price at purchase time. Later catalogue edits never mutate historical orders | Must |
| FR-ORD-06 | Every status change written to `order_event` with actor, timestamp and note | Must |
| FR-ORD-07 | Order history list bound to the account | Phase 1 |

### 6.8 Reviews

| ID | Requirement | Priority |
|---|---|---|
| FR-REV-01 | Ratings 1–5 with title, body, optional photos | Must |
| FR-REV-02 | Reviews are only accepted against a delivered order line. Phase 0 authorises via a tokenised link sent on delivery; Phase 1 uses the account | Must |
| FR-REV-03 | "Verified purchase" badge | Must |
| FR-REV-04 | Build-specific fields on kit reviews: actual build time, difficulty as experienced, tools used. This is genuinely useful signal and no generic review widget captures it | Should |
| FR-REV-05 | Rating distribution histogram, sort by newest/highest/lowest, filter to photos-only | Should |
| FR-REV-06 | Admin moderation queue: approve, reject, reply | Must |

### 6.9 Promotions

| ID | Requirement | Priority |
|---|---|---|
| FR-PROMO-01 | Voucher types: percentage, fixed amount, free shipping | Must |
| FR-PROMO-02 | Voucher constraints: minimum spend, maximum discount cap, validity window, total usage limit, per-session usage limit, category/product scope | Must |
| FR-PROMO-03 | Product-level sale price via `compare_at_price`; discount percentage computed, never hand-typed | Must |
| FR-PROMO-04 | Home page promo banners, scheduled and admin-managed | Should |
| FR-PROMO-05 | One voucher per order in v1. Stacking rules are a rabbit hole; leave it | Must |

### 6.10 Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-NOTIF-01 | Transactional email on: order placed, payment received, shipped, delivered | Should |
| FR-NOTIF-02 | Phase 0 uses a console/file mail transport behind a `Mailer` interface; a real provider drops in later | Must |
| FR-NOTIF-03 | Back-in-stock notification to captured emails when stock crosses zero upward | Could |

---

## 7. Functional requirements — admin

Admin is a route group inside the same Next.js app (`/admin/*`). Phase 0 protects it with a shared secret header; Phase 1 swaps in role-based auth. Nothing else about it changes.

| ID | Requirement | Priority |
|---|---|---|
| FR-ADM-01 | Dashboard: today's orders, revenue, orders awaiting payment, awaiting shipment, low stock, top products | Must |
| FR-ADM-02 | Product CRUD with type-aware forms — kit fields vs tool fields — and draft/published status | Must |
| FR-ADM-03 | Variant management: add, edit, archive; per-variant price and stock | Must |
| FR-ADM-04 | Image upload with reordering and a designated primary image | Must |
| FR-ADM-05 | Stock adjustment with a required reason; every change appended to `inventory_movement` | Must |
| FR-ADM-06 | Build-requirement editor — attach tools to a kit with necessity and reason | Must |
| FR-ADM-07 | Order list with filters by status, date range, search by number/email | Must |
| FR-ADM-08 | Order detail: advance status, mark paid, enter tracking number, cancel with reason, internal notes | Must |
| FR-ADM-09 | Category, series, grade and scale reference-data management | Must |
| FR-ADM-10 | Voucher CRUD with a usage counter | Must |
| FR-ADM-11 | Review moderation queue | Must |
| FR-ADM-12 | Banner and home-page rail curation | Should |
| FR-ADM-13 | Bulk product import from CSV | Could |
| FR-ADM-14 | Sales report with CSV export | Could |

---

## 8. Order and payment state machines

Implement these as explicit transition tables, not scattered `if` statements. An illegal transition throws.

### 8.1 Order

```
                      ┌──────────────────┐
                      │ PENDING_PAYMENT  │
                      └────────┬─────────┘
             payment PAID      │      expiry / buyer cancel / admin cancel
                  ┌────────────┴────────────┐
                  ▼                         ▼
             ┌─────────┐            ┌──────────────────────┐
             │  PAID   │            │ CANCELLED / EXPIRED  │
             └────┬────┘            └──────────────────────┘
                  │ admin picks & packs        (stock released)
                  ▼
             ┌─────────┐
             │ PACKING │
             └────┬────┘
                  │ tracking number entered
                  ▼
             ┌─────────┐      ┌───────────┐      ┌───────────┐
             │ SHIPPED │─────▶│ DELIVERED │─────▶│ COMPLETED │
             └─────────┘      └───────────┘      └───────────┘
                                     │ refund
                                     ▼
                               ┌──────────┐
                               │ REFUNDED │
                               └──────────┘
```

`DELIVERED → COMPLETED` happens automatically 7 days after delivery, or immediately on buyer confirmation.

### 8.2 Payment

```
PENDING ──▶ PAID
   │
   ├──▶ FAILED
   └──▶ EXPIRED      (scheduled job, 24h default window)

PAID ──▶ REFUNDED    (admin action)
```

### 8.3 Stock

`available = stock_on_hand − stock_reserved`

| Event | Effect |
|---|---|
| Order created | `stock_reserved += qty` |
| Payment `PAID` → order fulfilled/shipped | `stock_on_hand −= qty`, `stock_reserved −= qty` |
| Order cancelled or expired | `stock_reserved −= qty` |
| Admin adjustment | `stock_on_hand` set directly, `inventory_movement` row written |

Reservation and release run inside the same transaction as the order write, with `SELECT ... FOR UPDATE` on the variant row to prevent overselling under concurrency.

---

## 9. Data model sketch

```
product ──< product_variant ──< cart_item
   │             │
   │             └──< order_item (snapshotted)
   │             └──< inventory_movement
   │
   ├──< product_image
   ├──< product_requirement >── product   (kit → tool)
   ├──< review
   ├──> brand
   ├──> category
   ├──> grade | scale | series           (kits only, nullable)
   └─── attributes JSONB                 (long-tail specs, GIN indexed)

cart ──< cart_item
  └─ session_id, user_id (nullable)

order ──< order_item
  ├──< order_event
  ├──── payment ──< payment_event
  ├──── shipment
  ├──── voucher_redemption >── voucher
  ├─ session_id, user_id (nullable)
  └─ customer_snapshot JSONB  (name, email, phone, address at purchase time)

search_synonym
address_region  (province → city → district reference data)
notify_request  (back-in-stock email capture)
```

**Indexes that matter:** `products(type, status)`, `products(grade_id, scale_id)`, `product_variant(sku)` unique, GIN on the search `tsvector`, GIN on `attributes`, `orders(session_id)`, `orders(user_id)`, `orders(order_number)` unique.

---

## 10. API surface

REST, versioned under `/api/v1`. Cursor pagination on all list endpoints.

```
GET    /products                    ?type&grade&scale&series&difficulty&brand
                                    &minPrice&maxPrice&inStock&sort&cursor&limit
GET    /products/:slug
GET    /products/:slug/requirements
GET    /products/:slug/related
GET    /search                      ?q&<same filters>
GET    /search/suggest              ?q
GET    /categories
GET    /facets                      ?<current filters>   → option counts

GET    /cart
POST   /cart/items                  {variantId, qty}
PATCH  /cart/items/:id              {qty, selected}
DELETE /cart/items/:id
POST   /cart/voucher                {code}
DELETE /cart/voucher

GET    /shipping/regions            ?parentId
POST   /shipping/quote              {regionId, items}

POST   /orders                      {contact, address, shippingOptionId, paymentMethod, voucherCode}
                                    header: Idempotency-Key
GET    /orders/:orderNumber         ?email=   (guest lookup)
POST   /orders/:orderNumber/cancel

GET    /payments/:id
POST   /dev/payments/:id/simulate   {status}          [development only]
POST   /webhooks/payment                              [Phase 1]

GET    /products/:slug/reviews
POST   /reviews                     {token, rating, title, body, buildTimeMinutes}

POST   /notify-requests             {variantId, email}

/admin/*                            full CRUD, guarded (see §11.2)
```

---

## 11. Deferred auth and payment — the seams

This is the section that determines whether Phase 1 takes a day or a fortnight. Everything here is Phase 0 work.

### 11.1 Identity: `CurrentActor`

No service ever takes a `userId` parameter. Services take an **actor**:

```ts
type Actor =
  | { kind: 'guest'; sessionId: string }
  | { kind: 'user';  sessionId: string; userId: string; roles: Role[] }   // Phase 1
```

A NestJS guard resolves the actor from the request. In Phase 0 it reads an httpOnly `gs_session` cookie, minting a UUID if absent, and always returns `kind: 'guest'`. In Phase 1 it additionally reads the auth cookie and returns `kind: 'user'` when valid.

`cart`, `order`, `review` and `notify_request` all carry **both** `session_id` and a nullable `user_id` from the very first migration. Resolution is: match on `user_id` when present, otherwise `session_id`.

Phase 1 then needs exactly three new things and no schema change to existing tables:

1. `user` and `session` tables
2. Actor resolution extended in one guard
3. A `adoptGuestCart(sessionId, userId)` call on login that merges the guest cart into the user's

### 11.2 Admin authorisation

Admin endpoints go through an `AdminGuard` from day one. Phase 0's implementation compares an `x-admin-key` header against an environment variable. Phase 1 replaces the *body* of that guard with a role check. Every route decorator, every UI conditional, every test stays as written.

Never leave admin routes open "because auth comes later" — the guard shape is the point, not the strength of the secret.

### 11.3 Payment provider

```ts
interface PaymentProvider {
  createCharge(order: Order): Promise<{ providerRef: string; instructions: PaymentInstructions; expiresAt: Date }>;
  parseCallback(payload: unknown, signature?: string): Promise<PaymentEvent>;
  refund(payment: Payment, amount: number): Promise<PaymentEvent>;
}
```

`MockPaymentProvider` generates a fake VA number and expiry. `MidtransPaymentProvider` (or Xendit — decide in Phase 1) implements the same interface. The order service, the state machine, the emails and the admin screens all consume `PaymentEvent` and are entirely unaware which provider produced it. The Phase 0 dev-simulate endpoint constructs the same `PaymentEvent` a real webhook would.

Choose the provider by environment variable, not by branching in business logic.

### 11.4 Sequencing

```
Phase 0  ──▶  1. Schema + seed data (grades, scales, series, regions, ~60 products)
              2. Catalogue API + listing/filter/search
              3. Product detail + build requirements
              4. Cart
              5. Checkout + order creation + stock reservation
              6. Mock payment + order state machine + scheduled expiry
              7. Admin
              8. Reviews, vouchers, notifications

Phase 1  ──▶  9. Auth: register, login, sessions, guest-cart adoption, account area
             10. Real payment provider + webhook verification
             11. Role-based admin guard
```

---

## 12. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | LCP under 2.5s on 4G for home and listing pages. Listing API p95 under 300ms with 5,000 products. Images served as WebP/AVIF via `next/image` |
| **Rendering** | Catalogue pages server-rendered or ISR for SEO and first-load speed. Cart and checkout client-rendered |
| **Accessibility** | WCAG 2.1 AA: keyboard operable throughout, visible focus rings, 4.5:1 text contrast, labelled form controls, `prefers-reduced-motion` respected |
| **Responsive** | Mobile-first. Breakpoints at 640 / 768 / 1024 / 1280 / 1536 |
| **Data integrity** | Money as integer minor units. Never floats. All multi-table writes in transactions |
| **Validation** | Zod (or class-validator) on every endpoint. Never trust a client-supplied price |
| **Security** | Rate limiting on search, cart and order creation. Parameterised queries only. httpOnly SameSite cookies. CSP headers. Secrets in env, never committed |
| **Observability** | Structured JSON logs with a request ID. Health endpoint. Order and payment events queryable |
| **Testing** | Unit tests on pricing, stock reservation and both state machines. Integration tests on the full checkout path. E2E on browse → cart → order |
| **SEO** | Clean slugs, canonical tags, sitemap, JSON-LD on products |

---

## 13. Definition of done — MVP

Phase 0 is complete when all of the following pass on a seeded database:

1. A visitor can browse all kits, filter to `MG` + `Universal Century` + in stock, sort by price, and share the resulting URL so it reproduces the same view.
2. Searching `barbatos` returns the Barbatos kits; searching `barbatso` still returns them.
3. A kit page lists its required tools; "Add selected" puts a nipper and a panel liner in the cart in one action.
4. A cart survives a browser restart, and deselecting a line removes it from the total.
5. Checkout produces an order with a `GS-` number; double-clicking submit produces one order, not two.
6. Reserved stock reduces availability immediately; cancelling the order returns it.
7. Marking the order paid in admin advances it to `PAID` and records an `order_event`.
8. An unpaid order past its expiry auto-cancels and releases its stock.
9. Admin can create a product with variants and images and see it live on the storefront.
10. Every admin route returns 401 without the admin key.
11. Lighthouse: performance ≥ 85 mobile, accessibility ≥ 95, on listing and product pages.

---

## 14. Open questions

| # | Question | Needed by |
|---|---|---|
| Q1 | Preorders — Bandai kits are heavily preordered. Deposit-based preorder or simple "available on release date"? | Before schema freeze |
| Q2 | Are second-hand or built kits ever sold? Would need a condition attribute and single-quantity handling | Before schema freeze |
| Q3 | Which payment provider for Phase 1 — Midtrans, Xendit, or Duitku? Affects the callback signature work only | Phase 1 |
| Q4 | Is `id-ID` localisation in scope at all, or English-only permanently? | Before copy is written |
| Q5 | Real courier rates via Biteship/RajaOngkir, or flat tiers permanently? | Phase 1 |
| Q6 | Does the store need a physical-inventory concept (locations, stock takes) or is a single pool enough? | v2 |