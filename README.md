# GunSnip

Monorepo with a Next.js frontend (`client/`) and a NestJS backend (`server/`).

## Development

Install dependencies in each app, then run both dev servers:

```bash
cd client && npm install && npm run dev   # http://localhost:3000
cd server && npm install && npm run start:dev  # http://localhost:3001
```

The server allows CORS from `http://localhost:3000` (the client's dev origin) by default; override with the `CLIENT_ORIGIN` env var.
