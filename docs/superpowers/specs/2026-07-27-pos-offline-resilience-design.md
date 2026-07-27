# POS Offline Resilience Design

Date: 2026-07-27
Status: approved by owner, ready for implementation planning

## Context

Staff will run POS on their own phones, not fixed in-store terminals. The
owner has not yet experienced a real outage, but wants this solved
preventively before scaling to more outlets/staff, since a personal phone
on cellular data is far more likely to lose connectivity mid-shift than a
fixed terminal on shop wifi.

Investigation found the app has zero offline capability today:

- `app/pos/page.tsx` is `force-dynamic` (server-rendered per request); with
  no cached fallback, a request with no network never even loads.
- `created_at` (the recorded sale time) is generated server-side, inside
  the `submitOrderV2` server action's call to `buildOrderFromCart`
  (`lib/order-cart.ts:109`, `new Date().toISOString()`), not captured on
  the device at the moment "Thanh toán" is pressed. Today, a sale made at
  07:00 that only reaches the server at 17:00 would be recorded as 17:00.
- Retry-on-failure already exists and is solid: `resolvePosCheckoutAttempt`
  (`lib/pos-checkout-idempotency.ts`) reuses the same request token across
  retries of an identical payload, and `submitOrderV2`/`create_pos_order_atomic`
  are already idempotent on that token. This durability is missing only
  the "persist locally so it survives an app restart, and retry
  automatically" piece.
- Login uses NextAuth's JWT session strategy with the default 30-day
  `maxAge` — verifying an *existing* session requires no database call, so
  a staff member who has logged in within the last 30 days stays
  authenticated across a `/pos` page load even with no network. Logging in
  *for the first time* while offline is not solvable without a
  fundamentally different auth mechanism (e.g. a locally-cached offline
  PIN) — out of scope here, confirmed unnecessary in practice since staff
  log in once and keep working for many days.

## Goal

From the moment a staff member opens POS until they finish a sale, no
matter which point network drops, they can keep selling without
interruption. Every completed sale (a "Thanh toán" press) is durably
recorded with the exact moment it was pressed, and is never lost or
duplicated, regardless of how long it takes to reach the server.

## Non-goals (explicit, owner-confirmed)

- **Inventory accuracy during an outage.** Stock reads and consumption are
  not reconciled or protected against overselling while offline. The
  owner's framing: sales data is ground truth; inventory is already
  understood to carry measurement error that gets corrected later
  (consistent with the project's existing MAC/ledger tolerance for
  negative stock from ordinary sales). No stock reservation, locking, or
  staleness warning is built.
- **Offline login.** Only an already-authenticated session (logged in
  within the last 30 days) is protected. A staff member who needs to log
  in for the first time while offline cannot.
- **Protecting an in-progress, not-yet-submitted cart** from being lost if
  the app closes before "Thanh toán" is pressed. Only submitted orders are
  protected.
- **"Lưu nháp" (save draft) offline.** This remains a network call that
  fails visibly when offline, unchanged.
- **Staff-facing sync status.** Staff see no indicator of pending or
  failed syncs and are never blocked by one. All visibility is
  admin-only.
- **Active notifications** (email/SMS/Zalo) for sync problems. Admin
  checks a dashboard page; no push channel is built.

## Architecture

Three independent pieces, each addressing one failure mode:

1. **Client-captured sale timestamp** — fixes a correctness bug that
   exists independent of offline support: the recorded sale time must be
   when the button was pressed, not when the request reached the server.
2. **Local persisted order queue** — protects a submitted order from being
   lost if the network is unavailable at submission time or the app
   closes before a retry succeeds.
3. **Offline app-shell caching** — lets the POS page open at all when
   there is no network from the start of a session.

All three build on existing patterns in the codebase (the idempotent
request-token retry, the admin anomaly-dashboard convention used for
COGS drift) rather than introducing new ones.

## Component 1: Client-captured sale timestamp

**Change:** `CartInput` (`lib/order-cart.ts`) gains a required field:

```ts
client_captured_at: string; // ISO 8601, captured via new Date() in the
                             // browser at the moment "Thanh toán" is first
                             // pressed for this cart -- never regenerated
                             // on retry.
```

`buildOrderFromCart` uses this value for `created_at` instead of calling
`new Date()` itself. Captured once in `POSScreen.tsx`'s checkout handler,
before the order is built or queued, and carried unchanged through every
retry (in-memory or from the local queue) for that same order attempt.

**Sanity bound (defensive, not a feature in its own right):** the server
action rejects the client-supplied value only as an out-of-bounds guard
against a misconfigured device clock — more than 30 days in the past
(matches the session `maxAge`; nothing legitimate should be queued longer
than that) or more than 5 minutes in the future (small clock-skew
tolerance). Out-of-bounds values fall back to the server's own `now()`
rather than blocking the sale, and the fallback is noted in the order's
existing `migration_notes` field (already used elsewhere in this schema
for this kind of lightweight annotation) so it stays traceable without a
new column. This is expected to fire close to never; it exists only
because trusting a client-supplied timestamp without any bound would be
correctness malpractice, not because device clocks are actually expected
to drift.

## Component 2: Local persisted order queue

**Storage:** a single IndexedDB object store, `pending_orders`, keyed by
request token (the same token `resolvePosCheckoutAttempt` already
generates). No new dependency — IndexedDB's native API is sufficient for
this single, narrow use case. Each record: `{ requestToken, cartInput
(including client_captured_at), queuedAt, attemptCount, lastError }`.

**Flow:**

1. On "Thanh toán", write the record to `pending_orders` *before*
   attempting the network call.
2. Attempt `submitOrderV2` immediately.
3. On success: delete the record, proceed exactly as today (toast,
   draft cleanup).
4. On a network-shaped failure (fetch throws, times out, or otherwise
   never gets a response from the server): leave the record in the queue.
   The cart already clears optimistically (existing behavior) so the
   staff member keeps selling immediately; nothing in the UI indicates a
   problem.
5. On a real rejection (the server actually responded with
   `{ success: false, error }` for a business reason -- not a network
   failure): stop retrying this record. Call a new lightweight server
   action to report the failure (see Component 4) and remove it from the
   local retry queue -- the order is not silently retried forever, and it
   does not vanish either, since it's now recorded server-side as a
   failure needing manual attention.

**Retry triggers:** the browser's `online` event, and a sweep on every
POS page mount (catches cases where the `online` event doesn't fire
reliably on some mobile browsers). No polling interval -- these two
triggers are sufficient and avoid unnecessary battery drain. Multiple
queued orders sync in the order they were originally queued.

## Component 3: Offline app-shell caching

**Mechanism:** a hand-written, minimal service worker (no PWA framework
dependency -- the need is narrow: one route, not the whole app).

- Next.js static assets (`/_next/static/*`): cache-first. Safe because
  Next.js content-hashes these filenames; a cached copy is never stale in
  a way that matters.
- The `/pos` route's document: network-first, falling back to the last
  successfully cached response on failure. Every successful load
  refreshes the cache, so the offline fallback is always "as of the last
  time this device had a connection," not a one-time snapshot.

**Inherent limit (not a gap to close):** a device that has never
successfully loaded `/pos` while online has nothing to fall back to. This
is unavoidable for any web-based offline strategy and does not need a
workaround -- one successful load, any time before the outage, is enough.

## Component 4: Admin "Đơn cần chú ý" (orders needing attention)

**New migration:**

```sql
alter table public.orders_v2 add column if not exists synced_at timestamptz;
```

Set by the order-creation RPC to `now()` at the moment the row is actually
inserted -- distinct from `created_at`, which is now the true client-side
sale moment. The gap between them (`synced_at - created_at`) is exactly
how late a sale was queued before reaching the server.

```sql
create table if not exists public.pos_sync_failures (
  id text primary key,
  request_token text not null,
  cart_payload_json jsonb not null,
  error_message text not null,
  occurred_at timestamptz not null default now(),
  resolved boolean not null default false
);
```

Written by the new "report failure" server action described in Component
2, step 5. RLS enabled, revoked from public/anon/authenticated, granted to
service_role only, matching every other transactional table in this
schema.

**Admin page:** a new read-only section (reusing the existing
admin-dashboard-anomaly convention, e.g. alongside the COGS drift
warnings) listing:

- Orders where `synced_at - created_at` exceeds 5 minutes -- informational,
  no action implied, just visibility into how often and how long sync
  delays actually happen in practice. This threshold is a tunable constant,
  not a business rule; adjust freely if it turns out to be noisy or too
  quiet in practice.
- Unresolved rows from `pos_sync_failures` -- actionable; admin
  investigates and marks resolved once handled (no automated resolution
  workflow, this is a manual review queue by design given how rarely it's
  expected to fire).

## Testing / verification plan

1. Network failure mid-checkout: order is queued, cart clears immediately
   for the next sale, order auto-submits on reconnect with the original
   `client_captured_at` preserved exactly.
2. Cold-start with no network, on a device that previously loaded `/pos`
   successfully: POS opens directly to the sales screen, no login prompt,
   no error.
3. Repeated "Thanh toán" presses on the same cart while offline (staff
   retrying out of impatience): exactly one order is ever created once
   synced, never more.
4. A queued order that gets a genuine rejection on retry (not a network
   error): appears in `pos_sync_failures`, does not retry indefinitely,
   admin page shows it.
5. Regression: full test suite, `tsc`, `next build`, and the existing
   live production audits (order-ledger, P&L/MAC consistency) unaffected,
   since this changes when/how a timestamp and a queue populate `orders_v2`,
   not any COGS or inventory calculation.

## Risk boundary

Touches `lib/order-cart.ts`, `app/pos/actions.ts`, `components/POSScreen.tsx`
(app-level, previously Sonnet-owned) and a new migration + RPC change
(previously Codex-exclusive, now Sonnet 5's per the owner's 2026-07-27
sole-agent decision). New service worker file and IndexedDB helper are new
`lib/`/`public/` additions, not modifications to existing engine files.
