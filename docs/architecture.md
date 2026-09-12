# Architecture

How GunSnip is put together, and why. This document is the contract the code is written
against — if something here and the code disagree, one of them is a bug.

---

## The shape of it

```
┌──────────────────┐        ┌──────────────────┐        ┌──────────────┐
│  Next.js 16      │  HTTP  │  NestJS 12       │ Prisma │  PostgreSQL  │
│  storefront      │ ─────► │  REST API        │ ─────► │  16+         │
│  + back office   │        │  /api/v1         │        │              │
└──────────────────┘        └──────────────────┘        └──────────────┘
         │                            │
         └──────────┬─────────────────┘
                    │
          @gunsnip/shared — Postgres enums as TS union types, the Actor union
```

Three npm workspaces:

| Package | What it is |
|---|---|
| `client/` | Next.js App Router. Storefront and back office in one app, split by route group. |
| `server/` | NestJS REST API. Owns every business rule. |
| `packages/shared/` | Types both sides need. Compiled with `tsc` before either app builds. |

`@gunsnip/shared` exists so a Postgres enum has exactly one TypeScript spelling. Adding a
value to `OrderStatus` in the schema and forgetting it in the web app is a compile error rather
than a runtime surprise.

---

## Rules that do not bend

These are load-bearing. Most of the design follows from them.

**1. Money is an `int` in minor units (IDR).** Never a float, never a string. Formatting
happens at the render layer and nowhere else. There are no fractional rupiah in the schema, in
a DTO, or in a response.

**2. A client price is never trusted.** Cart and order totals are recomputed from the database
on every single call. The checkout does send an `expectedTotalIdr`, but it is a *check*: if the
recomputed total differs, the order is refused with `409 CART_CHANGED` rather than charging a
number the customer never saw.

**3. No `any`, `strict: true`.** A `@ts-ignore` needs a comment naming the reason.

**4. Validation at every boundary.** Zod on the Next side, class-validator DTOs on the Nest
side, with `whitelist` and `forbidNonWhitelisted` on — an unknown property is a `400`, not a
silently dropped field. Nothing untyped crosses the wire in either direction.

**5. Business logic lives in the service layer.** Not in a controller, not in a route handler,
not in a React component.

**6. Multi-table writes run in one transaction.** Reserving stock and creating an order is a
single atomic unit; so is cancelling and releasing that stock.

---

## Server layers

```
server/src/
  common/            guards, interceptors, filters, pipes, decorators, middleware
  config/            env schema + typed config, validated at boot
  prisma/            PrismaService
  generated/prisma/  generated client — gitignored, under src/ because the Prisma 7
                     generator emits TypeScript that must be inside the compiled tree
  modules/
    catalog/  cart/  orders/  payments/  inventory/  reviews/
    vouchers/  search/  shipping/  notifications/  admin/  dev/  health/
```

Each module is one bounded context with explicit `exports`. If two modules need each other,
the shared piece belongs in a third.

Within a module, four files with four jobs:

**Controller** — parse, validate, delegate, return. Around ten lines a handler. No Prisma, no
conditionals about domain state.

```ts
@Post()
async create(@Body() dto: CreateOrderDto, @CurrentActor() actor: Actor) {
  return this.orders.create(actor, dto);
}
```

The decorator is `@CurrentActor` rather than `@Actor` so it does not collide with the `Actor`
type it injects.

**Service** — the business rules. Depends on repositories and other services, never on Prisma
directly. Throws domain errors (`InsufficientStockError`), never `HttpException` — a service
has no idea HTTP exists.

**Repository** — the only place `PrismaService` is touched. One per aggregate. Returns domain
objects rather than raw Prisma rows where those would leak schema detail upward.

**Module** — wiring only.

### Cross-cutting pieces

**One exception filter.** `DomainExceptionFilter` is the single place a domain concept becomes
a status code. The mapping is a table, not a chain of `instanceof` checks scattered through
services. Every response — validation failure, domain conflict, unhandled crash — leaves in the
same envelope with a `requestId`.

**Explicit state machines.** Order status and payment status are transition maps in their own
files. An illegal transition throws. There is no `if (order.status === …)` anywhere in a
service, which is what stops the rules drifting apart across the handful of places that move an
order along.

**Cursor pagination with a hard cap** on every admin list. The customer-facing catalogue uses
page numbers instead, because "page 4 of 12" belongs in the URL.

**Config validated at boot.** `config/env.schema.ts` is a Zod schema; `validateEnv` reports
*every* problem at once and throws. `process.env` is never read outside `config/`. A malformed
environment stops the process at startup rather than surfacing as `undefined` in a fetch later.

**Scheduled jobs** live in the module they belong to and are guarded against double-running.
Payment expiry is the one that matters: it sweeps `PENDING_PAYMENT` orders past their window,
releasing the stock they were holding.

**Idempotency.** `POST /orders` requires an `Idempotency-Key`. The key is stored; a repeat
returns the original order rather than placing a second one. A double-submitted checkout form
is not a second order.

---

## Client structure

App Router, Next.js 16, **Server Components by default**. `'use client'` only for genuine
interactivity, pushed as far down the tree as it will go.

```
client/src/
  proxy.ts                   mints gs_session, gates /admin
  app/
    (storefront)/            public routes
    (admin)/                 back office
  features/
    catalog/  cart/  checkout/  orders/  reviews/  admin/
      components/            feature-local UI
      hooks/
      api.ts                 typed calls to the API
      schema.ts              Zod schemas + inferred types
  components/ui/             shared primitives — Button, Badge, Input, Sheet
  components/layout/         header, footer, mobile tab bar
  fonts/                     self-hosted IBM Plex
  lib/                       api-client, api-server, admin-api, formatters, cn, constants
  styles/                    tokens.css, globals.css
```

Feature folders are vertical slices. A component in `features/cart` must not import from
`features/catalog/components`; if both need the same thing, it gets lifted to `components/ui`.

### Client rules

- **No fetch calls in components.** They live in `features/<x>/api.ts`, typed by a Zod schema
  that parses the response. A shape change in the API surfaces as a parse error at the seam,
  not as `undefined` three components deep.
- Server Components fetch directly; Client Components use a hook wrapping the api module.
- **No `useEffect` for data fetching.** If you are writing one, the fetch belongs on the server.
- **The URL is the source of truth** for filters, sort and pagination — never mirrored into
  local state. Filter, sort, copy the address into a new tab, get the identical page.
- Mutations use Server Actions *or* the api module — one choice per feature, consistently. The
  storefront uses the api module; the back office uses Server Actions, because the admin key is
  in an `httpOnly` cookie only server code can read, and every admin write invalidates a screen
  someone is looking at.
- Every list or grid ships all four states: loading skeleton, empty, error, loaded.
- Components take data as props and render. More than about two `useState` and a `useEffect`
  means a hook wants extracting.

### Next 16 specifics

Worth knowing before reading the routing code: `params`, `searchParams`, `cookies()` and
`headers()` are all Promises (the generated `PageProps<'/route'>` helpers type them);
`middleware.ts` is now `proxy.ts` and its export must be named `proxy`; Turbopack is the
default bundler; `next lint` no longer exists, so linting is plain `eslint`.

### Styling

Tailwind v4 with the palette defined as tokens in `styles/tokens.css`. Tailwind's default
colour palette is **deleted** in `@theme`, so `bg-red-500` does not exist — a stray hex value
in JSX fails the build rather than waiting for review to catch it.

`client/scripts/check-contrast.mjs` runs as part of `npm run -w client lint`. It reads
`tokens.css` directly, so it cannot drift from what ships: a token change that drops any pair
below the contrast floor fails the build.

---

## Deferred seams

Accounts and a real payment gateway are not built. Three abstractions exist anyway, so adding
them is a small change rather than a refactor.

### 1. Identity — there is no `userId` in any signature

```ts
type Actor =
  | { kind: 'guest'; sessionId: string }
  | { kind: 'user'; sessionId: string; userId: string; roles: Role[] };
```

Every service method touching a cart, order or review takes an `Actor`. A guard resolves it
from the `gs_session` cookie, minting a UUID when absent. The `cart`, `order`, `review` and
`notify_request` tables all carry `session_id` **and** a nullable `user_id` from the very first
migration.

That nullable column is the whole point: adopting a guest cart at sign-in is an update, not a
migration. Nothing about the service layer changes when the `user` arm becomes reachable.

### 2. Admin — the guard is real, only its body is temporary

`@UseGuards(AdminGuard)` sits on every admin route. Today it compares an `x-admin-key` header
against `ADMIN_KEY` in constant time. Adding roles replaces the *body* of `canActivate` with a
check on `actor.roles` — every decorator, every test and every admin screen stays exactly as
written.

Admin routes were never left open "because auth comes later".

### 3. Payments — a provider interface

```ts
interface PaymentProvider {
  createCharge(order: Order): Promise<ChargeResult>;
  parseCallback(payload: unknown, signature?: string): Promise<PaymentEvent>;
  refund(payment: Payment, amount: number): Promise<PaymentEvent>;
}
```

`MockPaymentProvider` today, a real gateway later, **selected by environment variable and never
by branching in business logic**. The order service, the state machine, the mail and the admin
screens all consume `PaymentEvent` and cannot tell which provider produced it.

The dev-only simulate endpoint constructs the same `PaymentEvent` a real webhook would and
pushes it through `parseCallback`, so the code exercised in development is the code a gateway
will drive in production.

`Mailer` follows the same pattern — a console transport prints every message in full, which is
the only way to check that transactional mail actually *reads* sensibly before there is a
provider to send it.

---

## Data model

Some forty tables. The parts worth knowing:

**Catalogue.** `Product` carries denormalised aggregates — rating average, review count, sold
count, price range across variants — because sorting a listing by rating cannot mean a
correlated subquery per row. `ProductVariant` holds SKU, price and stock. `ProductImage`,
`ProductRequirement` (what a kit needs on the bench) and `GradeToolDefault` (the same answer at
the grade level, copied down per product and then editable) hang off it.

**Reference data.** `Brand`, `Grade`, `Scale`, `Series`, `Category`, `AddressRegion`. Editable
in the back office rather than hard-coded, which is why deleting one that is still in use is
refused rather than allowed to orphan rows.

**Commerce.** `Cart` / `CartItem` keyed on session. `Order` / `OrderItem` / `OrderEvent`, where
the event rows are the audit trail of every status change and who caused it. `Payment` /
`PaymentEvent` mirror that on the payment side. `Shipment`, `ShippingRate`, `IdempotencyKey`.

**Inventory.** `InventoryMovement` is an immutable ledger. Stock is a number you can read, but
every change to it has a row explaining itself: `RESTOCK`, `CORRECTION`, `DAMAGE`, `LOSS`,
`RETURN`, `ORDER_FULFILLED`.

**Promotions.** `Voucher` with `VoucherRedemption` enforcing per-session and global limits.

**Reviews.** `Review`, `ReviewPhoto`, and `ReviewInvite` — the tokenised link that authorises
one review of one purchased product. The token decides what is being reviewed; a submission
cannot name a product it likes better.

### Search

Full-text search is a `tsvector` column on `product`, maintained by a **trigger** rather than a
generated column, because it folds in brand and series names from other tables — renaming a
brand reindexes the affected products. `pg_trgm` backs a fuzzy fallback so a misspelled kit
name still finds the kit.

None of that is expressible in `schema.prisma`, so it lives in
[the search migration](../server/prisma/migrations/20260908102400_search_infrastructure/migration.sql)
as raw SQL.

### Prisma 7 notes

The generated client is written to `server/src/generated/prisma` and is **not committed** — it
sits under `src/` because the Prisma 7 generator emits TypeScript, which has to be inside the
compiled source tree. Run `npm run db:generate -w server` after any schema change.

Prisma 7 also keeps the connection URL out of the schema; it is in
[`server/prisma7.config.ts`](../server/prisma7.config.ts).

---

## Conventions

| Thing | Convention |
|---|---|
| Files | `kebab-case.ts`, React components `PascalCase.tsx` |
| Nest classes | `CatalogService`, `CatalogController`, `CreateOrderDto` |
| Booleans | `isX` / `hasX` / `canX` |
| Async | Always `async`/`await`; no raw `.then()` chains |
| Exports | Named. Default only for Next.js pages and layouts |
| Imports | Absolute via `@/`; no `../../..` |
| Enums | Postgres enums mirrored as TS unions, single source in `@gunsnip/shared` |
| Dates | UTC in the database, formatted at render, `Asia/Jakarta` for display |
| Commits | Conventional Commits — `feat(cart): per-line selection` |

One job per file. A file doing two things wants splitting.

---

## Testing

Unit tests are mandatory on the four places money and inventory break: price calculation, stock
reservation and release, both state machines, and voucher validation.

Integration tests run the full checkout path against a real database — `gunsnip_test`, rebuilt
from migrations and seed before every run. The suite refuses to start if its URL names a
database whose name does not end in `_test`, which is what stops a mistyped variable wiping
development data.

The e2e suite boots the app through the same `configureApp` that `main.ts` uses, so tests
exercise the real prefix, parsing and validation. A test against a differently-configured app
proves very little.

What is deliberately not tested: framework wiring, and anything mocked so thoroughly that the
test only asserts the mock was called.
