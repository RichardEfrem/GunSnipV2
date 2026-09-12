# GunSnip

Gunpla e-commerce — model kits and the tools to build them, as one connected catalogue.

Next.js storefront and admin · NestJS REST API · PostgreSQL with Prisma.

The premise: most hobby shops sell you a Master Grade kit and leave you to find out on your own
that it needs a nipper, a hobby knife and a panel liner. GunSnip models that relationship as
data — every kit knows what it needs on the bench, and says so on the product page.

---

## Documentation

| | |
|---|---|
| [**docs/walkthrough.md**](docs/walkthrough.md) | Fifteen minutes through every feature on seeded data. **Start here.** |
| [docs/api.md](docs/api.md) | Every endpoint, with parameters, auth and error contract |
| [docs/admin-guide.md](docs/admin-guide.md) | Operating the back office |
| [docs/architecture.md](docs/architecture.md) | Layers, deferred seams, data model, conventions |

---

## What is built

**Storefront** — a landing page assembled from editorial blocks; a category tree with faceted
filtering, sorting and pagination held entirely in the URL; full-text search with a fuzzy
fallback for misspellings; product pages carrying variants, reviews, related kits and the tool
requirements for the build; purchasable bundles.

**Cart and checkout** — per-line selection, so the cart is a saved list rather than a
commitment; server-computed totals on every call; vouchers with specific rejection reasons;
Indonesian province → city → district addressing with tiered shipping; guest order tracking by
number and email.

**Orders and payments** — stock reserved and the order created in one transaction; idempotent
placement; explicit order and payment state machines; a mock payment provider behind the same
interface a real gateway will implement; scheduled expiry that releases held stock.

**Back office** — dashboard, product and variant editing with image upload, an immutable
inventory ledger, order fulfilment, voucher management, review moderation, banners and
reference data.

**Reviews** — tokenised invitations minted on delivery, so only someone who bought the kit can
review it; build time, experienced difficulty and tools used alongside the rating; moderation
queue with shop replies.

**Notifications** — transactional mail on every order event: placement, payment, each
fulfilment step, and the review invitations minted on delivery. A console transport prints each
message in full during development. Back-in-stock interest is captured on out-of-stock
variants; sending that particular mail on restock is not wired up yet.

### What is deliberately not built

Customer accounts and a real payment gateway. Both have their seams in place — see
[Deferred seams](docs/architecture.md#deferred-seams) — so adding them is a small change rather
than a refactor. Nothing in the service layer takes a `userId`; it takes an `Actor` whose
signed-in arm is written and simply not yet reachable.

---

## Layout

npm workspaces:

```
client/            Next.js storefront + admin
server/            NestJS API
packages/shared/   Postgres enums as TS union types, and the Actor union
docs/              this documentation
```

---

## Setup

Requires Node 22+ and PostgreSQL 16+.

```bash
npm install                      # installs all three workspaces
npm run build:shared             # @gunsnip/shared must exist before either app builds
```

Create the database:

```bash
psql -d postgres -c "CREATE ROLE gunsnip LOGIN PASSWORD 'gunsnip' CREATEDB;"
psql -d postgres -c "CREATE DATABASE gunsnip OWNER gunsnip;"
psql -d postgres -c "CREATE DATABASE gunsnip_test OWNER gunsnip;"
```

`CREATEDB` is needed because `prisma migrate dev` creates a temporary shadow database to
detect drift. `gunsnip_test` is the integration-test database and is wiped by the e2e suite.

Configure the API and generate the Prisma client:

```bash
cp server/.env.example server/.env
# then set ADMIN_KEY — `openssl rand -hex 24` produces a usable one
npm run db:generate -w server
npm run db:migrate -w server     # apply the migrations
npm run db:seed -w server        # ~60 products, reference data, Indonesian regions
```

Configure the web app:

```bash
cp client/.env.example client/.env.local
```

Every variable in `server/.env` is validated at boot. A missing or malformed one stops the
process with a list of what is wrong, rather than failing later. The web app's own variables
are validated at module load, so a bad one fails the build rather than surfacing as an
undefined URL in a fetch.

---

## Running it

Two terminals:

```bash
npm run dev:api    # http://localhost:3001, API served under /api/v1
npm run dev:web    # http://localhost:3000
```

| | |
|---|---|
| Storefront | http://localhost:3000 |
| Back office | http://localhost:3000/admin |
| API | http://localhost:3001/api/v1 |
| Health check | http://localhost:3001/api/v1/health |

**Keep the API terminal visible.** There is no mail provider in development, so every
transactional message is printed there in full — order confirmations, shipping notices, and the
review invitation links you will need to write a review.

### Signing in to the back office

Go to http://localhost:3000/admin and enter the `ADMIN_KEY` from `server/.env`.

The key is checked against `GET /admin/health` and then stored in an `httpOnly` cookie that
only server code reads; it never reaches client JavaScript. Every admin route is guarded on the
API side as well, in constant time, so the browser gate is convenience rather than security.
Full detail in the [back-office guide](docs/admin-guide.md#getting-in).

### Driving the API directly

Cart, checkout and orders hang off the `gs_session` cookie, so use a cookie jar:

```bash
curl -c jar -b jar http://localhost:3001/api/v1/cart
```

---

## Storefront routes

| Route | |
|---|---|
| `/` | Landing page |
| `/<category>` | Category listing — `kits-mg`, `tools-nippers`, … |
| `/products/<slug>` | Product detail |
| `/bundles`, `/bundles/<slug>` | Bundles |
| `/search?q=` | Search results |
| `/cart` | Cart |
| `/checkout` | Checkout |
| `/orders` | Track an order — number plus email, no account |
| `/orders/<orderNumber>` | Order status and timeline |
| `/review/<token>` | Write a review, from an emailed invitation |
| `/design-system` | Every token, primitive and state in one page |

Category slugs are globally unique and namespaced, which is why they sit at the URL root
rather than under a `/c/` prefix.

## Admin routes

| Route | |
|---|---|
| `/admin` | Dashboard |
| `/admin/orders` | Fulfilment queue |
| `/admin/products` | Catalogue, `/new` to create |
| `/admin/vouchers` | Promotions |
| `/admin/reviews` | Moderation queue |
| `/admin/banners` | Landing page editorial |
| `/admin/reference` | Grades, scales, series, brands, categories |

---

## Try it

Seeded voucher codes, chosen to exercise both the happy path and each rejection:

| Code | |
|---|---|
| `WELCOME10` | 10% off over Rp 250.000, capped at Rp 100.000 |
| `FIRSTBUILD` | Rp 50.000 off over Rp 300.000 |
| `GRATISONGKIR` | Free shipping over Rp 500.000 |
| `MASTERGRADE20` | 20% off Master Grade only |
| `LEBARAN2025` | Rejected — expired |
| `FLASH50` | Rejected — fully claimed |
| `STAFFONLY` | Rejected — deactivated |

The [walkthrough](docs/walkthrough.md) runs the whole thing end to end: browse, filter, add to
cart, apply a voucher, check out, settle the payment, fulfil the order, restock a variant,
write a review and moderate it.

---

## Checks

```bash
npm run build             # shared, then server, then client
npm run lint
npm run test              # unit
npm run test:e2e          # integration, needs the database
```

The integration suite never touches the development database. It reads
[server/.env.test](server/.env.test), rebuilds `gunsnip_test` from the migrations and the seed
before every run, and refuses to start if that URL names a database not ending in `_test`.

Unit tests cover the four places money and inventory break: price calculation, stock
reservation and release, both state machines, and voucher validation.

`npm run -w client lint` also runs `scripts/check-contrast.mjs`, which reads `tokens.css` and
fails the build if a palette change drops any pair below the contrast floor.

---

## Database

Schema and migrations live in [server/prisma/](server/prisma/); Prisma 7 keeps the connection
URL in [server/prisma7.config.ts](server/prisma7.config.ts) rather than in the schema.

```bash
npm run db:migrate -w server     # create and apply a migration
npm run db:reset -w server       # drop, re-migrate, re-seed (prompts before destroying data)
npm run db:seed -w server        # re-seed in place; truncates first, so it is repeatable
npm run db:studio -w server
```

`db:reset` prompts for confirmation. Prisma 7 no longer seeds as part of `migrate reset`, so
the script chains `prisma db seed` after it; that also means flags cannot be passed through
with `--`, and a non-interactive rebuild should call the two commands directly.

The seed is deliberately a whole shop rather than a handful of rows — every grade, both
product types, multi- and single-variant products, and genuinely out-of-stock and low-stock
lines, because those are the states that get skipped when data is invented by hand. Product
imagery is generated locally as deterministic SVG placeholders into `client/public/media/`;
there is no external image host.

Full-text search is a `tsvector` column on `product`, maintained by a trigger rather than a
generated column because it folds in the brand and series names from other tables. Renaming
either reindexes the affected products. `pg_trgm` backs the fuzzy fallback, so a misspelling
still finds the kit. Both live in
[the search migration](server/prisma/migrations/20260908102400_search_infrastructure/migration.sql),
since none of it is expressible in `schema.prisma`.

The generated client is written to `server/src/generated/prisma` and is not committed — it
lives under `src/` because the Prisma 7 generator emits TypeScript, which has to be inside the
compiled source tree. Run `npm run db:generate -w server` after any schema change.

---

## Environment

`server/.env` — every variable validated at boot:

| Variable | Default | |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `3001` | |
| `CLIENT_ORIGIN` | `http://localhost:3000` | CORS origin; credentials are allowed so the session cookie survives |
| `DATABASE_URL` | — | Required |
| `SESSION_COOKIE_NAME` | `gs_session` | Must match the web app's constant |
| `SESSION_COOKIE_MAX_AGE_DAYS` | `365` | |
| `ADMIN_KEY` | — | Required, 16+ characters |
| `PAYMENT_PROVIDER` | `mock` | |
| `PAYMENT_EXPIRY_HOURS` | `24` | How long a payment window stays open |
| `MAILER_TRANSPORT` | `console` | |
| `MEDIA_DIR` | `../client/public/media/products` | Where uploads are written |
| `MEDIA_PUBLIC_PATH` | `/media/products` | The URL prefix they are served under |
| `ENABLE_DEV_ENDPOINTS` | `false` | Gates the payment simulate endpoint. Never true in production |
| `ORDER_RATE_LIMIT` | `10` | Orders per window, per caller |
| `ORDER_RATE_WINDOW_SECONDS` | `300` | |
| `TRUST_PROXY_HOPS` | `0` | Reverse proxies in front of the API. Decides `req.ip`, which the limiter buckets on |

`client/.env.local`:

| Variable | Default | |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001/api/v1` | Including the prefix |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URLs and JSON-LD are absolute |

---

## Scripts

| Command | |
|---|---|
| `npm run build` | shared → server → client, in order |
| `npm run lint` | Both packages |
| `npm run test` | Unit |
| `npm run test:e2e` | Integration |
| `npm run dev:api` / `npm run dev:web` | Development servers |
| `npm run build:shared` | Rebuild `@gunsnip/shared` after changing a shared type |

Per-package scripts are documented in [client/README.md](client/README.md) and
[server/README.md](server/README.md).
