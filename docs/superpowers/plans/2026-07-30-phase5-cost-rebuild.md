# Phase 5 Implementation Plan: Rebuild COGS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompute `cost_at_sale` for every order line from the stock basis
Phase 4 rebuilt, so the profit report finally reflects what things actually cost.

**Architecture:** No new database machinery. `apply_full_history_recovery`
(migration 0031) already exists for exactly this job: it applies Category A
(unlocked) `cost_at_sale` corrections produced by
`scripts/audit-full-history-recompute.ts`, touches no stock rows, is idempotent
per run-id via `data_recovery_changes`, takes a dry-run flag, and carries an
explicit `not exists (select 1 from audit_baseline_locks ...)` guard on every
single line — so it is structurally incapable of writing a locked line even if
the caller is wrong.

**Tech Stack:** TypeScript, Vitest, Supabase JS client, PostgreSQL RPCs.
Runner is `npx vite-node`.

**Spec:** `docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`, Phase 5.

**Implementer:** Claude Sonnet 5, with one owner gate marked below.

## Global Constraints

- **No writes until Task 3**, and only after the owner approves the Task 2
  month-by-month summary.
- **Stock rows are not touched.** Phase 4's result is final. This phase writes
  `order_lines_v2.cost_at_sale` and nothing else.
- **No baseline lock is removed** — there are none to remove. See below.
- Owner-facing output in Vietnamese with **real ingredient and product names**,
  never codes (`CLAUDE.md` section 7). Code and comments in English.
- No new dependencies. Lodash is not installed. No emojis.
- Verification bar: `npx tsc --noEmit` clean, full suite green (865 as of
  2026-07-30).
- Commit locally with the `Claude-Sonnet ` prefix. Do not push.

---

## What changed since the spec was written

**The spec expected this phase to release `audit_baseline_locks` as a recorded
decision. There is nothing to release: the table is empty. 0 rows.**

Counted directly against production on 2026-07-30. The audit's
`cost_category_b_locked_current: 0` / `cost_category_c_locked_stale: 0` was not
telling us that the locks happen to miss the change set — it was telling us
there are no locks at all, and this plan's first draft misread it as the former.

The spec's risk bullet ("Baseline locks will be released... Phase 5 records
which locks were released and why") described a risk that does not exist. It has
been corrected there too. The owner caught this by asking why locks were being
discussed at all in a program whose whole premise is recomputing from source —
a fair challenge, and he was right.

**Nothing in this plan's tooling changes as a result.**
`apply_full_history_recovery` is still the correct RPC, for reasons that have
nothing to do with locks: cost-only, no stock rows, dry-run flag, idempotent per
run-id. Its per-line lock guard simply never fires. Keep it; it costs nothing
and is the right shape if locks are ever introduced again.

**Do not call `remove_audit_baseline_lock`. Do not use
`scripts/remove-locks-and-recompute-cost.ts`,** which removes locks before
recomputing and is the wrong tool for this phase.

Task 1 re-verifies the B=0 / C=0 condition at run time rather than trusting this
document — if a locked line has appeared in the change set since, **stop and
report**, because that is a decision for the owner and not a step to work around.

## Direction of the change, and a correction

`delta = computed − stored`. The current net is **−942,514 VND across 1,066
lines**, with 1,034 lines going down and 32 going up. Costs fall, so
**historical profit rises by roughly 942,514 VND.**

An earlier note to the owner suggested this figure was near-identical to
PO-024's 942,000 VND tea purchase and probably had the same cause. **That was
wrong and has been retracted.** Correcting the tea mapping *adds* cost to tea
drinks; it cannot produce a net cost *reduction*. The similarity is a
coincidence. The likely real driver is Phase 4 removing consumption of
ingredients that were genuinely purchased and therefore genuinely carried cost —
Trái tắc and Trái chanh in particular, which are bought daily and were being
charged into drinks that no longer consume them.

Task 2 must establish the actual driver from the data rather than restating
either guess.

---

### Task 1: Build the cost-only change set

**Files:**
- Create: `lib/phase5-cost-scope.ts`, `lib/phase5-cost-scope.test.ts`
- Create: `scripts/apply-phase5-cost-rebuild.ts`

**Interfaces:**
- Consumes: `buildTrustedPrimitiveLedger`, `replayFullHistory` from
  `lib/full-history-recompute`; `apply_full_history_recovery` (migration 0031).
- Produces: `groupCostChangesByMonth(input): MonthlyCostBatch[]`.

**Why chunk by month.** `apply_full_history_recovery` takes the whole change set
as one `jsonb` array in one transaction. One call for 1,066 lines would work but
gives the owner a single undifferentiated number to approve and one all-or-
nothing transaction. Chunking by calendar month of `sale_time` makes the review
readable (he thinks in months, and the P&L is monthly), keeps each transaction
small, and gives each chunk its own idempotent run-id.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { groupCostChangesByMonth } from "./phase5-cost-scope";

describe("groupCostChangesByMonth", () => {
  it("groups by the calendar month of the sale, in Saigon time", () => {
    const batches = groupCostChangesByMonth([
      { line_id: "L1", sale_time: "2026-06-03T09:45:44.554+00:00", old_cost_at_sale: 11273, new_cost_at_sale: 10522 },
      { line_id: "L2", sale_time: "2026-06-28T02:00:00.000+00:00", old_cost_at_sale: 500, new_cost_at_sale: 400 },
      { line_id: "L3", sale_time: "2026-07-01T01:00:00.000+00:00", old_cost_at_sale: 900, new_cost_at_sale: 800 },
    ]);
    expect(batches.map(b => b.month)).toEqual(["2026-06", "2026-07"]);
    expect(batches[0].changes).toHaveLength(2);
    expect(batches[0].net_delta).toBe(-851);
  });

  it("drops no-op changes below the one-dong threshold", () => {
    const batches = groupCostChangesByMonth([
      { line_id: "L1", sale_time: "2026-06-03T09:45:44.554+00:00", old_cost_at_sale: 1000, new_cost_at_sale: 1000 },
    ]);
    expect(batches).toEqual([]);
  });

  it("never emits an empty batch, which the RPC rejects", () => {
    const batches = groupCostChangesByMonth([]);
    expect(batches).toEqual([]);
  });
});
```

Note the last test: `apply_full_history_recovery` raises
`p_changes must not be empty`, so a month with no surviving change must not
produce a batch at all.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/phase5-cost-scope.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/phase5-cost-scope.ts`**

```typescript
import { toSaigonIsoString } from "./datetime";

export type CostChangeInput = {
  line_id: string;
  sale_time: string;
  old_cost_at_sale: number;
  new_cost_at_sale: number;
};

export type MonthlyCostBatch = {
  month: string; // "YYYY-MM", Saigon calendar
  changes: Array<{ line_id: string; old_cost_at_sale: number; new_cost_at_sale: number }>;
  net_delta: number;
};

/**
 * The audit's own no-op threshold is one dong (scripts/audit-full-history-
 * recompute.ts:106). Match it exactly so this phase never writes a line the
 * audit does not consider mismatched.
 */
export function groupCostChangesByMonth(input: CostChangeInput[]): MonthlyCostBatch[] {
  const byMonth = new Map<string, MonthlyCostBatch>();
  for (const change of input) {
    const delta = change.new_cost_at_sale - change.old_cost_at_sale;
    if (Math.abs(delta) <= 1) continue;
    const month = toSaigonIsoString(new Date(change.sale_time)).slice(0, 7);
    const batch = byMonth.get(month) || { month, changes: [], net_delta: 0 };
    batch.changes.push({
      line_id: change.line_id,
      old_cost_at_sale: change.old_cost_at_sale,
      new_cost_at_sale: change.new_cost_at_sale,
    });
    batch.net_delta += delta;
    byMonth.set(month, batch);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}
```

**Check `toSaigonIsoString`'s actual signature in `lib/datetime.ts` before
using it.** If it does not return an ISO string starting `YYYY-MM`, derive the
Saigon month some other way rather than bending the helper — a month boundary
computed in UTC would misfile every late-evening sale.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/phase5-cost-scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `scripts/apply-phase5-cost-rebuild.ts`**

Structure, modeled on `scripts/apply-phase4-stock-rebuild.ts`:

1. Load `Orders_V2`, `Order_Lines_V2`, `Stock_Ledger`, `Recipes`,
   `Semi_Products`, `Purchase_Orders`, `Purchase_Order_Lines`,
   `Purchased_Items`, `UOM_Conversions`, and the non-inventory item set — the
   same inputs Phase 4 used. **Thread `nonInventoryItems` into
   `replayFullHistory`.** Phase 4's plan omitted this and it had to be caught
   during implementation; do not repeat it.
2. Run `buildTrustedPrimitiveLedger` then `replayFullHistory`.
3. Build change candidates from `lineResults`
   (`computed_cost_at_sale` vs `stored_cost_at_sale`), then
   `groupCostChangesByMonth`.
4. **Re-verify the lock condition.** Read `audit_baseline_locks` and assert no
   `order_line_id` in any batch is locked. If any is, print it and exit
   non-zero. Do not filter it out silently — the owner needs to know.
5. Dry run by default; `--apply` writes. For each month, call
   `apply_full_history_recovery` with:
   - `p_run_id`: `phase5-cost-rebuild-<YYYY-MM>`
   - `p_source_hash`: lowercase SHA-256 of that batch's changes
   - `p_changes`: the batch
   - `p_dry_run`: true, then false on apply
6. Write the summary to `docs/audits/2026-07-30-phase5-cost-dryrun.json`
   (and `-apply.json`).

- [ ] **Step 6: Commit**

```bash
git add lib/phase5-cost-scope.ts lib/phase5-cost-scope.test.ts scripts/apply-phase5-cost-rebuild.ts
git commit -m "Claude-Sonnet feat: month-batched cost_at_sale rebuild from the Phase 4 stock basis"
```

---

### Task 2: Dry run and the owner's review

- [ ] **Step 1: Confirm the backup still covers this**

`fnbapp-backup-2026-07-30.json` (captured 00:51 VN on 2026-07-30) predates the
Phase 4 apply. That is acceptable for this phase — restoring it would undo
Phase 4 as well, which is the correct rollback unit, and Phase 4 is re-runnable
from source. Confirm the file still exists and note it in the summary. If the
02:30 cron has since produced `fnbapp-backup-2026-07-31.json`, prefer it and say
which one is the restore point.

- [ ] **Step 2: Run the dry run**

Run: `npx vite-node scripts/apply-phase5-cost-rebuild.ts`

- [ ] **Step 3: Build the owner's summary in Vietnamese**

This is the deliverable the owner actually reads. It must contain:

- **One table, one row per month**: revenue, COGS before, COGS after, profit
  before, profit after. Revenue does not change — showing it makes the profit
  movement legible instead of abstract.
- **The overall net effect in one sentence**: profit rises or falls by how much.
- **Which products drive it.** Rank products by total cost delta and name the
  top handful with real product names. "Trà đào dầm rẻ đi 120.000 đ" is
  reviewable; "1.066 dòng, −942.514 đ" is not.
- **Why.** Establish the actual driver from the data. The standing hypothesis is
  that Phase 4 stopped charging genuinely-purchased ingredients (Trái tắc, Trái
  chanh) into drinks that no longer consume them. Confirm or refute it by
  ingredient; do not assert it.
- **The 32 lines that move the other way** — say what they are. A change set
  that moves in one direction except for 32 lines invites the question, so
  answer it before it is asked.
- Explicitly: **no stock quantity changes, no baseline lock removed.**

- [ ] **Step 4: OWNER GATE — wait for approval**

**Do not run `--apply` until the owner has read the month-by-month summary and
approved it.** These are the profit figures for his business; he is the only one
who can say whether the new numbers look like reality.

- [ ] **Step 5: Commit the dry-run record**

```bash
git add docs/audits/2026-07-30-phase5-cost-dryrun.json
git commit -m "Claude-Sonnet audit: phase 5 cost rebuild dry run"
```

---

### Task 3: Apply

**Run only after the Task 2 gate. Shop closed, no open shift, no order in
progress.**

- [ ] **Step 1: Apply**

Run: `npx vite-node scripts/apply-phase5-cost-rebuild.ts --apply`

Record, per month: run-id, change count, net delta, and any failure verbatim.

**If one month fails, the others still stand** — each is its own transaction
with its own run-id. Report exactly which months applied and which did not.
Do not roll back the successful ones; re-run the failed month once its cause is
understood, since the run-id guard makes a repeat safe.

- [ ] **Step 2: Confirm nothing else moved**

- `stock_ledger` row count unchanged from the Phase 4 apply record.
- No rows added to `backdated_ledger_events` / `backdated_recipe_events` during
  the window. This RPC writes only `order_lines_v2`, so any event here means
  something unexpected ran — report it.
- `audit_baseline_locks` row count unchanged.

- [ ] **Step 3: Commit the apply record**

```bash
git add docs/audits/2026-07-30-phase5-cost-apply.json
git commit -m "Claude-Sonnet audit: phase 5 cost rebuild applied"
```

---

### Task 4: Verify

- [ ] **Step 1: Re-run the audit**

Run: `npx vite-node scripts/audit-full-history-recompute.ts`

Expected: **`cost_mismatches: 0`**. Anything else means the apply did not take
for some lines — list them.

`quantity_items_with_diff` must still be **0** and
`quantity_items_negative_theoretical` still **1** (Muối hồng). If either moved,
this phase touched stock, which it must not have.

- [ ] **Step 2: Compare the P&L against the Task 2 prediction**

Read the profit report the owner actually uses — `getPnLDataV2`
(`app/admin/reports/actions.ts:89`; COGS is `sum(cost_at_sale)` at `:180`).
Per month, the realised profit change must match what the Task 2 summary
predicted. A divergence means the summary he approved was not what happened —
say so plainly rather than reporting the new number as if it were expected.

- [ ] **Step 3: Report to the owner in Vietnamese**

The month-by-month table again, now as fact rather than forecast. State plainly
that COGS figures are now consistent with stock, and that the remaining known
gap is Muối hồng (14.39 g consumed, never purchased under its own mapping) plus
the non-inventory real-sales proof, still unconfirmed until a trading day
happens.

- [ ] **Step 4: Update tracking and commit**

`DEVELOPMENT-TRACKING.md`, `docs/ROADMAP.md`, and the handoff doc.

```bash
git add docs/ DEVELOPMENT-TRACKING.md
git commit -m "Claude-Sonnet docs: phase 5 cost rebuild result"
```

---

## Rollback

`data_recovery_changes` records every line's before value per run-id, so a
specific month can be reversed by writing the old values back. That is a
deliberate, scripted act, not a button — if it is needed, plan it rather than
improvising at 2am.

The backup remains the blunt lever, but note it rolls back Phase 4 as well.
Since both phases recompute from source, re-running them is usually the better
answer than restoring.

## What this plan deliberately does not do

- No stock changes. Phase 4 is final.
- No baseline lock removal, and no new migration.
- No change to how cost is calculated going forward — this corrects history
  only.

## Gate before Phase 6

Phase 6 (the owner's first physical stocktake) needs Task 4 Step 1 to report
`cost_mismatches: 0`. Counting stock against figures that still disagree with
themselves would waste the one measurement that anchors everything else.
