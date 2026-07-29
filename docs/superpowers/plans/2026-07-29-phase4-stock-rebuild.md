# Phase 4 Implementation Plan: Rebuild Stock

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete every derived `stock_ledger` row and recompute it from source
(recipes + sales orders + purchase orders) for **all** orders, then rebuild
`inventory_balances`, and verify the result item by item.

**Architecture:** Reuse the existing replay engine
(`lib/full-history-recompute.ts`) and the transactional
`rebuild_stock_ledger_for_order` RPC (migration 0034) unchanged. Two things
change: the order set widens from correction-touched orders to all orders, and
this phase writes **stock rows only** — `cost_at_sale` is not touched here.
Money moves in Phase 5, behind its own owner review gate.

**Tech Stack:** TypeScript, Vitest, Supabase JS client, PostgreSQL RPCs.
Runner is `npx vite-node`.

**Spec:** `docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`, Phase 4.

**Implementer:** Claude Sonnet 5, with two owner-gated steps marked below.

## Global Constraints

- **No writes to production until Task 4**, and only after the owner approves
  the Task 3 dry-run summary.
- `cost_at_sale` is **not** written in this phase. Every RPC call passes
  `p_cost_changes: []`.
- Source data is never written: `recipes`, `orders_v2`, `order_lines_v2`,
  `purchase_orders`, `purchase_order_lines`, and `stock_ledger` rows of type
  `PO_RECEIPT` / `STOCK_ADJUST` / `INITIAL_BALANCE`.
- Owner-facing output in Vietnamese using **real ingredient names**, never codes
  (`CLAUDE.md` section 7). Code and comments in English.
- No new dependencies. Lodash is not installed. No emojis.
- Verification bar: `npx tsc --noEmit` clean, full suite green.
- Commit locally with the `Claude-Sonnet ` prefix. Do not push.

---

## Preconditions and what changed since the plan was written

**The 63-commit deploy is live** (`6ebe8a0..9ae2ce5`, pushed 2026-07-29). This
matters because the non-inventory engine fix must be running in production
before the rebuild — otherwise old code would immediately re-write consumption
rows for Nước, Nước sôi and Đá viên on the next sale and undo part of the work.

**The owner chose to skip the plan's manual POS verification (step 3) and the
one-day soak (step 4).** That is his call and this plan proceeds on it, but the
one precondition Phase 4 genuinely depends on is cheap to check from a read-only
query rather than by hand at the till. Task 0 does exactly that.

---

### Task 0: Confirm the deployed engine before touching anything

**Files:** none — read-only verification.

- [ ] **Step 1: Confirm the live build is the new one**

Confirm in the Vercel dashboard that the deployment built from `9ae2ce5`
succeeded and is the current production deployment. If the build failed,
production is still serving `6ebe8a0` and **this plan stops here** — report and
fix the build first.

- [ ] **Step 2: Prove the non-inventory fix is actually live (read-only query)**

Query `stock_ledger` for rows where `transaction_type = 'SALES_CONSUME'` and
`item_reference` is one of the ingredients the owner flagged non-inventory
(Nước, Nước sôi, Đá viên), created **after** the deploy timestamp.

Expected: zero rows. A non-zero count means the deployed code is still writing
them, and rebuilding now would be undone by the next day of trading. **Stop and
report** if any are found.

- [ ] **Step 3: Confirm no unapplied migrations**

Run: `npx supabase migration list`. Local and remote must match through 0041.

- [ ] **Step 4: Report to the owner in Vietnamese**

Two sentences: whether the new code is live, and whether the water/ice fix is
confirmed working on real production rows. No commit for this task.

---

### Task 1: Stop the rebuild from tripping the backdated-entry detector

**Files:**
- Create: `supabase/migrations/0042_suppress_backdated_detection_during_rebuild.sql`
- Create: `lib/rebuild-suppression-migration.test.ts`

**Why this task exists — read before implementing.**

`detect_backdated_ledger_entry` is an `after insert ... for each row` trigger on
`stock_ledger` (migration 0014). It flags any inserted row whose
`transaction_type` is in `('PO_RECEIPT', 'STOCK_ADJUST', 'PRODUCTION_YIELD',
'INITIAL_BALANCE')` and whose `created_at` is older than five minutes.

The rebuild inserts `PRODUCTION_YIELD` rows carrying **historical**
`created_at` values, for every order in history. Each one will create a
`backdated_ledger_events` row.

That is not a cosmetic problem. `/api/cron/apply-backdated-corrections` runs
daily at `0 20 * * *` UTC — 03:00 Vietnam time, a few hours after a night
rebuild — and it **auto-applies** any plan it does not classify as anomalous
(`app/api/cron/apply-backdated-corrections/route.ts:158`). Because this phase
deliberately leaves `cost_at_sale` stale for Phase 5, those spurious events
would each compute a real cost delta and write it. The result: costs partially
rewritten overnight, unreviewed, bypassing both the owner's P&L review gate and
the deliberate `audit_baseline_locks` release that Phase 5 exists to record.
That is the shape of the COGS-5 incident, arrived at from a new direction.

The escape hatch already exists and is the designed one. Migration 0014 has:

```sql
-- Skip during recovery because replay writes old timestamps intentionally.
if current_setting('app.mac_drift_recovery', true) = 'on' then
  return new;
end if;
```

The other recovery RPCs set it (`0030_harden_backdated_event_recovery_against_locks.sql:129`
and `:294`). `rebuild_stock_ledger_for_order` (migration 0034) does **not** —
that is the gap.

- [ ] **Step 1: Write the failing test**

Follow the existing migration-text test style
(`lib/inventory-balance-migration.test.ts`, `lib/gate3-database-hardening-migration.test.ts`):

```typescript
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/0042_suppress_backdated_detection_during_rebuild.sql";

describe("migration 0042", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("redefines rebuild_stock_ledger_for_order", () => {
    expect(sql).toContain("function public.rebuild_stock_ledger_for_order");
  });

  it("suppresses backdated detection for the duration of the transaction", () => {
    expect(sql).toContain("set_config('app.mac_drift_recovery', 'on', true)");
  });

  it("keeps the RPC restricted to service_role", () => {
    expect(sql).toContain("revoke all on function");
    expect(sql).toContain("to service_role");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/rebuild-suppression-migration.test.ts`
Expected: FAIL — the migration file does not exist.

- [ ] **Step 3: Implement the migration**

Copy the full current body of `rebuild_stock_ledger_for_order` from
`supabase/migrations/0034_rebuild_stock_ledger_from_scratch.sql` into a
`create or replace function` and add **one line**, immediately after the
existing `perform set_config('lock_timeout', '5s', true);`:

```sql
  -- Replay writes historical created_at values on purpose. Without this, the
  -- detect_backdated_ledger_entry trigger records a backdated event for every
  -- PRODUCTION_YIELD row the rebuild inserts, and the nightly
  -- apply-backdated-corrections cron then auto-applies cost changes that this
  -- phase deliberately defers to Phase 5. Transaction-scoped (is_local = true).
  perform set_config('app.mac_drift_recovery', 'on', true);
```

Change nothing else in the function. Re-apply the same `revoke`/`grant` lines
the original migration ends with.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run` and `npx tsc --noEmit`. Both must be clean.

- [ ] **Step 5: Apply the migration to production**

Run: `npx supabase db push`. Confirm 0042 appears in `npx supabase migration list`
on both sides. This is a function definition change only — no data is touched.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0042_suppress_backdated_detection_during_rebuild.sql lib/rebuild-suppression-migration.test.ts
git commit -m "Claude-Sonnet fix: suppress backdated-entry detection inside the stock ledger rebuild RPC"
```

- [ ] **Step 7: Fold the same finding into the restore runbook**

`docs/runbooks/restore-from-backup.md` has the identical exposure — a real
restore inserts historical rows and would fire the same trigger. Add a short
section telling the operator to set `app.mac_drift_recovery` for the restore
session (or, if the restore path cannot set it, to truncate
`backdated_ledger_events` and `backdated_recipe_events` afterwards and confirm
the cron found nothing to apply). This closes the item raised on 2026-07-29 and
never actioned.

```bash
git add docs/runbooks/restore-from-backup.md
git commit -m "Claude-Sonnet docs: restore runbook must suppress backdated detection"
```

---

### Task 2: Build the all-orders rebuild script

**Files:**
- Create: `lib/phase4-rebuild-scope.ts`
- Create: `lib/phase4-rebuild-scope.test.ts`
- Create: `scripts/apply-phase4-stock-rebuild.ts`

**Interfaces:**
- Consumes: `buildTrustedPrimitiveLedger`, `replayFullHistory` from
  `lib/full-history-recompute`; the `rebuild_stock_ledger_for_order` RPC.
- Produces: `selectRebuildableOrders(input): RebuildScope` — used by Task 3's
  dry run and Task 4's apply.

**Why a new script rather than editing the existing one.**
`scripts/apply-full-history-stock-ledger-rebuild.ts` documents, in its header
and its scoping logic, a specific operation that was already run on 2026-07-24
against a deliberately narrow order set. Rewriting it in place destroys the
record of what that run did. Leave it untouched.

**The defect this task must not inherit.**
`replayFullHistory` returns an `errors` array. A line that throws is pushed to
`errors` and **skipped**, while its order is still rebuilt from the remaining
lines (`lib/full-history-recompute.ts:284-289`). Under the old narrow scope that
was contained. At all-orders scope it is dangerous: the order's entire derived
row set is deleted and replaced with a set that silently omits the failed line's
consumption, understating usage forever with no trace.

**Therefore: any order with at least one replay error is excluded from the
rebuild entirely.** Its existing rows stay as they are and it is reported by
name for the owner. Partial rebuild of an order is never acceptable.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { selectRebuildableOrders } from "./phase4-rebuild-scope";

describe("selectRebuildableOrders", () => {
  it("includes every order that replayed without error", () => {
    const scope = selectRebuildableOrders({
      allOrderIds: ["ORD-1", "ORD-2"],
      replayErrors: [],
      computedRowsByOrder: new Map([
        ["ORD-1", [{ item_reference: "ING-001" }]],
        ["ORD-2", [{ item_reference: "ING-002" }]],
      ]),
    });
    expect(scope.rebuildOrderIds).toEqual(["ORD-1", "ORD-2"]);
    expect(scope.excludedOrderIds).toEqual([]);
  });

  it("excludes an entire order when any of its lines failed to replay", () => {
    const scope = selectRebuildableOrders({
      allOrderIds: ["ORD-1", "ORD-2"],
      replayErrors: ["ORD-2/LINE-9: no recipe snapshot"],
      computedRowsByOrder: new Map([
        ["ORD-1", [{ item_reference: "ING-001" }]],
        ["ORD-2", [{ item_reference: "ING-002" }]],
      ]),
    });
    expect(scope.rebuildOrderIds).toEqual(["ORD-1"]);
    expect(scope.excludedOrderIds).toEqual(["ORD-2"]);
    expect(scope.exclusionReasons.get("ORD-2")).toContain("no recipe snapshot");
  });

  it("excludes an order that produced no computed rows at all", () => {
    const scope = selectRebuildableOrders({
      allOrderIds: ["ORD-1"],
      replayErrors: [],
      computedRowsByOrder: new Map(),
    });
    expect(scope.rebuildOrderIds).toEqual([]);
    expect(scope.excludedOrderIds).toEqual(["ORD-1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/phase4-rebuild-scope.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/phase4-rebuild-scope.ts`**

```typescript
export type RebuildScopeInput = {
  allOrderIds: string[];
  replayErrors: string[];
  computedRowsByOrder: Map<string, unknown[]>;
};

export type RebuildScope = {
  rebuildOrderIds: string[];
  excludedOrderIds: string[];
  exclusionReasons: Map<string, string>;
};

/**
 * Replay errors are reported as "<order_no or order_id>/<line_id>: <message>".
 * An order with any failed line is excluded outright: rebuilding it would
 * delete its full derived row set and reinsert one missing that line's
 * consumption, which is silently wrong and unrecoverable without another
 * rebuild.
 */
export function selectRebuildableOrders(input: RebuildScopeInput): RebuildScope {
  const reasons = new Map<string, string>();
  for (const error of input.replayErrors) {
    const orderKey = error.split("/")[0];
    if (!orderKey) continue;
    if (!reasons.has(orderKey)) reasons.set(orderKey, error);
  }

  const rebuildOrderIds: string[] = [];
  const excludedOrderIds: string[] = [];
  for (const orderId of input.allOrderIds) {
    const failed = reasons.has(orderId);
    const rows = input.computedRowsByOrder.get(orderId) || [];
    if (failed || rows.length === 0) {
      excludedOrderIds.push(orderId);
      if (!reasons.has(orderId)) reasons.set(orderId, "replay produced no rows");
      continue;
    }
    rebuildOrderIds.push(orderId);
  }

  return { rebuildOrderIds, excludedOrderIds, exclusionReasons: reasons };
}
```

**Note on the error key.** `replayFullHistory` builds the prefix from
`order.order_no || order.id`. Match on the same value the script uses for
`allOrderIds`, or map `order_no` back to `id` before calling. Verify with a real
dry run that no order is wrongly excluded because of an id/order_no mismatch —
a silent mismatch here would exclude everything or nothing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/phase4-rebuild-scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `scripts/apply-phase4-stock-rebuild.ts`**

Model it on `scripts/apply-full-history-stock-ledger-rebuild.ts` with these
differences:

1. `allOrderIds` is **every** order in `Orders_V2`, not the correction-touched
   subset. There is no `isClaudeInserted` filter.
2. Scope comes from `selectRebuildableOrders`.
3. **Every RPC call passes `p_cost_changes: []`.** Do not compute cost changes,
   do not read `audit_baseline_locks`. Phase 5 owns costs.
4. `p_expected_delete_count` is the count of derived rows for that order in the
   snapshot the script just read. If the RPC rejects the count, that order had a
   concurrent write — record it as a failure and continue, do not retry.
5. Dry run by default; `--apply` writes.
6. Write the full summary to `docs/audits/2026-07-29-phase4-rebuild-dryrun.json`
   (and `-apply.json` on the apply run): totals, the excluded-order list with
   reasons, and per-item before/after quantity totals.

- [ ] **Step 6: Verify the empty cost-change array is accepted**

Before the full dry run, call the RPC once with `p_dry_run: true` and
`p_cost_changes: []` for a single order. Confirm it returns without error. If
the RPC rejects an empty array, **stop and report** rather than working around
it by passing real cost changes — that would silently pull Phase 5's money
changes into Phase 4.

- [ ] **Step 7: Commit**

```bash
git add lib/phase4-rebuild-scope.ts lib/phase4-rebuild-scope.test.ts scripts/apply-phase4-stock-rebuild.ts
git commit -m "Claude-Sonnet feat: all-orders stock ledger rebuild, stock rows only"
```

---

### Task 3: Fresh backup, dry run, and the owner's review gate

- [ ] **Step 1: Take a real backup, not a dry run**

The pre-flight snapshot taken before the deploy was read-only and produced no
stored bundle. Run the real backup path documented in
`docs/runbooks/restore-from-backup.md` and confirm a bundle for today exists and
validates, covering all 40 tables. **Do not proceed without it.**

- [ ] **Step 2: Run the dry run**

Run: `npx vite-node scripts/apply-phase4-stock-rebuild.ts`

- [ ] **Step 3: Build the owner's summary in Vietnamese**

Real names throughout, no codes. It must state:

- how many orders will be rebuilt, and how many are excluded and why
- how many `stock_ledger` rows are deleted and how many inserted
- for every ingredient whose total quantity changes by more than a rounding
  amount: name, quantity before, quantity after, difference
- every ingredient that is still negative after the rebuild, by name and amount
- explicitly: **no cost or price figure changes in this phase**

- [ ] **Step 4: OWNER GATE — wait for approval**

**Do not run `--apply` until the owner has read the summary and approved it.**
If the excluded-order list is not empty, say so plainly and let him decide
whether to proceed or fix those orders first.

- [ ] **Step 5: Commit the dry-run record**

```bash
git add docs/audits/2026-07-29-phase4-rebuild-dryrun.json
git commit -m "Claude-Sonnet audit: phase 4 stock rebuild dry run"
```

---

### Task 4: Apply

**Run only after the Task 3 gate. Run when the shop is closed, with no open
shift and no order in progress.**

- [ ] **Step 1: Apply**

Run: `npx vite-node scripts/apply-phase4-stock-rebuild.ts --apply`

Record applied count, failure count, and every failure message.

- [ ] **Step 2: Rebuild the materialized balances**

Call `rebuild_inventory_balances()` (migration 0039). The rebuild replaces
`stock_ledger` rows underneath the trigger-maintained `inventory_balances`
table, so it is stale until this runs. Skipping it reproduces the exact
two-numbers-on-one-page divergence the owner already hit.

- [ ] **Step 3: Confirm the detection suppression worked**

Count rows in `backdated_ledger_events` created during the apply window. Expect
zero. A non-zero count means Task 1's migration did not take effect: delete
those rows before 03:00 Vietnam time, when the cron runs, and report it.

- [ ] **Step 4: Commit the apply record**

```bash
git add docs/audits/2026-07-29-phase4-rebuild-apply.json
git commit -m "Claude-Sonnet audit: phase 4 stock rebuild applied"
```

---

### Task 5: Verify

- [ ] **Step 1: Run the corrected audit**

Run: `npx vite-node scripts/audit-full-history-recompute.ts`

This is the script whose negativity check was fixed in Phase 1
(it previously evaluated negatives only among *mismatched* items, which is why
every audit reported zero negatives while the screen showed −6,651g). It is now
the instrument this phase is judged by.

- [ ] **Step 2: Assert the two conditions**

1. Recorded equals recomputed for **every** item. Any mismatch after a rebuild
   from source is a defect in the rebuild, not a data problem — investigate
   before continuing.
2. Every remaining negative is listed by name with its magnitude.

- [ ] **Step 3: Answer the two open questions explicitly**

- **Sữa đặc** — did PO-037's correction plus the rebuild clear it, or is it
  still negative? If still negative, the missing purchase is genuinely absent
  from the records and only data entry fixes it.
- **Lá hồng trà (−2,009.58g)** — did the rebuild resolve it? If it survives, the
  hồng trà to lục trà product migration is the standing hypothesis and it
  becomes a named follow-up rather than a mystery.

- [ ] **Step 4: Report to the owner in Vietnamese**

State plainly whether the rebuild is clean. Repeat that costs have not moved yet
and that Phase 5 is what changes profit figures.

- [ ] **Step 5: Update tracking and commit**

Append to `DEVELOPMENT-TRACKING.md`, update status in
`docs/handoffs/2026-06-25-codex-handoff-active-task-tracking.md`, and update
`docs/ROADMAP.md`.

```bash
git add docs/ DEVELOPMENT-TRACKING.md
git commit -m "Claude-Sonnet docs: phase 4 stock rebuild result"
```

---

## Rollback

The backup from Task 3 Step 1 is the only lever, and restoring it is a real
operation with the runbook's own hazards. Prefer prevention: the dry-run gate,
the excluded-order rule, and the per-order transactional RPC all exist so that a
bad rebuild is caught before it is applied, not undone afterwards.

If the rebuild is applied and found wrong, it can also simply be **re-run** once
the cause is fixed — it recomputes from source every time and is not
path-dependent. That is usually the better answer than a restore.

## Gate before Phase 5

Phase 5 proceeds only if Task 5 Step 2 passes both conditions. Rebuilding costs
on top of a stock layer that does not reconcile with itself would produce
figures nobody can defend, which is the situation this whole program exists to
end.
