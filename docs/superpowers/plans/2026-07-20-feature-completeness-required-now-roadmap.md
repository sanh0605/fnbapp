# Feature-Completeness — REQUIRED_NOW Completion Roadmap

Scopes the 3 gaps confirmed `REQUIRED_NOW` in
`docs/audits/2026-07-20-feature-completeness-fnb-checklist-reconciliation.md`.
Revised 2026-07-20 per owner review: sequencing, scope, and assignment
below are now the approved plan, not a proposal — see "Owner decisions"
at the bottom for exactly what was confirmed.

## Sequencing (owner-confirmed, revised from the original size/risk-based order)

1. **Split/mixed payment on one order** — build first. Confirmed to
   happen in practice; owner wants this ahead of the other two despite
   it touching the core atomic checkout RPC.
2. **Smart low-stock detection + reorder-quantity suggestion** — owner
   wants this to be more than a static threshold: the system should
   determine what "low" means from actual consumption, and suggest how
   much to reorder, not just flag a number.
3. **Shift and cash reconciliation** — moved to last. There is currently
   no staff (owner operates solo), so shift-level cash accountability
   between multiple cashiers isn't an active problem yet. Deprioritized
   accordingly, not dropped.

## Assignment (owner-confirmed)

- **Logic/backend for all 3**: Claude, standing in for Codex until its
  rate limit resets (2026-07-25), same temporary-coverage arrangement as
  the Gate 8 stop-gate and script fixes. Codex reviews retroactively when
  back, same as `REV-2`.
- **UI**: Antigravity, as with every prior gate — but functional/minimal
  only for now. The owner explicitly wants these features' visual design
  bundled into the later full frontend/UI/UX redesign phase (modern,
  warm tone, soft buttons, one consistent design system across the whole
  app) rather than styled now and restyled again later. Build whatever
  UI is strictly needed to use each feature; do not invest in polish that
  the redesign phase will replace anyway.

## 1. Split/mixed payment on one order

**Schema**: new `order_payments` table (`id`, `order_id`, `method`,
`amount`, `reference`/note) becomes the source of truth for how an order
was actually paid. `orders_v2.payment_method` stays for backward
compatibility with existing orders/reports; new orders write to
`order_payments` instead, with the single-method case being "exactly one
row."

**Server**: `create_pos_order_atomic` (the RPC Gate 5 just hardened with
an idempotency token) needs to accept an array of payments instead of one
method + amount, and validate they sum to the order total inside the same
transaction. Highest-risk change in this roadmap — modifies the core
checkout RPC directly. Needs the same rigor as Gate 4/5's atomic-RPC
work: forced-failure tests, live verification, and confirmation that
Gate 5's idempotency behavior is unaffected.

**Reports**: `RPT-SALES`'s payment-method breakdown must attribute
revenue per payment line, not per order, once split payments exist —
otherwise a split order double-counts or misattributes revenue by
method. Flagged as an easy-to-miss correctness risk.

**UI (minimal, Antigravity)**: POS checkout payment step needs a way to
add multiple payment lines (method + amount) until they sum to the
total. Functional only — no redesign investment.

## 2. Smart low-stock detection + reorder-quantity suggestion

Redesigned per owner feedback — not a static per-item threshold field,
but a computed suggestion:

**Approach**:

1. Compute each item's average daily consumption from `stock_ledger`'s
   `SALES_CONSUME` rows (plus production-consume for semi-product
   ingredients) over a lookback window (proposed default: 14 days,
   adjustable).
2. Estimate lead time from historical `purchase_orders` (gap between
   order creation and receipt) per item/supplier where history exists;
   fall back to a configurable default (proposed: 3 days) where it
   doesn't.
3. Reorder point = average daily consumption × lead time × a safety
   buffer (proposed: 1.3x). "Low stock" = current stock ≤ reorder point.
4. Suggested reorder quantity = (target coverage days × average daily
   consumption) − current stock, proposed target coverage default: 10
   days, rounded to the item's purchase unit using existing UOM
   conversions.

This is a heuristic/forecasting feature, not a deterministic one — it
should present as a *suggestion* an operator reviews, never an automatic
purchase order. Items with too little sales/purchase history to compute
a meaningful rate should show "not enough data" rather than a
misleadingly confident number.

**Server**: new `lib/reorder-suggestion.ts` computing the above from
existing `stock_ledger`/`purchase_orders` data — read-only, no new
write path, no atomicity concern.

**UI (minimal, Antigravity)**: a low-stock/reorder view (extends
`/admin/reports/stock` or a new lightweight page) showing current stock,
computed reorder point, and suggested quantity; ideally pre-fills
quantity when creating a new purchase order for that item, but that
integration can follow once the core calculation is proven correct.

**Open parameters** (proposed defaults above, adjustable by the owner
once the first version is running and the numbers can be sanity-checked
against real data): lookback window, safety buffer, target coverage days.

## 3. Shift and cash reconciliation (last priority)

**Schema**: 2 new tables.

- `shifts`: `id`, `brand_id`, `opened_by`, `opened_at`, `opening_cash`,
  `closed_by`, `closed_at`, `closing_cash_counted`, `expected_cash`
  (computed at close), `variance` (computed), `status`
  (`OPEN`/`CLOSED`), `notes`.
- `cash_movements`: `id`, `shift_id`, `type` (`CASH_IN`/`CASH_OUT`),
  `amount`, `reason`, `actor`, `created_at`.

`orders_v2` gains an optional `shift_id` column (nullable, same
backward-compatible pattern as Gate 5's `client_request_id`).

**Server**: `openShift`/`closeShift` actions computing
`expected_cash = opening_cash + cash sales during the shift + cash_in -
cash_out`, compared against `closing_cash_counted` to produce `variance`.

**UI (minimal, Antigravity)**: **owner-confirmed: opening a shift is
mandatory before a cashier can start selling** — the POS gains a
mandatory open-shift gate (cash count entry) before the sale screen, and
a close-shift screen at end of shift. Functional only, same as the other
two — full styling deferred to the redesign phase.

## What this roadmap does NOT include

- No UI/UX redesign investment in any of these 3 features — confirmed
  bundled into the later full frontend/UI/UX phase.
- No multi-outlet scope creep — `shift_id`/`cash_movements` scoped to the
  current single-outlet model.
- No automatic purchase-order creation from the reorder suggestion —
  it's a suggestion an operator acts on, not an automated purchase.

## Owner decisions confirmed 2026-07-20

- Sequencing: split payment → smart low-stock/reorder suggestion →
  shift/cash reconciliation (deprioritized to last — no current staff
  makes shift-level accountability a non-issue for now).
- Low-stock feature scope expanded from a static threshold to a
  computed suggestion (consumption-rate-based reorder point + suggested
  quantity).
- Shift opening is mandatory before POS selling, when that item's turn
  comes.
- Claude covers Codex's logic/backend role for all 3 during its
  rate-limit window (until 2026-07-25); Codex reviews retroactively when
  back. Antigravity builds functional-only UI for all 3; visual design
  work is deferred to the later frontend/UI/UX redesign phase rather than
  built and then redone.
