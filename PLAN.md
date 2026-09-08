# GunSnip — phased build plan

## Context

`PRD.md` and `DESIGN.md` were written but nothing has been built against them. The repo is two untouched
scaffolds: `create-next-app` boilerplate in [client/](client/) (Next.js 16, no Tailwind, still rendering
the Vercel splash page) and a `nest new` skeleton in [server/](server/) whose only real addition is a
TypeORM Postgres connection with `synchronize: true`.

The goal is a working Phase 0 store per the PRD — browse → filter → search → evaluate → cart → checkout →
order placed → order tracked, plus an operable back office — running on anonymous guest sessions, with
every auth and payment seam (PRD §11) already in place so PRD Phase 1 is additive rather than a migration.

Build is sequenced into 11 phases. **Each phase ends with a verification run and a stop for review**
before the next begins.

---

## Decisions locked

| Decision | Choice | Consequence |
|---|---|---|
| ORM | **Prisma** (`@prisma/client` 7.x) | Delete [server/src/database/database.module.ts](server/src/database/database.module.ts), drop `typeorm`/`@nestjs/typeorm`. `synchronize` is replaced by real migrations. |
| Layout | **Keep `client/` + `server/`** | Add a root `package.json` with npm workspaces and `packages/shared`. No file moves. |
| Scope | **Must + Should** | Deferred: `FR-SRCH-08` search_log, `FR-ADM-13` CSV import, `FR-ADM-14` sales CSV, `FR-NOTIF-03` back-in-stock, `FR-CART-08` move-to-Stash. |
| Cadence | **Checkpoint every phase** | I verify and report, then wait. |

**`CLAUDE.md` amendments** (made in Phase 0, since it's the architecture contract and must stay true):
paths `apps/web` → `client`, `GunSnip/server` → `server`; add `packages/shared`; fix the `design.md`
reference to `DESIGN.md`.

**Runtime facts that shape the code** — Next.js 16, so: `params`/`searchParams`/`cookies()`/`headers()`
are all Promises (use the generated `PageProps<'/route'>` helpers via `next typegen`); `middleware.ts` is
now `proxy.ts`; Turbopack is the default bundler; `next lint` is removed.

---

## Foundation architecture

### Workspace

```
package.json            npm workspaces: client, server, packages/shared
packages/shared/        PG enums mirrored as TS union types — single source (CLAUDE.md Conventions)
                        Grade, Scale, Difficulty, DecalType, ToolSubcategory, ProductType,
                        ProductStatus, Necessity, OrderStatus, PaymentStatus, VoucherType,
                        ReviewStatus, Role + the `Actor` union
```

### Server module map (`server/src`)

```
common/    guards: ActorGuard, AdminGuard · decorators: @CurrentActor()
           filters: DomainExceptionFilter (the ONLY domain→HTTP mapping)
           interceptors: request-id + structured JSON logging
           errors/   InsufficientStockError, IllegalTransitionError, VoucherRejectedError, …
config/    env.schema.ts (Zod, validated at boot, fail fast) — the only place reading process.env
prisma/    PrismaService, schema.prisma, migrations/, seed/
modules/   catalog · search · cart · orders · payments · inventory · shipping
           vouchers · reviews · notifications · admin · dev
```

Layering is enforced as CLAUDE.md states: controllers parse/delegate (~10 lines), services hold rules and
throw domain errors, repositories are the only files importing `PrismaService`.

### Client structure (`client/src`)

```
app/(storefront)/  app/(admin)/  app/api/   BFF route handlers only
proxy.ts                                     mints the gs_session cookie
features/<slice>/  components/ hooks/ api.ts schema.ts
components/ui/                               shared primitives, cn(), no business logic
lib/                                         api-client, formatters, constants
styles/tokens.css                            DESIGN.md §2 as Tailwind v4 @theme
```

### The three deferred seams (PRD §11 — built in Phase 0, never revisited)

1. **Identity.** `Actor` union lives in `packages/shared`. `ActorGuard` resolves it from the `gs_session`
   httpOnly cookie and always returns `kind: 'guest'`; `@CurrentActor()` injects it. No service signature
   ever takes a `userId`. Every one of `cart`, `order`, `review`, `notify_request` carries `session_id`
   **and** a nullable `user_id` from the first migration.
   *Cookie minting lives in `client/proxy.ts`* — a Server Component can't set cookies, and `proxy.ts` runs
   before every request. `ActorGuard` mints as a fallback for direct API calls.
2. **Admin.** `@UseGuards(AdminGuard)` on every admin route from day one; Phase 0 body compares
   `x-admin-key` against `ADMIN_KEY`. Phase 1 swaps the body only.
3. **Payment.** `PaymentProvider` interface + `MockPaymentProvider`, selected by `PAYMENT_PROVIDER` env
   var via a Nest custom provider — never by branching in business logic. Same shape for `Mailer`
   (console transport).

### New dependencies (each justified, per CLAUDE.md)

`@prisma/client`+`prisma` (ORM per contract) · `zod` (env schema; already the contract's choice) ·
`class-validator`+`class-transformer` (DTO validation per contract) · `cookie-parser` (session cookie) ·
`@nestjs/schedule` (FR-PAY-06 expiry job) · `@nestjs/throttler` (§12 rate limiting) ·
`tailwindcss@4`+`@tailwindcss/postcss` (DESIGN.md §7) · `clsx`+`tailwind-merge` (`cn()`) ·
a small set of Radix primitives via shadcn/ui, restyled (DESIGN.md §7 sanctions this) ·
`@playwright/test` (§12 E2E). Nothing else without asking.

---

## Phases

### Phase 0 — Platform foundations
Root workspace + `packages/shared` enums. Swap TypeORM → Prisma (`PrismaService`, `PrismaModule`, empty
initial migration, `synchronize` gone). `config/` with Zod env schema failing fast at boot. Global
`DomainExceptionFilter`, request-id logging interceptor, `/api/v1` prefix, throttler, cookie-parser,
`GET /health`. All three seams above. Amend `CLAUDE.md` paths.
**Exit:** `npm run start:dev` boots against Postgres; `/api/v1/health` returns 200; a request without
`x-admin-key` to a stub admin route returns 401 (DoD §13.10); boot fails loudly on a missing env var.

### Phase 1 — Design system & app shell
Tailwind v4 with DESIGN.md §2 tokens in `@theme` (frame/armor/accent/semantic, light + dark). IBM Plex
Sans Condensed / Sans / Mono self-hosted via `next/font/local`. Chamfer utility (`clip-path`), panel-line
borders, the corner-bracket `:focus-visible` reticle (§4.6), motion tokens honouring
`prefers-reduced-motion`. `components/ui`: Button (4 variants, width-preserving loading state), Badge (6
per §4.3 with the two-per-card priority rule), Input, Select, Checkbox, Sheet, Dialog, Chip,
QuantityStepper, Price (tabular figures), StockPill, Skeleton, EmptyState, ErrorState. `lib/formatters.ts`
(`Rp 1.250.000` from integer minor units), `lib/cn.ts`, `lib/api-client.ts`. Header (two rows, click-not-
hover dropdowns, 200px scroll collapse), footer, mobile tab bar. Boilerplate page/CSS deleted.
**Exit:** a tokens/primitives gallery route renders every primitive in all four states (§4.5), light and
dark, keyboard-navigable with visible reticles; no hex literals in JSX.

### Phase 2 — Schema & seed
Full `schema.prisma` per PRD §9 — all money `Int` in minor units, PG enums, `session_id` + nullable
`user_id` on the four tables, `attributes` JSONB, `customer_snapshot` JSONB, `idempotency_key` table.
Raw-SQL migration for the parts Prisma can't express: `pg_trgm`, the `tsvector` column + trigger, GIN on
tsvector and `attributes`, and every index named in §9. Seed: grades, scales, series, brands, categories,
Indonesian `address_region` (38 provinces, major cities, districts for the top cities), search synonyms
(FR-SRCH-04), ~60 products across kits and tools with variants, images, per-grade `product_requirement`
defaults, vouchers, bundles. Product imagery is locally generated deterministic SVG placeholders with
stored `blurDataUrl` — no external image host.
**Exit:** `npx prisma migrate reset` rebuilds and reseeds clean; a raw SQL check confirms the GIN indexes
exist and `SELECT … @@ to_tsquery('barbatos')` returns rows.

### Phase 3 — Catalogue API + home + listing
`GET /products` (all filters, sort, cursor pagination with a hard limit cap), `/products/:slug`,
`/categories`, `/facets` (counts, including zero-count options). Home page (FR-CAT-01): static hero,
grade shortcuts, new arrivals, back in stock, tools rail, first-build entry. Category listing
(FR-CAT-02…10): filter rail with counts and disabled-not-hidden zero options, applied-filter chips,
sort, load-more + numbered pages, mobile filter/sort bottom sheets with a live "Show N kits" count.
**URL query string is the only source of truth for filters/sort/page** (FR-CAT-07) — no mirroring into
state. Product card exactly per DESIGN.md §3.4.
**Exit:** DoD §13.1 — filter to MG + UC + in stock, sort by price, paste the URL in a new tab, identical
view. All four states reachable. Listing API p95 < 300ms on the seed set.

### Phase 4 — Search
Postgres FTS across name/unit_name/unit_code/series/brand/tags with the synonym table applied, `pg_trgm`
similarity fallback when FTS returns nothing, `GET /search/suggest` (2-char threshold, 250ms debounce,
thumbnails + prices + category suggestions). Results page reuses the Phase 3 filter/sort rail verbatim.
Zero-result page offers a spelling correction, related categories and popular products.
**Exit:** DoD §13.2 — `barbatos` returns the Barbatos kits and so does `barbatso`.

### Phase 5 — Product detail + build requirements
`/products/:slug/requirements`, `/products/:slug/related`. PDP per DESIGN.md §3.5: keyboard-navigable
swipeable gallery, kit spec block, variant selector with disabled-not-missing combinations, stock state
with a real number, bounded quantity stepper, add-to-cart with the signature 220ms arc, Buy now, tabs,
related rails, mobile sticky purchase bar, Product/Offer/AggregateRating JSON-LD. The
**"What you'll need to build this"** block (FR-PDP-08) — all unticked, total starts at Rp 0, in-cart
items render as "Already in cart", one "Add selected" action. `POST /notify-requests` for OOS pages.
**Exit:** DoD §13.3 — one action puts a nipper and a panel liner in the cart from a kit page.

### Phase 6 — Cart
Cart API against the actor (`GET /cart`, `POST/PATCH/DELETE /cart/items`, voucher apply/remove).
Revalidation on load surfaces price and stock changes as explicit inline notices, never silent
(FR-CART-04). Per-line checkbox selection driving the totals (FR-CART-03). Sticky summary, voucher entry
with a specific rejection reason, empty state, mini-cart drawer. **Every total recomputed server-side
from the DB; no client price is ever trusted.**
**Exit:** DoD §13.4 — cart survives a browser restart, deselecting a line drops it from the total.

### Phase 7 — Checkout, orders, stock reservation
`GET /shipping/regions`, `POST /shipping/quote` (flat courier tiers by zone). `POST /orders` — one
transaction doing `SELECT … FOR UPDATE` on variant rows in id order, stock reservation, order creation,
`GS-YYMMDD-XXXX` numbering, item snapshots, `order_event`, voucher redemption — keyed by
`Idempotency-Key`. Guest lookup by number + email, buyer cancel while `PENDING_PAYMENT`. Single-page
checkout per DESIGN.md §3.7 with the total visible at every scroll position, dependent province/city/
district selects, blur validation with focus-to-first-error, draft persisted client-side. Confirmation
page with the horizontal/vertical status timeline.
**Exit:** DoD §13.5 and §13.6 — double-clicking submit yields one order; reserved stock reduces
availability immediately and cancelling returns it. Integration test covers the whole path against a real
test database.

### Phase 8 — Payments, state machines, expiry
Explicit transition maps in their own files for both machines (PRD §8.1, §8.2) — an illegal transition
throws. `Payment` created with every order, pseudo-methods all resolving to `MockPaymentProvider` (fake VA
+ expiry), `payment_event` log shaped like a real gateway webhook, `POST /dev/payments/:id/simulate`
gated by env flag, scheduled expiry job that cancels the order and releases stock. Confirmation page shows
instructions and a countdown.
**Exit:** DoD §13.7 and §13.8 — marking paid advances the order and writes an `order_event`; an expired
unpaid order auto-cancels and releases its stock. Unit tests on both machines.

### Phase 9 — Admin
`/admin/*` behind the guard that has existed since Phase 0. Dashboard, type-aware product CRUD with
draft/published, variant management, image upload with reordering and a primary, stock adjustment with a
required reason writing `inventory_movement`, build-requirement editor, order list and detail (advance
status, mark paid, tracking, cancel with reason, notes), reference-data management, voucher CRUD with
usage counter, review moderation queue, banner curation. Admin controllers call the same services the
storefront does.
**Exit:** DoD §13.9 — create a product with variants and images in admin, see it live on the storefront.

### Phase 10 — Reviews, vouchers, notifications, editorial, hardening
Tokenised review invites on delivery, verified-purchase badge, build-specific kit fields, histogram and
filters, moderation wiring. Voucher constraint engine completed (min spend, cap, window, usage limits,
scope; one per order). `Mailer` interface + console transport and the four transactional emails. MDX
guides, bundles, promo banners. Then hardening: remaining unit tests (pricing, stock, voucher), Playwright
E2E, CSP headers, rate limits, sitemap/canonical/JSON-LD, accessibility pass, Lighthouse.
**Exit:** DoD §13.11 — Lighthouse performance ≥ 85 mobile and accessibility ≥ 95 on listing and product
pages, and every item in PRD §13 signed off.

---

## Verification

Per phase, before I report:

```bash
npm run -w server test          # vitest unit
npm run -w server test:e2e      # integration, against gunsnip_test
npm run -w server lint && npm run -w server build
npm run -w client lint && npm run -w client build
```

Plus: `npx prisma migrate reset` from Phase 2 on, the app actually driven in a browser for the phase's
exit criterion, and from Phase 10 `npx playwright test` and a Lighthouse run.

Database: the local Homebrew Postgres 18 already documented in [README.md](README.md); a second
`gunsnip_test` database is created in Phase 2 for integration tests.

Mandatory unit-test targets (CLAUDE.md): price calculation, stock reservation and release, both state
machines, voucher validation.

## Out of scope

PRD Phase 1 — registration/login, sessions, guest-cart adoption, account area, real payment gateway,
role-based admin. The seams are built; the implementations are not. Also the deferred Coulds listed under
Decisions, and PRD §14 open questions Q1/Q2 (preorder and second-hand) — I'll flag the schema points where
they'd land rather than guess.
