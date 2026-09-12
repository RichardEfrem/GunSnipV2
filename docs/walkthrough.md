# Walkthrough

A single pass through everything GunSnip does, start to finish, on seeded data. Roughly fifteen
minutes. It assumes you have followed the setup in the [README](../README.md) and have both
processes running:

```bash
npm run dev:api    # http://localhost:3001
npm run dev:web    # http://localhost:3000
```

Keep the **API terminal visible**. There is no mail provider in development, so every
transactional message — order confirmation, shipping notice, review invitations — is printed
there in full. Several steps below depend on reading it.

---

## 1. Browse the catalogue

Open **http://localhost:3000**.

The landing page is one API call: banners, featured rails and editorial blocks arrive together
from `GET /home`.

Things worth trying:

- Click through to **Master Grade** (`/kits-mg`). Category slugs are namespaced and globally
  unique, so they sit at the URL root — no `/c/` prefix.
- Apply a few filters in the rail: grade, price range, in-stock only. **Watch the address bar.**
  Every filter, the sort order and the page number live in the URL and nowhere else.
- Copy the URL into a new tab. You get the identical page, because the listing is a Server
  Component reconstructed entirely from the URL.
- Change the sort to *Price, low to high*, then to *Top rated*.
- Note the facet counts beside each filter. They are computed against your *current* filters,
  so a value showing zero really would return nothing.

Try `/kits-nonsense` for the 404. The category resolves before any bytes are sent, which is
what makes it a genuine 404 status rather than a soft one under a `200`.

## 2. Search

Use the header search, or go to `/search?q=barbatos`.

Then misspell it deliberately — `/search?q=barbtos`. The trigram fallback catches it, and the
response says which strategy answered so the UI can tell you it corrected the spelling rather
than pretending you typed it right.

Search also folds in brand and series names, so `bandai` and `iron-blooded` both return
sensible sets even though neither word is in most product titles.

## 3. A product page

Open any Master Grade kit.

The part worth looking at is **what you need to build it** — the tool requirements, split into
required, recommended and optional, each with a reason. It is seeded per grade (every Real
Grade has waterslide decals and tiny parts; no Entry Grade does) and then editable per product,
so a kit that breaks the pattern is a row edit rather than a schema problem.

Add a required tool to your cart from that panel. That is the whole premise of the shop: kits
and the tools to build them as one catalogue.

Also on the page: variant selection, the review list with a rating breakdown, and related
products by series and by grade.

**Find an out-of-stock variant** — the seed deliberately includes several — and use *Notify me
when back in stock*. Leave any email. The interest is recorded against the variant; sending the
mail on restock is not built yet, so nothing will arrive in step 9.

## 4. Cart

Go to **`/cart`**.

- Change a quantity. The whole cart comes back from the server, recomputed. Nothing is
  calculated in the browser.
- **Deselect a line.** Selection is per line, and only selected lines are checked out — the
  cart is a saved list, not a commitment.
- Try a voucher. Seeded codes, each chosen to exercise a different path:

| Code | What it does |
|---|---|
| `WELCOME10` | 10% off orders over Rp 250.000, capped at Rp 100.000 |
| `FIRSTBUILD` | Rp 50.000 off orders over Rp 300.000 |
| `GRATISONGKIR` | Free shipping over Rp 500.000 |
| `MASTERGRADE20` | 20% off Master Grade kits only, capped at Rp 400.000 |
| `LEBARAN2025` | **Rejected** — expired |
| `FLASH50` | **Rejected** — fully claimed |
| `STAFFONLY` | **Rejected** — deactivated by an operator |

The three rejections each give a *different* message. Worth trying all three: a voucher that
fails is still a `200` with the cart, because the customer needs the cart and the explanation
in the same response.

Apply `WELCOME10` (get your subtotal over Rp 250.000 first) and keep it for checkout.

## 5. Checkout

Click through to **`/checkout`**.

Fill in contact details and pick an address — the region selector walks the real Indonesian
province → city → district tree from the seed. Choose a shipping tier and watch the total
update; each change re-quotes against `POST /checkout/quote`, which writes nothing and is safe
to call on every keystroke.

Pick a payment method (`VIRTUAL_ACCOUNT` is the interesting one) and place the order.

What happened in that one transaction: stock reserved, order created, payment opened, the
idempotency key stored. If you double-submit, the stored key returns the *same* order rather
than placing a second.

You land on the confirmation page with an order number, payment instructions as the provider
worded them, and a countdown to the payment window closing.

**Check the API terminal.** The order confirmation mail is printed there in full.

## 6. Track the order

Open **`/orders`** in a private window — no session cookie, so this is the guest path.

Enter the order number and the email you checked out with. The order comes back with its status
timeline. This is how a customer who ordered on their phone reads it on a laptop.

## 7. Pay for it

Two ways, and they run the same code.

### The back office (easier)

Sign in at **`/admin/sign-in`** with the `ADMIN_KEY` from `server/.env`. Open the order and
mark the payment **paid**.

### The dev endpoint (closer to the real thing)

This is what a gateway webhook will drive. You need the payment id, which the customer-facing
order response deliberately does not expose:

```bash
psql -d gunsnip -t -c \
  "SELECT p.id FROM payment p JOIN \"order\" o ON o.id = p.order_id
   WHERE o.order_number = 'GS-…';"
```

```bash
curl -X POST http://localhost:3001/api/v1/dev/payments/<paymentId>/simulate \
  -H 'Content-Type: application/json' \
  -d '{"event":"CHARGE_PAID"}'
```

This does not shortcut anything. The service asks the mock provider for the callback body it
*would* have sent and pushes it back through `parseCallback` — the same path a real gateway
takes. `CHARGE_FAILED` and `CHARGE_EXPIRED` are the other two outcomes worth pretending to be;
an expired one releases the reserved stock.

Either way the order moves to **PAID** and another mail prints.

## 8. Fulfil it

Still in the back office, at `/admin/orders`.

Walk the order along: **PACKING → SHIPPED → DELIVERED**. Add a courier and tracking number at
the shipping step; the customer's tracking page picks it up immediately.

Try to skip a step — move a `PACKING` order straight to `DELIVERED`. It is refused. Transitions
are an explicit map, and an illegal one is a `409` rather than a write that quietly succeeds.

Add an internal note. It is operator-only and never reaches the customer.

**When the order hits DELIVERED, watch the API terminal.** One review invitation is minted per
purchased product, and the console mailer prints the links.

## 9. Restock a variant

Go to `/admin/products`, find the variant you registered interest in at step 3, and adjust its
stock upward — say `+12`, reason `RESTOCK`.

The adjustment writes an immutable movement row, so the ledger explains the number rather than
just holding it — and the variant is purchasable again on the storefront. The notify-request row
from step 3 stays where it is; nothing mails it.

Look at the movement history for that variant. Every change has a row, and the reason is on
it: `RESTOCK`, `ORDER_FULFILLED`, `RETURN`, `DAMAGE`, `LOSS`, `CORRECTION`.

## 10. Write a review

Copy a review URL from the terminal — `/review/<token>` — and open it.

The token decides what is being reviewed. A submission cannot name a product it likes better;
the body has no product field at all.

Fill in a rating, a title, the body, and the extras that make a build review useful: how long
it took, how hard it actually was, which tools you used. Submit.

It does **not** appear on the product page. It lands as `PENDING`.

## 11. Moderate it

`/admin/reviews`. Your review is in the queue.

Approve it, and optionally reply as the shop. Reload the product page — the review is there,
and the product's rating average and review count have moved. Those are denormalised columns,
not a subquery per row, which is what lets a listing sort by rating without falling over.

Try the reject path on one of the seeded pending reviews to see the other branch.

## 12. The rest of the back office

Worth a look while you are in there:

- **`/admin`** — the dashboard: today's counters, the fulfilment queue, low-stock lines.
- **`/admin/products/new`** — create a product, add variants, upload images. Images land in the
  web app's `public/media/products`, the same place the seed writes its placeholders.
- **`/admin/vouchers`** — create one and test it in the cart.
- **`/admin/banners`** — reorder them and reload the landing page.
- **`/admin/reference`** — grades, scales, series, brands, categories. Try deleting one still in
  use; it is refused rather than allowed to orphan products. Rename a brand and search for its
  products — the trigger has already reindexed them.

---

## Also worth seeing

**`/design-system`** — every token, primitive and state in one page, including the four states
every list ships: loading skeleton, empty, error, loaded.

**Dark mode.** The palette is checked against a contrast floor by a script that reads
`tokens.css` at lint time, so the two themes cannot drift apart unnoticed.

**Responsive.** Narrow the window past the mobile breakpoint: the header collapses, the filter
rail becomes a sheet, and a tab bar appears.

**The error envelope.** Ask for something that does not exist and read the response:

```bash
curl -i http://localhost:3001/api/v1/products/not-a-real-kit
```

Every error in the system — validation, domain conflict, unhandled crash — leaves in that same
shape with a `requestId`.
