# client

The GunSnip storefront and back office. Next.js 16 (App Router), React 19, Tailwind v4.

Setup lives in the [root README](../README.md); the route list is there too. Structure and
rules are in [../docs/architecture.md](../docs/architecture.md).

```bash
npm run dev -w client            # http://localhost:3000
```

Needs the API running on `http://localhost:3001` and `.env.local` copied from `.env.example`.

## Structure

```
src/
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
  components/ui/             shared primitives
  components/layout/         header, footer, mobile tab bar
  fonts/                     self-hosted IBM Plex
  lib/                       api-client, api-server, admin-api, formatters, cn, constants
  styles/                    tokens.css, globals.css
```

Feature folders are vertical slices — one must not import another's components. Anything two
features need gets lifted to `components/ui`.

## Rules worth knowing before editing

- **Server Components by default.** `'use client'` only for real interactivity, pushed as far
  down the tree as it goes.
- **No fetch calls in components.** They live in `features/<x>/api.ts`, typed by a Zod schema
  that parses the response.
- **No `useEffect` for data fetching.** If you are writing one, the fetch belongs on the server.
- **The URL is the source of truth** for filters, sort and pagination — never mirrored into
  local state.
- Storefront mutations use the api module; the back office uses Server Actions, because the
  admin key is in an `httpOnly` cookie only server code can read.
- Every list or grid ships all four states: loading skeleton, empty, error, loaded.
- `components/ui` primitives take a `className` and merge it with `cn()`. No business logic.

## Styling

Tailwind v4, with the palette as tokens in `styles/tokens.css`. Tailwind's default colours are
**deleted** in `@theme`, so `bg-red-500` does not exist — a stray hex value fails the build
rather than waiting for review.

`/design-system` renders every token, primitive and state on one page.

## Next 16 specifics

`params`, `searchParams`, `cookies()` and `headers()` are Promises — use the generated
`PageProps<'/route'>` helpers. `middleware.ts` is now `proxy.ts`, and its export must be named
`proxy`. Turbopack is the default bundler. `next lint` is gone, so linting is plain `eslint`.

## Scripts

| Command | |
|---|---|
| `dev` | Development server |
| `build` | Production build |
| `start` | Serve the build |
| `lint` | `eslint` plus the contrast check |
| `typecheck` | `tsc --noEmit` |
| `check:contrast` | Contrast floor only |
| `verify` | lint → typecheck → build |

`check:contrast` reads `tokens.css` directly, so it cannot drift from what ships: a token change
that drops any pair below the floor fails the build.
