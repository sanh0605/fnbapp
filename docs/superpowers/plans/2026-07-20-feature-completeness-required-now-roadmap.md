# Feature-Completeness — REQUIRED_NOW Completion Roadmap

Scopes the 3 gaps confirmed `REQUIRED_NOW` in
`docs/audits/2026-07-20-feature-completeness-fnb-checklist-reconciliation.md`.
**This is a scope/sequencing proposal, not an implementation plan** — per
the audit program's own exit criteria, the owner approves scope and
priority here before any handoff or code starts.

## Sequencing recommendation

Ordered by risk and size, smallest/safest first — not by checklist order:

1. **Low-stock / reorder-level warning** — additive, read-mostly, no
   change to any existing write path. Lowest risk, smallest scope.
2. **Shift and cash reconciliation** — new tables and new POS flow
   (open/close shift), but doesn't change how an existing order is
   written — orders gain an optional `shift_id` reference, nothing about
   `submitOrderV2`'s core logic changes.
3. **Split/mixed payment on one order** — touches the core atomic
   checkout RPC (`create_pos_order_atomic`) directly, the same
   transaction Gate 5 just added idempotency to. Highest risk, should go
   last and get the most careful review, on its own branch, independent
   of the other two.

## 1. Low-stock / reorder-level warning

**Schema**: add `reorder_level` (numeric, nullable) to `base_ingredients`,
`purchased_items`, and `semi_products`. Nullable and defaulting to "no
warning" preserves every existing row's behavior — this is why it's
low-risk.

**Server**: extend the existing stock-balance computation
(`lib/inventory-consumption.ts`, already used by `INV-STOCK-BALANCE`) to
flag items where current stock ≤ `reorder_level`. No new transaction, no
new atomicity concern — this reads data that's already computed.

**UI**: an admin form field to set `reorder_level` per item (alongside
existing item edit forms); a low-stock indicator on `/admin/reports/stock`
(badge or filter, reusing the existing report page rather than a new
route).

**Rough size**: 1 migration (3 nullable columns), 1 lib function
extension, 2-3 admin form edits, 1 report UI addition. Similar size to a
single Gate-4-style remediation item.

## 2. Shift and cash reconciliation

**Schema**: 2 new tables.

- `shifts`: `id`, `brand_id`, `opened_by` (actor), `opened_at`,
  `opening_cash`, `closed_by`, `closed_at`, `closing_cash_counted`,
  `expected_cash` (computed at close), `variance` (computed), `status`
  (`OPEN`/`CLOSED`), `notes`.
- `cash_movements`: `id`, `shift_id`, `type` (`CASH_IN`/`CASH_OUT`),
  `amount`, `reason`, `actor`, `created_at` — for cash movements that
  aren't sales (e.g. paying a supplier in cash, owner withdrawal).

`orders_v2` gains an optional `shift_id` column (nullable — legacy/no-shift
orders keep working, same backward-compatibility pattern Gate 5 used for
`client_request_id`).

**Server**: `openShift`/`closeShift` actions. Closing a shift computes
`expected_cash = opening_cash + cash sales during the shift (by shift_id)
+ cash_in - cash_out`, compares to `closing_cash_counted`, stores
`variance`. This is a financial calculation but not a multi-table atomic
write the way checkout is — `shifts`/`cash_movements` are simpler,
lower-stakes tables than `orders_v2`/`stock_ledger`.

**UI**: POS gains an open-shift gate at the start of a session (owner
decides: mandatory before selling, or optional/skippable — this is a
business-flow decision to make explicitly, not assume) and a close-shift
screen with cash count entry. Admin gains a shift history list and a
cash-movement log.

**Rough size**: 1-2 migrations, 4-6 new server actions, 1 new POS screen
flow, 1-2 new admin views. Comparable in size to Gate 5's idempotency
work, plus UI.

**Open question for the owner**: should opening a shift be *mandatory*
before a cashier can start selling, or optional or purely a
back-office tool for someone reviewing at the end of the day? This
changes the POS flow materially and should be decided before
implementation, not assumed.

## 3. Split/mixed payment on one order

**Schema**: new `order_payments` table (`id`, `order_id`, `method`,
`amount`, `reference`/note) replacing the single `payment_method` field's
role as the source of truth for how an order was actually paid.
`orders_v2.payment_method` likely stays for backward compatibility
(existing orders, existing reports) but new orders write to
`order_payments` instead, with the single-method case becoming "exactly
one row."

**Server**: `create_pos_order_atomic` (the RPC Gate 5 already hardened
with idempotency) needs to accept an array of payments instead of one
method + amount, and validate they sum to the order total inside the
same transaction. This is the highest-risk change in this roadmap
because it modifies the core checkout RPC directly — needs the same
rigor as Gate 4/5's atomic-RPC work (forced-failure tests, live
verification, no change to the idempotency behavior Gate 5 just added).

**Reports**: `RPT-SALES`'s payment-method breakdown needs to attribute
revenue per payment line, not per order, once split payments exist —
otherwise a split order would double-count or misattribute revenue by
method. This is a real, easy-to-miss correctness risk worth flagging now
rather than discovering after ship.

**UI**: POS checkout payment step needs a way to add multiple
payment lines (method + amount) until they sum to the total, instead of
picking one method.

**Rough size**: 1 migration, 1 RPC modification (careful, high-scrutiny),
1 report-math change, 1 POS UI flow change. Comparable in risk to a Gate
4 Phase B item — should go through the same forced-failure-test rigor.

## What this roadmap does NOT include

- No UI/UX redesign — that's a separate, later phase per
  `docs/ROADMAP.md`'s "Future direction," even though the owner has
  already described the visual direction they want (modern, warm tones,
  soft buttons) for when that phase starts.
- No multi-outlet scope creep — `shift_id`/`cash_movements` are scoped to
  the current single-outlet model; if multi-outlet arrives later, these
  tables gain an `outlet_id` then, not now.
- No new UI screens beyond what's named above — e.g., no dashboard
  redesign, no new nav sections beyond what each feature strictly needs.

## Approval needed before implementation starts

1. Confirm the sequencing (low-stock → shift/cash → split payment) or
   reorder it.
2. Answer the open question in section 2 (mandatory vs. optional shift
   open).
3. Decide who implements: this fits Codex's normal ownership (`lib/*.ts`,
   `supabase/migrations/*.sql`, server actions) with Antigravity for the
   POS/admin UI pieces, same split as every gate this cycle — confirm or
   redirect.
