# GunSnip

Gunpla e-commerce — model kits and the tools to build them, as one connected catalogue.

Next.js storefront and admin · NestJS REST API · PostgreSQL with Prisma.

## Layout

npm workspaces:

```
client/            Next.js storefront + admin
server/            NestJS API
packages/shared/   Postgres enums as TS union types, and the Actor union
```

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
npm run db:seed -w server        # ~60 products, reference data, Indonesian regions
```

Every variable in `server/.env` is validated at boot. A missing or malformed one stops the
process with a list of what is wrong, rather than failing later.

## Development

Two terminals:

```bash
npm run dev:api    # http://localhost:3001, API served under /api/v1
npm run dev:web    # http://localhost:3000
```

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
