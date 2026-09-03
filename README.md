# SwiftBuy

A multi-seller marketplace for Rwanda: customers browse verified stores, sellers
manage their own catalogue and fulfilment, and administrators moderate the
platform.

Built with React 19, Vite and Supabase (PostgreSQL, Auth, Storage, Realtime).
Money is in whole Rwandan francs.

---

## The one idea worth knowing

**The browser is never the source of truth for anything that matters.**

Prices, order totals, commission, stock, roles, seller approval and payment
state are all decided in PostgreSQL. The React app holds only a Supabase anon
key and a user JWT, so what it can read or write is bounded by Row Level
Security — not by which buttons the interface happens to render.

Concretely:

| Concern | Where it is decided |
| --- | --- |
| Who you are | Supabase Auth |
| What you are allowed to do | `profiles.role` + RLS policies (`0002_security.sql`) |
| What an order costs | `public.place_order()` reads live prices under a row lock |
| Whether stock exists | the same function, in the same transaction |
| Whether an order is paid | `public.confirm_payment()`, callable only by a seller on that order or an admin |
| Whether a review is genuine | a trigger requiring a delivered `order_item` |

The security suite in `supabase/tests/` proves each of these against the real
policies. See [Testing](#testing).

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in your Supabase URL and anon key
npm run dev
```

Without credentials the app shows a setup screen. There is deliberately no
offline mode: a marketplace that stores orders per-browser looks like it works
and does not.

---

## Setting up Supabase

### 1. Create a project

[supabase.com](https://supabase.com) → **New project**. Pick a region close to
your users (`eu-central-1` is a reasonable choice for Rwanda).

### 2. Run the migrations

In **SQL Editor → New query**, run each file in `supabase/migrations/` in order:

| File | What it creates |
| --- | --- |
| `0001_core_schema.sql` | Tables, enums, indexes, constraints, default categories |
| `0002_security.sql` | RLS policies, role helpers, signup trigger, column guards, moderation functions |
| `0003_commerce.sql` | Checkout, cancellation, fulfilment, reviews, search |
| `0004_payments.sql` | Payment declaration, confirmation, refunds, sandbox, provider seam |
| `0005_storage.sql` | Storage buckets and object policies, seller documents |
| `0006_disputes.sql` | Buyer-protection cases |
| `0007_grants.sql` | Explicit table privileges for `anon` and `authenticated` |

Every file is idempotent — running the set again is safe, and is how you apply
an update.

### 3. Check the storage buckets

`0005_storage.sql` creates them, so **Storage** should now list:

| Bucket | Public | Limit | Types |
| --- | --- | --- | --- |
| `product-images` | yes | 5 MB | JPEG, PNG, WebP, AVIF |
| `profile-images` | yes | 2 MB | JPEG, PNG, WebP |
| `seller-documents` | **no** | 10 MB | images + PDF |

### 4. Configure authentication

**Authentication → Providers → Email**: enable it, and turn on **Confirm email**
for anything public-facing.

**Authentication → URL Configuration**: set the site URL, and add
`<your-site>/reset-password` and `<your-site>/login` as redirect URLs. Password
recovery lands on the first of those.

### 5. Create the first superadmin

Signup metadata cannot grant a staff role — `handle_new_user()` clamps it to
`customer` or `seller`. Bootstrap the first one with direct SQL:

```sql
-- After registering normally through the app:
update public.profiles set role = 'superadmin' where email = 'you@example.com';
```

That superadmin can then grant `admin` to others from the dashboard. The role
functions refuse a self-demotion and refuse to touch another superadmin.

### 6. Set your marketplace economics

Sign in as the superadmin → **Admin → Settings**. Commission and delivery fee
both default to zero, so nothing is charged until you decide what to charge.

### 7. Enable Realtime

**Database → Replication** → add `messages` and `notifications` to the
`supabase_realtime` publication. These are the only two tables the app
subscribes to.

### 8. Connect the app

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Both are on **Project Settings → API**. The anon key is a public identifier and
belongs in the client bundle; the **service role key does not** — it bypasses
every policy in this repository.

---

## How the commerce flow works

### Checkout

```
Browser                          PostgreSQL (place_order)
───────                          ────────────────────────
delivery name / phone / address
payment method
        ────────────────────▶    lock the cart's products FOR UPDATE
                                 reject anything delisted or from an
                                   unapproved store
                                 reject a quantity above stock
                                 read prices from products
                                 subtotal = Σ price × qty
                                 commission = configured rate, per line
                                 delivery fee from platform_settings
                                 write order + order_items + commissions
                                 decrement stock
                                 one shipment per distinct seller
                                 open a PENDING payment
                                 empty the cart
        ◀────────────────────    reference, total, payment id
```

The client sends no prices and no total, so there is nothing to tamper with. If
a seller changes a price between adding to cart and checking out, the order
reflects the real one — which is why the cart calls its figure an estimate.

### Payment

SwiftBuy does not process card payments and does not hold anyone's money.
Buyers pay sellers directly, and the flow is honest about what that means:

```
customer pays by MoMo / bank / on delivery
        │
        ▼
declare_payment()          status → awaiting_confirmation
        │                  the order is NOT paid, and does not say it is
        ▼
seller checks their own account
        │
        ├── confirm_payment()  → successful   (seller or admin only)
        └── reject_payment()   → failed, with a reason the buyer sees
```

`confirm_payment()` explicitly refuses the buyer. A `sandbox` provider exists
for development, is off by default, and is refused by `place_order()` unless an
operator has switched it on.

When a real gateway is integrated, `confirm_payment_from_provider()` is the seam
it plugs into: it verifies the settled amount against the order and is revoked
from both `anon` and `authenticated`, so only an Edge Function holding the
service role can reach it.

### Multi-seller fulfilment

One checkout, one payment, one delivery fee — and one shipment per seller, each
advancing independently:

```
Order SB-260314-A3F91C
├── shipment · Gigi Electronics  → confirmed → preparing → in_transit → delivered
└── shipment · Rival Store       → confirmed → preparing → ready_for_pickup
```

`update_shipment_status()` validates every transition (nothing jumps from
`pending` to `delivered`) and the order's own status is derived from its
shipments, so a two-seller order only reads "delivered" once both parts are.

### Reviews

A review is anchored to an `order_item`, and a trigger requires that the item
belongs to the reviewer and that the seller's shipment reached `delivered`. The
UI therefore offers "write a review" only from a delivered order, and the
product page's review list is read-only. A unique constraint allows one review
per purchased line.

---

## Architecture

```
src/
├── lib/
│   ├── supabase.js      the single client; anon key only
│   ├── errors.js        SQLSTATE → readable message
│   ├── motion.js        the animation vocabulary
│   └── routes.js        where each role belongs
├── hooks/
│   ├── useAsyncData.js  fetch with cancellation, reload, retry
│   └── useReducedMotion.js
├── services/            everything that talks to Supabase
│   ├── products.js      catalogue + server-side search
│   ├── commerce.js      cart, wishlist, checkout, orders, payments, reviews, disputes
│   ├── accounts.js      profiles, stores, settings, audit log
│   ├── images.js        Storage uploads
│   └── messaging.js     conversations, messages, notifications (Realtime)
├── context/             auth and toasts (provider + hook split for HMR)
├── components/          shared UI, icons, product card, conversation, guards
├── layouts/             page, auth and seller frames
├── pages/               one file per route; seller/ and admin/ nested
└── utils/               formatting and validation

supabase/
├── migrations/          0001 … 0007, applied in order
└── tests/               local shim + the security and commerce suite
```

Pages never call Supabase directly — they go through a service, which is what
keeps query shapes and field mapping in one place.

### Database

```
auth.users ──1:1── profiles ──1:1── sellers ──1:n── products ──1:n── product_images
                      │                                  │
                      │                                  ├── cart_items
                      │                                  └── wishlist_items
                      │
                      └──1:n── orders ──1:n── order_items ──1:1── reviews
                                  │                │
                                  │                └──1:1── commissions
                                  ├──1:n── shipments      (one per seller)
                                  ├──1:n── payments
                                  └──1:n── disputes

conversations ──1:n── messages          notifications        audit_logs
```

`profiles.role` is the authorization source of truth. `sellers.status` is
separate from it on purpose: a user holds the seller role while their store is
still `pending`, `rejected` or `suspended`.

---

## Security

- **RLS on every table**, forced, so even the table owner is subject to it.
- **Every `UPDATE` policy carries a `WITH CHECK`.** A `USING`-only policy lets a
  user rewrite a row into something they could not have created — that is
  exactly how a customer would promote themselves to admin.
- **Column guards** pin what a policy alone cannot: role, suspension, seller
  status, product ratings and the featured flag. A seller can edit their listing
  and not its rating; a customer can edit their profile and not their role.
- **No recursion between policies.** `orders` and `order_items` each need to ask
  about the other; both go through `SECURITY DEFINER` helpers rather than
  sub-selects that would recurse.
- **Orders, payments, shipments, commissions and the audit trail are not
  writable from a browser at all** — `0007_grants.sql` revokes the verb, and the
  only path in is a function that checks the caller.
- **Storage policies key on the path**: `product-images/<seller_id>/…`, so a
  seller cannot write into another seller's folder even by calling the API
  directly. Bucket-level MIME and size limits apply regardless of the form.
- **The audit log is append-only** from the application's side: written by
  security-definer functions, readable by admins, updatable by nobody.
- **No secrets in the client.** Only the anon key ships; the service role key
  must never appear under `src/`.

### A note on the previous Appwrite setup

The project this was built from carried a live Appwrite server API key in
`setup-appwrite.mjs`. That file is deleted and never entered this repository's
git history — **but the key was in the source that was shared, so treat it as
compromised and revoke it in the Appwrite console.** It also stored roles and
seller approval in client-writable Appwrite account preferences, which meant a
user could grant themselves the seller or admin role from the browser. Both are
gone; roles now live in a database column that the browser cannot write.

---

## Testing

```bash
npm test                 # 88 frontend tests (Vitest + Testing Library)
npm run test:db          # 68 database security and commerce checks
npm run lint
npm run build
```

### Database suite

`supabase/tests/run.sh` applies a small local shim for Supabase's `auth` and
`storage` schemas, runs every migration against a throwaway PostgreSQL database,
and then asserts the guarantees this README claims:

```bash
PGHOST=/tmp PGPORT=5432 npm run test:db
```

It covers, among others:

- signup metadata cannot grant an admin role
- a customer cannot change their own role, or edit another user's profile
- a seller cannot approve their own store, or list products before approval
- one seller cannot reprice, delist or feature another seller's product
- a suspended store's listings leave the storefront immediately
- a customer cannot see another customer's cart, orders or payments
- an order total is computed from catalogue prices and the configured fee
- ordering more than the available stock is refused
- a buyer cannot write a payment row or confirm their own payment
- a seller with no line on an order cannot confirm its payment
- a shipment cannot jump from `pending` to `delivered`
- a review requires a delivered purchase, and cannot be written twice
- a third party cannot see that a conversation exists

It needs only `psql` 15+ — no Supabase project, no network.

### Frontend suite

Validation rules, formatting, error classification, the motion vocabulary, the
async-data hook, and component behaviour (dialog semantics and focus, quantity
bounds, status wording, wishlist toggle labelling, empty and error states, route
guards for each role and seller status).

---

## Deploying

### Vercel

```bash
npm install -g vercel
vercel
```

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project's
environment variables. `vercel.json` already handles SPA routing, long-lived
caching for fingerprinted assets, and basic security headers.

Any static host works — the build output is `dist/`.

### Before going live

- [ ] Migrations `0001`–`0007` applied
- [ ] Email confirmation enabled, redirect URLs set
- [ ] First superadmin promoted
- [ ] Commission rate and delivery fee set
- [ ] `sandbox_payments_enabled` is `false`
- [ ] `messages` and `notifications` added to the realtime publication
- [ ] The old Appwrite API key revoked

---

## Status

### Working end to end

Registration and sign-in (email/password, confirmation, password reset,
persistent sessions) · database-backed roles and RLS · seller applications and
admin approval · product CRUD with Storage-backed images · server-side search,
filtering, sorting and pagination · cart and wishlist · server-side checkout
with stock validation and commission · multi-seller orders with per-seller
shipments · order cancellation with stock restoration · manual payment
declaration and seller confirmation · verified-purchase reviews · customer–seller
chat and notifications over Realtime · disputes · seller analytics · admin
dashboard with users, sellers, orders, products, cases, settings and an audit
log.

### Implemented, needs external configuration

- **Email delivery.** Confirmation and recovery emails go through Supabase's
  built-in SMTP, which is rate-limited and not for production. Configure your
  own SMTP provider before launch.
- **Realtime.** Works once the two tables are added to the publication.
- **Domain and deployment.** Redirect URLs must match wherever you host it.

### Not implemented

- **Automated card or mobile-money collection.** No gateway is integrated
  because no gateway credentials ship with this repository. The architecture is
  ready — `payments` carries provider, status, references and timestamps, and
  `confirm_payment_from_provider()` is the callback seam — but today every
  payment is settled directly between buyer and seller and confirmed by the
  seller. Integrating MTN MoMo, Airtel Money or a card processor means writing
  an Edge Function that verifies the provider's webhook signature and calls that
  function with the service role.
- **Seller payouts.** SwiftBuy never holds the money, so there is nothing to pay
  out. `commissions` and the `seller_earnings` view record what the platform is
  owed; collecting it is a business process, not a code path.
- **Refund execution.** An admin *records* a refund. Moving the money is
  arranged between seller and customer, and the UI says so.
- **Delivery partners.** Fulfilment status and an optional tracking reference
  are modelled; no courier API is integrated.
- **Product variants.** Products are single-SKU today.
- **Automated end-to-end browser tests.** The flows above were verified by
  reading and by the two suites; there is no Playwright run in CI yet.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built output |
| `npm run lint` | ESLint over the whole project |
| `npm test` | Frontend test suite |
| `npm run test:db` | Migrations + database security suite |
