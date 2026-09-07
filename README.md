# GunSnip

Monorepo with a Next.js frontend (`client/`) and a NestJS backend (`server/`).

## Development

Install dependencies in each app, then run both dev servers:

```bash
cd client && npm install && npm run dev   # http://localhost:3000
cd server && npm install && npm run start:dev  # http://localhost:3001
```

The server allows CORS from `http://localhost:3000` (the client's dev origin) by default; override with the `CLIENT_ORIGIN` env var.

## Database

The server uses TypeORM with Postgres, configured in [server/src/database/database.module.ts](server/src/database/database.module.ts).

Copy `server/.env.example` to `server/.env` and adjust as needed. By default it expects a `gunsnip` role/database:

```bash
psql -d postgres -c "CREATE ROLE gunsnip LOGIN PASSWORD 'gunsnip';"
psql -d postgres -c "CREATE DATABASE gunsnip OWNER gunsnip;"
```

`synchronize` is enabled outside of `NODE_ENV=production`, so entities auto-create their tables in development.
