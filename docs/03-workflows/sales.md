# Sales flow (POS, orders, promotions)

```flow-decl
routes: /pos, /admin/orders, /admin/promotions
files: app/pos/actions.ts, lib/void-order-transaction.ts, app/admin/promotions/actions.ts
tables: POS_Drafts, Pos_Sync_Failures, orders_v2, order_events, Promotions
brCodes: BR-SALE-002, BR-SALE-003, BR-SALE-004, BR-SALE-005, BR-SALE-006
```

This flow covers selling: the till screen at `/pos` where an order is built and
sent, the order history at `/admin/orders`, and the promotion catalog at
`/admin/promotions`. The key thing to understand is that **the web app is not
where a completed sale is written.** The `/pos` screen only persists drafts and
records a failure marker when a submit does not go through; the finished,
`COMPLETED` order arrives in `orders_v2` through the POS device sync, not through
these server actions. Voids are the one order-lifecycle write the web app makes,
and they run through the `void_order_atomic` database function called from
`lib/void-order-transaction.ts`.

## Five-question current-state description

1. **States, and how each is set.** An order in `orders_v2` is versioned, not
   overwritten. A fresh sale is `COMPLETED`. Editing an order does **not** mutate
   the existing row: it writes a **new** `COMPLETED` row and flips the previous
   one to `SUPERSEDED`, and **both versions keep the same order code** (spec
   §10; `BR-SALE-006`). So one order code can map to several rows, exactly one of
   which is the live `COMPLETED` version (its `superseded_by` empty). A void marks
   the order voided and books the matching inventory effect through
   `void_order_atomic`, leaving an event trail rather than a silent status flip
   (`BR-SALE-003`). A POS draft (`POS_Drafts`) is a separate, pre-sale state: open
   while the cashier is still building the cart, deleted once the cart is sent.
2. **Buttons per screen, and when to hide them.** `/pos` builds a cart, saves and
   restores drafts, and sends the order; its brand is derived server-side from the
   chosen outlet and is never taken from the client (`BR-SALE-006`), so no
   brand picker drives the sale. `/admin/orders` lists past orders and offers void
   and edit on a live order; void and edit should not be offered on a row that is
   already `SUPERSEDED` or already voided, since acting on a stale version would
   fork the order's history. `/admin/promotions` creates, edits, and deactivates
   promotions; a promotion already referenced by historical orders is deactivated,
   not hard-deleted, so past orders keep explaining their own totals.
3. **What each list contains, and what is excluded.** `/admin/orders` shows
   orders; revenue and audit views over it must filter to the live version only —
   `status = 'COMPLETED'` **and** `superseded_by` empty — or the same sale is
   counted once per version (`BR-SALE-004`, spec §10). `SUPERSEDED` and voided rows
   are kept for traceability but excluded from revenue. `/admin/promotions` lists
   promotion definitions, including deactivated ones, because they are still needed
   to interpret older orders.
4. **Valid inputs, and what happens outside the range.** The order code is 12
   digits — `YYMMDD` (`Asia/Ho_Chi_Minh`) + 3-digit outlet + 3-digit daily
   sequence — minted under a per-(outlet, date) lock; an edit reuses the original
   group's code, date and outlet rather than the editor's own (`BR-SALE-006`,
   `BR-SALE-002`). A promotion needs a value and a validity window; the till
   applies only an active promotion whose window covers the sale. A submit that
   cannot reach the sync path is not lost silently: `/pos` writes a row to
   `Pos_Sync_Failures` so the failure is visible and recoverable rather than a
   dropped sale.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   order capture, order history, and promotions. It deliberately does **not**
   write the completed sale from the web app — that is the POS device sync's job;
   the web `/pos` action only touches `POS_Drafts` and `Pos_Sync_Failures`. It
   deliberately does **not** deduct stock or compute cost at sale time: since the
   2026-08-07 cutover a sale records no cost of goods, which is measured later when
   stock leaves the warehouse (see `docs/03-workflows/stock-issue.md`). And it does
   not re-derive revenue for the earliest months: money received before 2026-07-19
   has no independent record and is closed as unverifiable, never silently upgraded
   to audited (`BR-SALE-005`).

## Where it writes

- `app/pos/actions.ts` writes only `POS_Drafts` (insert/update/remove of the
  in-progress cart) and `Pos_Sync_Failures` (a marker when a submit does not sync).
  It does not write `orders_v2`.
- `lib/void-order-transaction.ts` calls the `void_order_atomic` RPC, whose body
  writes `orders_v2` and `order_events` — the two write relations the generated
  map attributes to this file.
- `app/admin/promotions/actions.ts` writes `Promotions`.

The completed sale itself lands in `orders_v2` via the POS device sync path, which
is outside this flow's declared files; the supersede/void model above governs how
those rows are versioned once they arrive.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
