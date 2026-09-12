# server

The GunSnip REST API. NestJS 12, Prisma 7, PostgreSQL.

Served under `/api/v1` — see [../docs/api.md](../docs/api.md) for the endpoint reference and
[../docs/architecture.md](../docs/architecture.md) for the layering rules. Setup lives in the
[root README](../README.md).

```bash
npm run start:dev -w server      # http://localhost:3001
```

## Structure

```
prisma/              schema.prisma, migrations, seed
prisma7.config.ts    connection URL — Prisma 7 keeps it out of the schema
src/
  common/            guards, interceptors, filters, pipes, decorators
  config/            env schema + typed config, validated at boot
  prisma/            PrismaService
  generated/prisma/  generated client — gitignored, under src/ because the Prisma 7
                     generator emits TypeScript that must be inside the compiled tree
  modules/
    catalog/  cart/  orders/  payments/  inventory/  reviews/
    vouchers/  search/  shipping/  notifications/  admin/  dev/  health/
```

Each module is one bounded context, and within it four files with four jobs:

- **Controller** — parse, validate, delegate, return. No Prisma, no domain conditionals.
- **Service** — the business rules. Throws domain errors, never `HttpException`.
- **Repository** — the only place `PrismaService` is touched. One per aggregate.
- **Module** — wiring, with explicit `exports`.

`bootstrap.ts` holds everything that turns a bare Nest app into this one — global prefix, cookie
parser, validation pipe, CORS, proxy trust. The e2e suite calls it too, so tests exercise the
same configuration the real server uses.

## Scripts

| Command | |
|---|---|
| `start:dev` | Watch mode |
| `start:prod` | Run the build |
| `build` | `nest build` |
| `lint` | `oxlint` plus `tsc --noEmit` |
| `typecheck` | Types only |
| `format` | Prettier over `src/` and `test/` |
| `test` | Vitest unit suite |
| `test:watch` | Unit suite in watch mode |
| `test:cov` | With coverage |
| `test:e2e` | Integration suite against `gunsnip_test` |
| `db:generate` | Regenerate the Prisma client |
| `db:migrate` | Create and apply a migration, then regenerate |
| `db:reset` | Drop, re-migrate, re-seed — prompts first |
| `db:seed` | Re-seed in place; truncates first, so it is repeatable |
| `db:studio` | Prisma Studio |

## Testing

Unit tests are mandatory on price calculation, stock reservation and release, both state
machines, and voucher validation — the four places money and inventory break.

The e2e suite runs against `gunsnip_test`, rebuilt from migrations and seed before every run.
It reads [.env.test](.env.test) and refuses to start if that URL names a database whose name
does not end in `_test`.

## After changing the schema

```bash
npm run db:migrate -w server     # creates the migration and regenerates the client
```

Anything Prisma cannot express — the search trigger, the trigram indexes — goes into the
migration SQL by hand.
