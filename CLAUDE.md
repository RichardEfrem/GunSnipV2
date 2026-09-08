# CLAUDE.md — GunSnip

Gunpla e-commerce. **Next.js** storefront + admin · **NestJS** API · **PostgreSQL** + Prisma.

Read `PRD.md` for requirements and `DESIGN.md` for UI tokens. `PLAN.md` is the phased build order. This file is the architecture contract. Follow it or say why not before writing code.

## Workspace

npm workspaces. Three packages:

```
client/            Next.js storefront + admin
server/            NestJS API
packages/shared/   Postgres enums as TS union types, and the Actor union — imported by both
```

`@gunsnip/shared` compiles with `tsc` before either app builds; `npm run build` at the root does this in order.

---

## Non-negotiables

1. **Money is `int` in minor units (IDR).** Never float, never string. Format only at the render layer.
2. **Never trust a client price.** Cart and order totals are computed server-side from the DB, every time.
3. **No `any`.** No `@ts-ignore` without a comment naming the reason. `strict: true`.
4. **Validate at every boundary.** Zod on the Next.js side, class-validator DTOs on the Nest side. Nothing untyped crosses the wire.
5. **Business logic lives in the service layer, never in a controller, route handler, or React component.**
6. **Auth-ready from day one.** See "Deferred seams" below. Never write `userId` into a service signature.
7. **Multi-table writes run in a transaction.** Stock reservation + order creation is one atomic unit.
8. One thing per file. If a file does two jobs, split it.

---

## NestJS — `server/`

### Structure

```
prisma/              schema.prisma + migrations (Prisma 7 CLI territory)
prisma7.config.ts    connection URL for the CLI — Prisma 7 keeps it out of the schema
src/
  common/            guards, interceptors, filters, pipes, decorators, middleware
  config/            env schema + typed config (validate at boot, fail fast)
  prisma/            PrismaService
  generated/prisma/  generated client — gitignored, lives under src/ because the Prisma 7
                     generator emits TypeScript that has to be inside the compiled tree
  modules/
    catalog/
      catalog.module.ts
      catalog.controller.ts      HTTP only
      catalog.service.ts         business logic
      catalog.repository.ts      all Prisma access
      dto/                       request DTOs (class-validator)
      entities/                  response shapes
    cart/  orders/  payments/  inventory/  reviews/  vouchers/  admin/
```

### Layer rules

**Controller** — parse, validate, delegate, return. Max ~10 lines per handler. No Prisma. No conditionals about domain state.

```ts
@Post()
async create(@Body() dto: CreateOrderDto, @CurrentActor() actor: Actor) {
  return this.orders.create(actor, dto);
}
```

The decorator is `@CurrentActor`, not `@Actor`, so it does not collide with the `Actor` type it injects.

**Service** — owns the business rules. Depends on repositories and other services, never on Prisma directly. Throws domain exceptions (`InsufficientStockError`), not `HttpException`.

**Repository** — the only place `PrismaService` is touched. Returns domain objects, not raw Prisma types where they leak schema detail. One repository per aggregate.

**Module** — one per bounded context. Explicit `exports`. If two modules need each other, the shared piece belongs in a third.

### Other rules

- Domain errors map to HTTP in a single global `ExceptionFilter`. Services never know about status codes.
- Use `@nestjs/config` with a Zod-validated schema. Never `process.env` outside `config/`.
- State machines (order, payment) are explicit transition maps in their own file. An illegal transition throws. No `if (order.status === ...)` scattered through services.
- Every list endpoint is cursor-paginated with a hard `limit` cap.
- Scheduled jobs (payment expiry) live in the module they belong to, guarded so they don't double-run.
- `POST /orders` requires an `Idempotency-Key` header. Store it; a repeat returns the original order.

---

## Next.js — `client/`

App Router, **Next.js 16**. **Server Components by default.** `'use client'` only for interactivity, and push it as far down the tree as possible.

Next 16 specifics that bite: `params`, `searchParams`, `cookies()` and `headers()` are all Promises (use the generated `PageProps<'/route'>` helpers); `middleware.ts` is now `proxy.ts`; Turbopack is the default bundler; `next lint` is gone.

### Structure

```
src/
  proxy.ts                   mints the gs_session cookie (a Server Component cannot set one)
  app/
    (storefront)/            layout, page routes
    (admin)/
    api/                     BFF routes only — never business logic
  features/
    catalog/
      components/            feature-local UI
      hooks/                 use-product-filters, etc.
      api.ts                 typed calls to the Nest API
      schema.ts              Zod schemas + inferred types
    cart/  checkout/  orders/  reviews/
  components/ui/             shared primitives — Button, Badge, Input, Sheet
  lib/                       api-client, formatters, cn, constants
  styles/                    tokens.css
```

Feature folders are vertical slices. A component in `features/cart` must not import from `features/catalog/components` — lift the shared piece to `components/ui`.

### Rules

- **No fetch calls in components.** They go in `features/<x>/api.ts`, typed by a Zod schema that parses the response.
- Server Components fetch directly. Client Components use a hook that wraps the api module.
- Mutations use Server Actions or the api module — pick one per feature and stay consistent.
- **URL is the source of truth for filters, sort and pagination** (PRD FR-CAT-07). Never mirror it into local state.
- No `useEffect` for data fetching. If you're writing one, the fetch belongs on the server.
- Components receive data as props and render. If a component has more than ~2 `useState` and a `useEffect`, extract a hook.
- Every list/grid component ships all four states: loading skeleton, empty, error, loaded. Not optional (DESIGN.md §4.5).
- Styling is Tailwind + the tokens in `DESIGN.md`. No arbitrary hex values in JSX — use the token. No inline styles except computed values.
- `components/ui` primitives take a `className` and merge it with `cn()`. They never contain business logic.

---

## Deferred seams

Auth and real payments come last (PRD §11). These three abstractions must exist **now** so Phase 1 is a small change.

**1. Identity — never `userId`**

```ts
type Actor =
  | { kind: 'guest'; sessionId: string }
  | { kind: 'user'; sessionId: string; userId: string; roles: Role[] };
```

Every service method that touches a cart, order or review takes an `Actor`. A guard resolves it from the `gs_session` cookie, minting a UUID when absent. `cart`, `order`, `review`, `notify_request` all carry `session_id` **and** a nullable `user_id` from the first migration.

**2. Admin — the guard exists, only its body is temporary**

`@UseGuards(AdminGuard)` on every admin route from day one. Phase 0 compares an `x-admin-key` header. Phase 1 replaces the guard body with a role check and nothing else changes. Never leave admin routes open "because auth comes later".

**3. Payment — provider interface**

```ts
interface PaymentProvider {
  createCharge(order: Order): Promise<ChargeResult>;
  parseCallback(payload: unknown, signature?: string): Promise<PaymentEvent>;
  refund(payment: Payment, amount: number): Promise<PaymentEvent>;
}
```

`MockPaymentProvider` now, real gateway later. Selected by env var, never by branching in business logic. The order service, state machine, emails and admin screens consume `PaymentEvent` and are unaware which provider produced it. The dev-only simulate endpoint constructs the same `PaymentEvent` a real webhook would.

Same pattern for `Mailer` — console transport in Phase 0.

---

## Conventions

| Thing | Convention |
|---|---|
| Files | `kebab-case.ts` · React components `PascalCase.tsx` |
| Nest classes | `CatalogService`, `CatalogController`, `CreateOrderDto` |
| Booleans | `isX` / `hasX` / `canX` |
| Async | Always `async/await`. No raw `.then()` chains |
| Exports | Named exports. Default only for Next.js pages and layouts |
| Imports | Absolute via `@/`. No `../../..` |
| Enums | Postgres enums mirrored as TS union types, single source in a shared package |
| Dates | UTC in the DB, formatted at render, `Asia/Jakarta` for display |

**Commits:** Conventional Commits — `feat(cart): per-line selection`.

---

## Testing

- Unit tests are mandatory on: price calculation, stock reservation and release, both state machines, voucher validation. These are where money and inventory break.
- Integration test the full checkout path against a real test database.
- E2E: browse → filter → add to cart → checkout → order placed.
- Don't test framework wiring or mock everything into meaninglessness. Test behaviour.

---

## When writing code here

- Read the relevant PRD section before implementing a feature. Requirement IDs (`FR-CART-03`) are the spec.
- Prefer boring and obvious over clever. This is a portfolio project — it will be read by people judging the code.
- When a rule in this file conflicts with what you're about to do, say so and explain, rather than quietly doing it your way.
- Don't add dependencies without a reason that survives being asked "why not standard library".