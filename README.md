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
psql -d postgres -c "CREATE ROLE gunsnip LOGIN PASSWORD 'gunsnip';"
psql -d postgres -c "CREATE DATABASE gunsnip OWNER gunsnip;"
```

Configure the API and generate the Prisma client:

```bash
cp server/.env.example server/.env
# then set ADMIN_KEY — `openssl rand -hex 24` produces a usable one
npm run db:generate -w server
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

## Database

Schema and migrations live in [server/prisma/](server/prisma/); Prisma 7 keeps the connection
URL in [server/prisma7.config.ts](server/prisma7.config.ts) rather than in the schema.

```bash
npm run db:migrate -w server     # create and apply a migration
npm run db:reset -w server       # drop, re-migrate, re-seed
npm run db:studio -w server
```

The generated client is written to `server/src/generated/prisma` and is not committed — it
lives under `src/` because the Prisma 7 generator emits TypeScript, which has to be inside the
compiled source tree. Run `npm run db:generate -w server` after any schema change.
