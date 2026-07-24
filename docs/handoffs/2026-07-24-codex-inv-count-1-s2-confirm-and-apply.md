# Handoff — INV-COUNT-1 Phase S2: Confirm-and-Apply (writes Stock_Ledger)

> **READ FIRST**: `docs/COLLABORATION.md`. Design:
> `docs/superpowers/plans/2026-07-24-stocktake-and-daily-digest-plan.md`
> feature 1. Phase S1 (counting workflow) is done — commit `88774a0`,
> migration `0036_stocktake_sessions.sql` (written, **not yet applied** to
> production — needs its own review before `db push`, same as this phase's
> migration).
> Owner decision 2026-07-24: engine-critical write paths go to Codex, not
> Sonnet. This phase writes `Stock_Ledger` directly, so it stays with Codex
> end to end (implementation + review), unlike S1.

## Why

Phase S1 lets an admin walk around and record a physical count per item,
persisted live so counting can be interrupted and resumed. S2 is the step
that turns a finished count into the actual stock correction: recompute
theoretical fresh, show the admin the final variance, and on explicit
confirmation write one `STOCK_ADJUST` row per nonzero-variance item to
`Stock_Ledger`. `STOCK_ADJUST` is the one primitive `lib/full-history-recompute.ts`
trusts as ground truth (`TRUSTED_PRIMITIVE_TYPES`) — a physical count IS
ground truth, which is exactly why this step needs top-tier review before
anything touches production.

## What already exists (S1, read before starting)

- `supabase/migrations/0036_stocktake_sessions.sql`: `stocktake_sessions`
  (status `OPEN`/`CONFIRMED`/`CANCELLED`) and `stocktake_lines`
  (`session_id`, `item_reference`, `item_type`, `counted_qty` nullable,
  `theoretical_at_count` nullable, `counted_at` nullable). RLS enabled,
  `service_role`-only, 3 RPCs already exist: `open_stocktake_session_atomic`,
  `save_stocktake_line_atomic`, `cancel_stocktake_session_atomic`. **This
  migration itself has not been reviewed or applied to production yet —
  review it together with S2's new migration, then both go through
  `supabase db push` in one sitting.**
- `lib/stocktake-transaction.ts`: thin RPC wrappers for the 3 existing RPCs.
- `app/admin/inventory/stocktake/actions.ts` + `page.tsx` +
  `components/StocktakeClient.tsx`: the counting UI. `getStocktakeSessionData()`
  returns the open session with its lines (item name/unit already joined).
- Deliberate S1 design note: `stocktake_lines.theoretical_at_count` is a
  counting-time snapshot (computed fresh per line, at the moment that line
  was saved) — a display aid for the person counting, not the authoritative
  figure. S2 must **not** trust it for the actual write; recompute theoretical
  again fresh, inside S2's own transaction, at confirm time (sales continue
  to happen while counting is in progress — see the plan doc's own reasoning).

## Scope

### 1. New migration — `apply_stocktake_session_atomic` RPC

Model directly on `approve_stock_adjustment_atomic` (migration `0019`) —
read that migration first, do not invent a new costing/write convention.

- Signature: `apply_stocktake_session_atomic(p_session_id text, p_confirmed_by_id text, p_confirmed_by_name text, p_dry_run boolean default false)`.
- Security definer, advisory lock, idempotent: a session already `CONFIRMED`
  refuses re-apply (return its existing result or raise, matching `0019`'s
  own idempotency style — check that migration for the exact pattern used).
- Inside the transaction: lock the session row (`for update`), verify
  `status = 'OPEN'`, lock all its `stocktake_lines` rows. For every line
  with a non-null `counted_qty`: recompute `theoretical_qty` fresh from
  `stock_ledger` (same `coalesce(sum(quantity_change), 0)` pattern used in
  `save_stocktake_line_atomic` and `0033`), compute `variance = counted_qty - theoretical_qty`.
  Lines with zero variance write nothing to `Stock_Ledger` (per the plan).
  Lines the admin never got to (`counted_qty is null`) are simply excluded
  from the write — do not force a count.
- For every nonzero-variance line: insert one `STOCK_ADJUST` row into
  `stock_ledger` with `item_reference`, `quantity_change = variance`,
  `reference_id = p_session_id`, `notes = 'Kiểm kê định kỳ ' || <date>`.
  **`unit_cost` handling must mirror `approve_stock_adjustment_atomic`'s
  existing convention exactly for positive vs. negative adjustments — read
  that migration, do not invent a new costing rule.**
- `p_dry_run = true`: compute and return the full row plan (what would be
  written) without writing anything and without changing session status —
  used by the UI's confirm screen to show the final variance table before
  the admin commits.
- On non-dry-run: after writing all ledger rows, set the session
  `status = 'CONFIRMED'`, `confirmed_at = now()`.
- Grants: `revoke all ... from public, anon, authenticated;
  grant execute ... to service_role;`, matching every other RPC in this repo.

### 2. Wire the RPC into the app

- `lib/stocktake-transaction.ts`: add `applyStocktakeSessionAtomic(input)`
  wrapper, same style as the existing 3 functions in that file.
- `app/admin/inventory/stocktake/actions.ts`: add
  `getStocktakeConfirmPreview(sessionId)` (dry-run call) and
  `confirmStocktakeSession(sessionId)` (real apply), both `requireAdmin()`-gated.
- `app/admin/inventory/stocktake/components/StocktakeClient.tsx`: add a
  "Xác nhận và áp dụng" step — when all countable lines are counted (or the
  admin explicitly chooses to proceed with what's counted so far), show the
  dry-run's final variance table and require an explicit second confirmation
  before calling the real apply. After apply: session becomes read-only,
  link to the created ledger rows (or at minimum show the applied variance
  list — check how `submitStockAdjustment`'s confirmation UI does this for
  precedent).

## Verification bar (per docs/COLLABORATION.md Section E)

- Dry-run parity: the dry-run row plan must exactly equal what non-dry-run
  actually writes (same pattern `apply-pending-backdated-events.ts` and
  similar scripts already verify).
- Live `audit-current-stock.ts` reflects the counted values afterward for
  every applied item.
- `audit-pnl-mac-consistency.ts` unchanged (0 delta) — a stocktake touches
  quantities only, never `cost_at_sale`.
- Full suite + `tsc --noEmit` + `next build` green.
- **Top-tier line-by-line review of both migrations (`0036` + this phase's
  new one) and the full write path is required before `supabase db push`.**
  The owner runs the actual push via `!` as usual — do not attempt to run
  it yourself even after review passes.

## Explicitly out of scope

- Changing anything in phase S1's already-built counting UI beyond adding
  the confirm step described above.
- Any change to `approve_stock_adjustment_atomic` or the existing "Cân bằng
  kho" (ad-hoc single-item adjustment) flow — separate, unrelated feature.
- Cadence/scheduling (owner-triggered only, per the plan; no cron here).

## Stop-and-ping trigger

- Anything that would let a session be applied twice, or let a `Stock_Ledger`
  write happen outside this one RPC.
- Any theoretical/variance number that doesn't trace directly to a fresh
  `stock_ledger` sum computed inside this transaction.
