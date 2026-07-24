# Plan — Periodic Guided Stocktake (INV-COUNT-1) + Daily Summary (RPT-DIGEST-1)

Date: 2026-07-24
Status: owner-approved same day ("Duyệt luôn kiểm kê định kỳ và tổng kết cuối ngày")
Author: Claude coordinator (plan only). Implementer: **Claude Sonnet 5** per owner
decision. Review gates below follow `docs/COLLABORATION.md` (2026-07-24 lineup):
routine phases = Sonnet implements + coordinator reviews; the one engine-critical
phase requires **top-tier line-by-line review before apply** (Codex `gpt-5.6-sol`
High or the coordinator) — Sonnet may implement it, but it does not self-approve.

---

## Feature 1 — INV-COUNT-1: Periodic guided stocktake (kiểm kê định kỳ)

### Why (owner value)

Every negative-stock incident in this system's history traces to theoretical
stock never being reconciled with physical reality on a schedule. Today's
"Cân bằng kho" fixes one item reactively; the shift check counts only 2 items.
This feature makes a full count a guided, repeatable routine.

### Design

Reuse-first: theoretical stock comes from the same ledger-sum used by
`getRealtimeStock`; the write path reuses the STOCK_ADJUST convention.
STOCK_ADJUST is deliberately the single trusted primitive in
`lib/full-history-recompute.ts` (`TRUSTED_PRIMITIVE_TYPES`) — a physical count
IS ground truth, which is exactly why the write phase is engine-critical and
why timestamps must be honest (never backdated; a late entry goes through the
backdated-events flow like everything else).

**Phase S1 — counting workflow (routine tier; Sonnet implements, coordinator
reviews; the migration file itself additionally needs top-tier line-by-line
review before `db push` per the migration rule):**

1. Migration `00xx_stocktake_sessions.sql`: two new tables, no existing table
   touched, no ledger writes:
   - `stocktake_sessions` (id `STK-...` sequential like `SHF-`, status
     OPEN/CONFIRMED/CANCELLED, created_at, created_by, confirmed_at, notes);
   - `stocktake_lines` (session_id, item_reference, item_type, counted_qty
     nullable = not yet counted, theoretical_at_count, counted_at).
   Follow migration `0033_shift_stock_checks.sql` as the house pattern
   (security definer RPCs, service-role only, advisory lock, sequential ids).
2. Page `/admin/inventory/stocktake` (ADMIN-only): create/open a session;
   list ALL inventory-tracked items (base ingredients where
   `is_non_inventory` false + all semi-products) with unit and theoretical
   stock; enter counted qty per item (persisted per line as you go — counting
   gets interrupted in real life); variance column (counted − theoretical) and
   variance value (qty × current MAC, display-only) appear live.
   Vietnamese labels throughout; mirror `StockTable`'s responsive pattern.
3. A session left OPEN shows a resume banner. CANCEL allowed while OPEN.

**Phase S2 — confirm-and-apply (ENGINE-CRITICAL: writes `Stock_Ledger`).**

1. Atomic RPC `apply_stocktake_session(session_id, dry_run)`, modeled on
   `approve_stock_adjustment_atomic` (migration `0019`) + `0033`'s guards:
   security definer, advisory lock, idempotent (CONFIRMED session refuses
   re-apply), recomputes theoretical per item INSIDE the transaction at
   confirm time (sales may have happened since counting; show the final
   variance for approval before write), writes one STOCK_ADJUST ledger row per
   nonzero-variance item with `reference_id = session id` and reason
   "Kiểm kê định kỳ <date>", zero-variance items write nothing.
2. `unit_cost` handling for positive adjustments must mirror the existing
   `approve_stock_adjustment_atomic` convention exactly — read that migration
   first, do not invent a new costing rule.
3. UI: confirm screen shows the final variance table and requires an explicit
   re-confirmation. After apply: session immutable, link to the created
   ledger rows.
4. Verification bar: dry-run parity (dry-run row plan == applied rows), live
   `audit-current-stock.ts` reflects counted values afterward,
   `audit-pnl-mac-consistency.ts` unchanged (0 delta — stocktake touches
   quantities, never `cost_at_sale`), full suite + `tsc` + build green.
   **Top-tier line-by-line review of the RPC migration + write path before
   `supabase db push` (owner runs the push via `!` as usual).**

Cadence: owner-triggered (recommend monthly, after close). A reminder hook can
ride on RPT-DIGEST-1 phase D2 later.

---

## Feature 2 — RPT-DIGEST-1: Daily summary (tổng kết cuối ngày)

### Design

**Phase D1 — on-demand daily summary (routine tier; Sonnet implements,
coordinator reviews; read-only, no schema change):**

1. New "Tổng kết ngày" view (own page `/admin/reports/daily` — per the owner's
   pages-over-popups preference), date picker defaulting to today,
   Asia/Ho_Chi_Minh day bounds via the existing `lib/report-time.ts` helpers.
2. Content, reusing existing actions/queries wherever they exist (extend, do
   not duplicate report math): revenue + order count + average order value;
   comparison vs yesterday and vs same weekday last week; top 5 items by
   quantity; payment-method split (per `order_payments` line attribution, the
   `RPT-SALES` convention); low-stock/reorder list (reuse
   `getReorderSuggestions`); attention flags (current negative-stock items,
   pending backdated events count).
3. Scoped queries only (date-bounded — follow the dashboard's `findAllWhere`
   pattern, never full-table).

**Phase D2 — scheduled push (DEFERRED, needs two owner inputs):** delivery
channel (email/Zalo/none — same decision as the W5.3 alerting item) and
`CRON_SECRET` set in Vercel (still outstanding). When both exist: a cron route
renders D1's data for "yesterday" and sends it. Do not start D2 until the
owner picks the channel.

---

## Sequencing for Sonnet

`WF-1` (already handed off) → `INV-COUNT-1 S1` → review → `S2` (with top-tier
gate) → `RPT-DIGEST-1 D1`. One commit per phase item, prefix
`Claude-Sonnet <type>:`, no push, stop-and-ping on anything ambiguous —
especially any temptation to write ledger rows outside the S2 RPC.
