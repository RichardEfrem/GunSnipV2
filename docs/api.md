# API reference

Every route the NestJS server exposes. Base URL in development:

```
http://localhost:3001/api/v1
```

The `/api/v1` prefix is set globally in `server/src/bootstrap.ts`, so it applies to every path
below. Nothing is served outside it — an unmatched path falls through to a controller that
returns the standard error envelope with a 404 rather than Express's HTML page.

---

## Conventions

### Money

Every amount is an **integer in IDR minor units**. There are no decimals, no floats and no
numeric strings anywhere in a request or a response. A field named `…Idr` is always an `int`.
Formatting happens in the browser, never on the wire.

### Identity

There are no user accounts yet. A caller is identified by the `gs_session` cookie, which
carries a UUID and nothing else:

```
Cookie: gs_session=6f1c2e0a-…
```

The web app's proxy mints it on first navigation; the API's actor guard mints one too, as a
fallback for callers that skip the web app. Either way it is `httpOnly` and lives for a year.
Send it with every cart, checkout, order and review call — a cart is hung off the session, so
without the cookie each request sees an empty one.

If you are driving the API with `curl`, keep a cookie jar:

```bash
curl -c jar -b jar http://localhost:3001/api/v1/cart
```

Server-side, this arrives as an `Actor`:

```ts
type Actor =
  | { kind: 'guest'; sessionId: string }
  | { kind: 'user'; sessionId: string; userId: string; roles: Role[] };
```

Only the `guest` arm is reachable today. The `user` arm is already threaded through every
service signature, so adding sign-in does not change a single method signature.

### Admin authentication

Every `/admin/*` route requires a shared secret in a header:

```
x-admin-key: <the ADMIN_KEY from server/.env>
```

The comparison is constant-time. A missing or wrong key returns `401` with code
`UNAUTHORIZED`. See [admin-guide.md](admin-guide.md) for how the back office obtains and
stores this.

### Errors

One envelope for everything, including validation failures and unhandled exceptions:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 2 left of RG RX-78-2.",
    "details": { "variantId": "…", "available": 2 }
  },
  "requestId": "…",
  "path": "/api/v1/cart/items"
}
```

`details` is present only when the error carries structured data. Field-level validation
failures arrive as `code: "VALIDATION_FAILED"` with `details.fields` holding the messages.

| Status | When |
|---|---|
| `400` | `VALIDATION_FAILED`, and any domain validation error |
| `401` | Missing or invalid admin key |
| `403` | An order or review that belongs to another session |
| `404` | Unknown slug, order number or id |
| `409` | Conflicts — insufficient stock, illegal status transition, cart changed under checkout |
| `429` | Order rate limit exceeded |
| `500` | `INTERNAL_ERROR`; the real cause is logged with the `requestId` |

Validation is strict: unknown properties in a request body are rejected outright rather than
ignored, so a typo in a field name is a `400` and not a silently dropped value.

### Pagination

Two shapes, chosen per endpoint by what the screen needs.

**Page-numbered** — the customer-facing catalogue, where "page 4 of 12" is part of the URL:

```json
{ "items": [], "page": 1, "limit": 24, "total": 187, "totalPages": 8, "hasMore": true }
```

**Cursor** — every admin list and the review feed, where rows shift under you as data changes:

```json
{ "items": [], "nextCursor": "eyJpZCI6…" }
```

Pass `nextCursor` back as `?cursor=`. A `null` means that was the last page. Every list
endpoint caps `limit`, so asking for ten thousand rows gets you the cap.

---

## Public endpoints

### Health

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness plus a database round-trip. No auth. |

### Home and editorial

| Method | Path | Notes |
|---|---|---|
| `GET` | `/home` | Banners, featured rails and the editorial blocks the landing page renders in one call. |

### Categories

| Method | Path | Notes |
|---|---|---|
| `GET` | `/categories` | The whole tree, nested. |
| `GET` | `/categories/:slug` | One category with its ancestors, for breadcrumbs. |

Slugs are globally unique and pre-namespaced — `kits`, `kits-mg`, `tools-nippers` — which is
why the storefront can serve them from the URL root.

### Products

| Method | Path | Notes |
|---|---|---|
| `GET` | `/products` | Filtered, sorted, page-numbered listing. |
| `GET` | `/products/facets` | Counts for every filter value, given the current filters. |
| `GET` | `/products/:slug` | Full detail: variants, images, stock, aggregates. |
| `GET` | `/products/:slug/requirements` | The tools this kit needs, by necessity. |
| `GET` | `/products/:slug/related` | Same series, same grade, and frequently bought with. |
| `GET` | `/products/:slug/reviews` | Approved reviews only. |

`GET /products` query parameters:

| Parameter | Type | Notes |
|---|---|---|
| `category` | `string` | Category slug. Includes descendants. |
| `grade` | `string[]` | Repeat the key: `?grade=MG&grade=RG` |
| `scale` | `string[]` | `1/144`, `1/100`, … |
| `series` | `string[]` | Series slug |
| `brand` | `string[]` | Brand slug |
| `difficulty` | `string[]` | |
| `toolJob` | `string[]` | Filters tools by the job they do |
| `minPrice` / `maxPrice` | `int` | IDR minor units |
| `inStock` | `boolean` | |
| `sort` | enum | `relevance` · `newest` · `price_asc` · `price_desc` · `best_selling` · `top_rated` |
| `page` | `int` | 1-based |
| `limit` | `int` | Capped |

`/products/facets` takes the same filter parameters minus `sort`, `page` and `limit`.

`GET /products/:slug/reviews` takes `sort`, `withPhotos`, `cursor` and `limit`.

### Search

| Method | Path | Notes |
|---|---|---|
| `GET` | `/search?q=` | Full-text, with a trigram fallback for misspellings. Accepts every `/products` filter. |
| `GET` | `/search/suggest?q=&limit=` | Type-ahead. |
| `GET` | `/search/facets?q=` | Facet counts within a result set. |

Search is a `tsvector` column on `product`, maintained by a trigger so it folds in brand and
series names. The response reports which strategy answered — exact, full-text or fuzzy — so
the UI can say "showing results for…" honestly.

### Bundles

| Method | Path | Notes |
|---|---|---|
| `GET` | `/bundles` | |
| `GET` | `/bundles/:slug` | |

### Shipping

| Method | Path | Body / query | Notes |
|---|---|---|---|
| `GET` | `/shipping/regions` | `?parentId=` | One level of the Indonesian region tree. Omit `parentId` for provinces. |
| `POST` | `/shipping/quote` | `{ regionId }` | Cost per tier: `REGULAR`, `EXPRESS`, `SAME_DAY`. |

### Cart

Every route reads the session from the cookie and returns the **whole cart** — totals,
per-line stock notices, voucher state. There is no partial cart response to reconcile
client-side.

| Method | Path | Body |
|---|---|---|
| `GET` | `/cart` | — |
| `POST` | `/cart/items` | `{ items: [{ variantId, quantity }] }` |
| `POST` | `/cart/bundles` | `{ slug, quantity? }` |
| `PATCH` | `/cart/items` | `{ isSelected }` — select or deselect every line |
| `PATCH` | `/cart/items/:id` | `{ quantity?, isSelected? }` |
| `DELETE` | `/cart/items/:id` | — |
| `DELETE` | `/cart/items/selected` | Removes every selected line |
| `POST` | `/cart/voucher` | `{ code }` |
| `DELETE` | `/cart/voucher` | — |

Prices are never accepted from the client. Every total is recomputed from the database on
every call.

A rejected voucher is a `200` with the reason on the cart, not an error — the customer needs
the cart *and* the explanation in the same response.

### Checkout

| Method | Path | Body | Notes |
|---|---|---|---|
| `POST` | `/checkout/quote` | `{ regionId?, shippingTier? }` | Prices the selected lines. Idempotent, no writes, safe to call on every form change. |

### Orders

| Method | Path | Body / query |
|---|---|---|
| `POST` | `/orders` | See below. Requires `Idempotency-Key`. |
| `GET` | `/orders/:orderNumber` | `?email=` when the session does not own the order |
| `POST` | `/orders/:orderNumber/cancel` | `{ email? }` |

`POST /orders` body:

```jsonc
{
  "contact": { "name": "…", "email": "…", "phone": "…" },
  "address": { "regionId": "…", "postalCode": "…", "street": "…", "notes": "…" },
  "shippingTier": "REGULAR",          // REGULAR | EXPRESS | SAME_DAY
  "paymentMethod": "VIRTUAL_ACCOUNT", // BANK_TRANSFER | VIRTUAL_ACCOUNT | E_WALLET
  "items": [{ "cartLineId": "…", "quantity": 2 }],
  "expectedTotalIdr": 1250000
}
```

`expectedTotalIdr` is not what you get charged. It is what the customer *believed* they were
being charged: the server recomputes the real total and refuses with `409 CART_CHANGED` if the
two disagree, rather than quietly charging a different number than the one on screen.

`Idempotency-Key` is **required** — 16 to 128 characters of letters, digits, `-` or `_`. The
key is stored with the order; replaying the same key returns the original order instead of
placing a second one. A missing key is a `400`.

Placing an order reserves stock and creates the payment in one transaction. It is rate
limited per caller — ten in five minutes by default, tunable via `ORDER_RATE_LIMIT` and
`ORDER_RATE_WINDOW_SECONDS`. Exceeding it is a `429`.

Guests read their own orders through the session cookie. The `email` parameter is the
fallback for a different browser — which is exactly what the storefront's *Track an order*
form uses.

### Stock notifications

| Method | Path | Body |
|---|---|---|
| `POST` | `/notify-requests` | `{ variantId, email }` |

Registers interest in an out-of-stock variant. The email is lower-cased before it reaches the
unique index, so one person who types their address two ways is one subscriber.

Capture only: the rows accumulate and `notifiedAt` is reserved, but **nothing sends a
back-in-stock mail on restock yet**. Interest is recorded from the moment out-of-stock pages
exist because a restock cannot retroactively learn who wanted to know.

### Reviews

| Method | Path | Body |
|---|---|---|
| `GET` | `/reviews/invites/:token` | — |
| `POST` | `/reviews` | See below |

```jsonc
{
  "token": "…",              // decides what is being reviewed — the body cannot name a product
  "rating": 5,
  "authorName": "…",
  "title": "…",
  "body": "…",
  "buildTimeMinutes": 480,   // optional
  "experiencedDifficulty": "INTERMEDIATE",
  "toolsUsed": ["…"],
  "photos": [{ "url": "…", "alt": "…" }]
}
```

Invites are minted when an order reaches `DELIVERED` and are delivered by mail, one per
purchased product. In development the console mailer prints them in full, so the invite URLs
appear in the API's terminal. Submitted reviews land as `PENDING` and appear on the storefront
only after moderation.

---

## Development endpoints

Gated by `ENABLE_DEV_ENDPOINTS=true`, which defaults to false. Never enable in production.

| Method | Path | Body |
|---|---|---|
| `POST` | `/dev/payments/:paymentId/simulate` | `{ event }` |

`event` is one of `CHARGE_PAID`, `CHARGE_FAILED`, `CHARGE_EXPIRED`.

This does not shortcut anything. The service asks the mock provider for the callback body it
*would* have sent and feeds it back through `parseCallback`, so the simulation drives exactly
the code path a real gateway webhook will. `CHARGE_CREATED` is not offered — the charge opens
with the order. Refunds go through the provider's refund method.

---

## Admin endpoints

All require `x-admin-key`. All list endpoints are cursor-paginated with `cursor` and `limit`.

### Dashboard and health

| Method | Path | Notes |
|---|---|---|
| `GET` | `/admin/dashboard` | Today's counters, the fulfilment queue, low-stock lines. |
| `GET` | `/admin/health` | Health plus the resolved actor. A `200` also means "this key is valid", which is what the back-office sign-in calls. |

### Products

| Method | Path | Body |
|---|---|---|
| `GET` | `/admin/products` | `?status=&type=&q=&cursor=&limit=` |
| `GET` | `/admin/products/:id` | — |
| `POST` | `/admin/products` | Full product |
| `PATCH` | `/admin/products/:id` | Partial |
| `PUT` | `/admin/products/:id/status` | `{ status }` — `DRAFT` · `PUBLISHED` · `ARCHIVED` |
| `POST` | `/admin/products/:id/variants` | New variant |
| `POST` | `/admin/products/:id/images` | `multipart/form-data` |
| `PUT` | `/admin/products/:id/images/order` | `{ ids: [...] }` |
| `PUT` | `/admin/products/:id/requirements` | The tool list for this kit |

Variants and images are addressed globally once they exist, since their ids are unique:

| Method | Path | Body |
|---|---|---|
| `PATCH` | `/admin/variants/:variantId` | Partial |
| `PATCH` | `/admin/images/:imageId` | `{ alt? }` |
| `PUT` | `/admin/images/:imageId/primary` | — |
| `DELETE` | `/admin/images/:imageId` | Returns the updated product |

Uploaded images are written to `MEDIA_DIR` and served under `MEDIA_PUBLIC_PATH`. The defaults
point at the web app's `public/media/products`, the same place the seed writes its generated
placeholders, so seeded and uploaded images share one URL shape. Moving to a CDN changes those
two variables and nothing else.

### Inventory

| Method | Path | Body |
|---|---|---|
| `POST` | `/admin/variants/:variantId/stock` | `{ delta, reason, note? }` |
| `GET` | `/admin/variants/:variantId/movements` | `?cursor=&limit=` |

`delta` is signed — `+12` to receive stock, `-1` to write off a damaged box. Every adjustment
writes an immutable movement row, so the ledger explains the number rather than just holding
it.

### Orders

| Method | Path | Body |
|---|---|---|
| `GET` | `/admin/orders` | `?status=&placedFrom=&placedTo=&q=&cursor=&limit=` |
| `GET` | `/admin/orders/:orderNumber` | — |
| `POST` | `/admin/orders/:orderNumber/status` | `{ status, note? }` |
| `POST` | `/admin/orders/:orderNumber/cancel` | `{ reason }` |
| `PUT` | `/admin/orders/:orderNumber/shipment` | `{ courier, trackingNumber? }` |
| `PUT` | `/admin/orders/:orderNumber/note` | `{ internalNote? }` |
| `POST` | `/admin/orders/:orderNumber/payment` | `{ status }` — `PAID` or `FAILED` |

The payment route writes the *payment* row and lets the order follow, which is the opposite
direction from every other route here — an order cannot be moved to `PAID` directly, because
the payment outcome is what causes that transition.

Order statuses:

```
PENDING_PAYMENT → PAID → PACKING → SHIPPED → DELIVERED → COMPLETED
                                            ↘ CANCELLED / EXPIRED / REFUNDED
```

Transitions live in an explicit map. An illegal one is a `409`, not a silently ignored write.
Cancelling releases reserved stock in the same transaction that changes the status.

### Vouchers

| Method | Path | Body |
|---|---|---|
| `GET` | `/admin/vouchers` | `?isActive=&q=&cursor=&limit=` |
| `GET` | `/admin/vouchers/:id` | — |
| `POST` | `/admin/vouchers` | See below |
| `PATCH` | `/admin/vouchers/:id` | Partial |
| `DELETE` | `/admin/vouchers/:id` | `204` |

```jsonc
{
  "code": "WELCOME10",
  "type": "PERCENTAGE",       // PERCENTAGE | FIXED_AMOUNT | FREE_SHIPPING
  "description": "…",
  "percentOff": 10,           // PERCENTAGE
  "amountIdr": 50000,         // FIXED_AMOUNT
  "minSpendIdr": 250000,
  "maxDiscountIdr": 100000,
  "startsAt": "2026-01-01T00:00:00.000Z",
  "endsAt": "2026-04-01T00:00:00.000Z",
  "usageLimit": 500,
  "perSessionLimit": 1,
  "isActive": true,
  "categoryIds": [],          // empty means the whole catalogue
  "productIds": []
}
```

### Reviews

| Method | Path | Body |
|---|---|---|
| `GET` | `/admin/reviews/counts` | Queue sizes by status |
| `GET` | `/admin/reviews` | `?status=&q=&cursor=&limit=` |
| `GET` | `/admin/reviews/:id` | — |
| `POST` | `/admin/reviews/:id/moderation` | `{ status }` — `APPROVED` or `REJECTED` |
| `PUT` | `/admin/reviews/:id/reply` | `{ adminReply? }` — `null` clears it |

### Banners

| Method | Path | Body |
|---|---|---|
| `GET` | `/admin/banners` | — |
| `POST` | `/admin/banners` | New banner |
| `PUT` | `/admin/banners/order` | `{ ids: [...] }` |
| `PATCH` | `/admin/banners/:id` | Partial |
| `DELETE` | `/admin/banners/:id` | `204` |

### Reference data

The same five-verb shape for each of `grades`, `scales`, `series`, `brands` and `categories`:

| Method | Path |
|---|---|
| `GET` | `/admin/reference/<collection>` |
| `POST` | `/admin/reference/<collection>` |
| `PATCH` | `/admin/reference/<collection>/:id` |
| `DELETE` | `/admin/reference/<collection>/:id` |

Deleting reference data still in use is refused with a `409` rather than orphaning products.
Renaming a brand or series reindexes the affected products' search vectors through the trigger.
