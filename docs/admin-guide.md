# Back-office guide

Operating GunSnip: signing in, and what each screen does.

---

## Getting in

The back office lives at **http://localhost:3000/admin**. Any `/admin` URL redirects to
`/admin/sign-in` if you are not signed in, carrying where you were headed so you land there
afterwards rather than on the dashboard.

The credential is the `ADMIN_KEY` from `server/.env`. Paste it into the sign-in form.

### What actually happens

Worth understanding, because it explains a few things that would otherwise look odd:

1. The form posts the key to a Server Action.
2. That action calls `GET /admin/health` with the key in an `x-admin-key` header. A `200` means
   the key is good — there is no separate "validate key" endpoint, because one that says only
   that would be a second thing to keep in step.
3. On success the key is stored in an `httpOnly` cookie named `gs_admin`, readable only by
   server code, and never sent to client JavaScript.
4. Every subsequent admin screen and write reads that cookie server-side and attaches the
   header on your behalf.

The key is deliberately **not** an environment variable on the web app. The API already holds
it; a second copy in the storefront's environment would be another thing to rotate and another
place to leak it from. Signing in is how the key gets there, and the API is what decides
whether it is right.

The cookie lasts twelve hours — a working day. It carries a shared secret, not an identity, so
it is short on purpose.

### Two layers of protection

The client-side gate in `proxy.ts` only checks whether the cookie *exists*. It cannot check the
value: the cookie is `httpOnly` and its contents are a secret the proxy has no business
validating. Its job is to avoid rendering a dashboard shell that is only going to fill with
401s.

The real authority is the API's `AdminGuard`, which compares the key in constant time on every
single request and would refuse an unauthenticated one regardless of what the browser did. A
stale or wrong key gets past the proxy and is refused by the API, which the admin layout turns
back into a redirect to sign in.

### Signing out

The button in the sidebar clears the cookie. The key itself is unchanged — rotating it means
changing `ADMIN_KEY` in `server/.env` and restarting the API, which invalidates every existing
session at once.

---

## Dashboard — `/admin`

Today's orders and revenue, the fulfilment queue broken down by status, the review moderation
backlog, and variants at or below their low-stock threshold. Each panel links into the screen
that acts on it.

---

## Orders — `/admin/orders`

Filter by status, by placed-date range, or search by order number, customer name or email. The
list is cursor-paginated, which matters here: rows shift as orders come in, and a page number
would show you the same order twice.

### An order

`/admin/orders/<orderNumber>` has the lines, the customer and address, the payment, the
shipment, the full status timeline, and an internal note field.

**Advancing the status.** The path is:

```
PENDING_PAYMENT → PAID → PACKING → SHIPPED → DELIVERED → COMPLETED
                                            ↘ CANCELLED / EXPIRED / REFUNDED
```

Only legal transitions are offered, and an illegal one is refused by the API even if you
construct the request by hand. The rules live in one explicit transition map rather than
scattered through the code, so what the UI offers and what the server permits cannot drift.

**`PAID` is not reachable from this control.** It is caused by a payment outcome, not chosen by
an operator — see below.

**Shipment.** Set a courier and tracking number at the shipping step. It appears on the
customer's tracking page immediately.

**Cancelling** requires a reason. It releases the reserved stock in the same transaction that
changes the status, so a cancelled order cannot leave inventory held.

**Delivery** mints one review invitation per purchased product and mails the links out.

**The internal note** is operator-only and never reaches the customer.

### Settling a payment

The payment panel marks a payment **paid** or **failed**. Those are the only two an operator
decides — expiry belongs to the scheduled sweep, and refunds go through the provider.

This writes the *payment* row and lets the order follow, which is the opposite direction from
every other control on the screen. That is why `PAID` is not in the status dropdown.

In development you can instead drive the mock provider's callback directly, which is closer to
what a real gateway does — see [walkthrough.md](walkthrough.md#7-pay-for-it).

### Payment expiry

A scheduled job sweeps `PENDING_PAYMENT` orders past their window (`PAYMENT_EXPIRY_HOURS`,
default 24), expires them, and releases the stock they were holding. It is guarded against
double-running.

---

## Products — `/admin/products`

Filter by status and type, or search. `DRAFT` products are invisible to the storefront, so
that is where a half-finished product lives.

### Editing

Details, variants, images and build requirements are separate panels on the product page,
saving independently — a bad SKU does not lose the description you just wrote.

**Variants** carry SKU, price and stock. Stock is not edited as a number here; see Inventory
below.

**Images** upload as multipart, reorder by drag, and one is primary. Files are written to
`MEDIA_DIR` and served under `MEDIA_PUBLIC_PATH` — by default the web app's
`public/media/products`, the same directory the seed writes its generated placeholders to, so
seeded and uploaded images share one URL shape. Moving to a CDN later changes those two
environment variables and nothing else.

**Build requirements** are the tools a kit needs, each with a necessity and a reason. They are
seeded from grade-level defaults and then editable per product, so a kit that breaks the
pattern of its grade is a row edit.

**Status** — `DRAFT`, `PUBLISHED`, `ARCHIVED` — is its own control rather than a field in the
details form, because publishing is a decision and not an edit.

### Creating

`/admin/products/new` takes the core details; variants, images and requirements are added on
the product page once it exists.

---

## Inventory

Stock lives on the variant but is changed through an **adjustment**, on the product page.

An adjustment is a signed delta with a reason — `+12` with `RESTOCK`, `-1` with `DAMAGE`.
The reasons are `RESTOCK`, `CORRECTION`, `DAMAGE`, `LOSS`, `RETURN` and `ORDER_FULFILLED`.
Never an absolute number — "set stock to 12" loses the reason it changed, and the reason is the
part you need three weeks later when the count is wrong.

Every adjustment writes an immutable `InventoryMovement` row. The history is on the variant.

Restocking a variant that customers asked to be notified about does **not** mail them yet. The
interest is captured and stored against the variant; the sending half is not built.

---

## Vouchers — `/admin/vouchers`

Three types:

| Type | Fields |
|---|---|
| `PERCENTAGE` | `percentOff`, optionally `maxDiscountIdr` |
| `FIXED_AMOUNT` | `amountIdr` |
| `FREE_SHIPPING` | — |

Plus, on all three: a minimum spend, a validity window, a global usage limit, a per-session
limit, an active flag, and an optional restriction to specific categories or products (empty
means the whole catalogue).

The validation rules are enforced by the API, not by this form. A customer who trips one gets a
*specific* rejection — expired, not yet started, fully claimed, already used, below the minimum
spend, not valid for these items — rather than a generic refusal, so it is worth deactivating a
voucher rather than deleting it if you want to see how that reads.

---

## Reviews — `/admin/reviews`

Every submitted review lands as `PENDING` and is invisible on the storefront until approved.
Filter by status, or search author and content.

Approve or reject, and optionally reply as the shop — the reply shows beneath the review.

Approving updates the product's rating average and review count. Those are denormalised columns
on `product` rather than a live aggregate, because sorting a listing by rating cannot mean a
correlated subquery per row.

Reviews can only be written from a tokenised invitation, minted when an order is delivered.
There is no way to submit one without having bought the thing.

---

## Banners — `/admin/banners`

The landing page's editorial slots. Create, reorder and deactivate. Order is what the
storefront renders.

---

## Reference data — `/admin/reference`

Grades, scales, series, brands and categories — editable rather than hard-coded, since a new
Gundam series is a Tuesday and not a deployment.

Two behaviours to know:

**Deleting something still in use is refused.** A `409`, not a cascade. Reassign the products
first.

**Renaming a brand or series reindexes its products' search vectors.** Search folds those names
in through a database trigger, so a rename propagates without a reindex job.

---

## When something is refused

Every error from the API arrives in one envelope:

```json
{
  "error": { "code": "…", "message": "…", "details": { } },
  "requestId": "…",
  "path": "…"
}
```

The message is written to be shown. If a screen surfaces a `500`, the `requestId` is in the
API's logs alongside the real cause.
