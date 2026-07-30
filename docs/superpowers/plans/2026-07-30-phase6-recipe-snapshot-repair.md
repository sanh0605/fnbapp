# Recipe Snapshot Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every order line's `recipe_snapshot_json` match the recipe that
was actually in force at that line's sale time, fix the code paths that broke
it, then rebuild stock and cost on the corrected basis.

**Architecture:** No new engine. `selectEffectiveRecipe`
(`lib/recipe-selection.ts:24`) is already the correct resolver and is already
what POS checkout uses. Two writers bypass it or feed it the wrong time; fix
those, repair the historical snapshots they produced, then re-run the existing
Phase 4 and Phase 5 scripts unchanged.

**Tech Stack:** TypeScript, Vitest, Supabase JS client. Runner is `npx vite-node`.

**Spec:** `docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`
(this is a defect found after Phase 5, not a planned phase).

**Implementer:** Claude Sonnet 5, with two owner gates marked below.

## Global Constraints

- **No writes until Task 3**, and only after the owner approves the dry run.
- Owner-facing output in Vietnamese with **real product and ingredient names**,
  never codes (`CLAUDE.md` section 7). Code and comments in English.
- **Every step that acts on data carries a worked example computed from real
  values** (`docs/COLLABORATION.md` section C-bis). Check your output against the
  example before running the full job. If the example does not reproduce, stop.
- No new dependencies. Lodash is not installed. No emojis.
- Verification bar: `npx tsc --noEmit` clean, full suite green (865 as of
  2026-07-30).
- Commit locally with the `Claude-Sonnet ` prefix. Do not push.

---

## What is established, and what is not

**Verified by Claude directly against production, 2026-07-30:**

| Fact | Value |
|---|---|
| `REC-001`, Cà phê đá 500ml (`VAR-001`), consumes `BTP-004` Nước đường 20 ml | in force 2026-03-26 → 2026-05-12 |
| Lines of that variant sold before 2026-05-12 | **18** |
| ...whose snapshot says `BTP-004` (correct for the period) | **0** |
| ...whose snapshot says `ING-022`, the *later* recipe | **18** |
| Recipe rows with a real time-of-day in `end_date` | 32 of 59 |
| Recipe rows with a non-null `start_date` | 1 of 130 (`RC-029`) |
| Recipe rows whose `created_at` is after their own `end_date` | 0 — the table is internally coherent |
| Order lines (with a variant) where `selectEffectiveRecipe` returns nothing at sale time | **1** — Hồng trà chanh 700ml |

Recipe versions chain contiguously. Example, Hồng trà chanh 700ml:

```
REC-017  created 2026-05-20 00:00:00   end 2026-06-04 14:15:45
REC-035  created 2026-06-04 14:15:45   end 2026-06-15 00:00:00
REC-054  created 2026-06-15 00:00:00   end 2026-06-15 00:00:01
```

Each version ends at the exact second the next begins. The owner confirmed he
back-dates a predecessor's `end_date` to match reality when he enters a recipe
change late — so the recipe table is the corrected record and the snapshots are
the stale copy. **That is why the repair direction is snapshot ← recipe, and not
the reverse.**

**Reported by Sonnet, not independently verified:** 238 mismatched lines (Apr 9,
May 9, Jun 198, Jul 22); cost impact −162,604 VND (Jun −157,983, Jul −3,837,
May −784); worst single lines Yogurt xoài on orders `UCK000185` and `UCK000223`
at −6,102 VND each. Task 3 reproduces these; treat a mismatch as a finding.

**Two contradictions in that report must be resolved before any fix — Task 0.**

---

### Task 0: Resolve the two contradictions (read-only, no commit)

- [ ] **Step 1: Reconcile the "no recipe" count**

Sonnet reported **159** lines with no recipe. Claude measured **1** line where
`selectEffectiveRecipe` returns null at sale time, counting only lines that have
a `product_variant_id`.

Explain the gap. The likely answer is that the 159 includes lines with no
variant reference at all — standalone modifiers, resale goods, food with no
recipe — which the narrower check skips.

**This matters beyond bookkeeping.** If any of those 159 is a drink that *has* a
recipe but is not being deducted, that is a larger hole than the 238 lines this
plan repairs, and it must be folded into the same repair rather than found later.
Report: how many of the 159 have a variant, how many of those have any recipe row
at all, and name any product among them that should have been deducting stock.

- [ ] **Step 2: Pin down what produced the 122 lines**

The investigation report is self-contradictory here: its table marks the
historical-import path **correct**, then attributes 122 mismatched lines to
"đơn nhập lịch sử". Both cannot be true.

Identify the exact writer — `file:line` — and state whether it calls
`selectEffectiveRecipe`, and if so with what timestamp. Do not proceed to Task 2
until this is a specific file and line, not a category.

- [ ] **Step 3: Report both answers in Vietnamese, then stop for confirmation**

No commit. This task changes nothing.

---

### Task 1: Editing an order must resolve recipes against the original sale time

**Files:**
- Modify: `lib/order-cart.ts` (add an explicit resolution-time input)
- Modify: `lib/order-edit-cart.ts:67-73` (`buildEditedOrderFromCart`)
- Modify/create: `lib/order-edit-cart.test.ts`

**The defect.** `buildEditedOrderFromCart` calls
`buildOrderFromCart({ ...input, suppress_auto_promotion: true }, ref)` at
`lib/order-edit-cart.ts:73`. `editOrderV2` never puts `client_captured_at` in
that input, so `buildOrderFromCart` runs
`resolveCapturedAt(undefined)` (`lib/order-cart.ts:116`) and resolves the recipe
against **now**. The function then patches `created_at: original.order.created_at`
at line 84 — so the order keeps its true sale time while its recipe snapshot was
already built from today's recipe. The preserved timestamp hides the bug.

**The trap in the obvious fix — read this before writing code.**

Passing `client_captured_at: original.order.created_at` looks like the fix and is
wrong. `resolveCapturedAt` (`lib/pos-captured-at.ts:11`) rejects any timestamp
more than **30 days** in the past and silently falls back to `now`, setting
`migration_notes: "client_captured_at_rejected"`. That guard exists to defend
against a POS device with a bad clock. An edit's sale time comes from the
database and is trusted, so it must **bypass** that guard entirely.

If you take the naive route, edits to recent orders will pass their tests while
every April and May order — exactly the ones this plan exists to repair — keeps
resolving against today. The bug would look fixed and would not be.

- [ ] **Step 1: Write the failing tests**

```typescript
it("resolves the recipe against the original sale time, not now", () => {
  const saleTime = "2026-04-20T03:00:00.000Z";
  const built = buildEditedOrderFromCart(cartInput, refWithTwoRecipeVersions, {
    order: { ...originalOrder, created_at: saleTime },
    lines: originalLines,
  });
  const snapshot = JSON.parse(built.lines[0].recipe_snapshot_json);
  expect(snapshot.ingredients.map((i: any) => i.ingredient_id)).toContain("BTP-004");
  expect(snapshot.ingredients.map((i: any) => i.ingredient_id)).not.toContain("ING-022");
});

it("still resolves correctly when the sale is older than the 30-day POS clock guard", () => {
  // resolveCapturedAt rejects >30 days and falls back to now. An edit's sale
  // time comes from the database, not a device clock, so that guard must not
  // apply here. Without a bypass this test fails while the previous one passes.
  const saleTime = "2026-04-20T03:00:00.000Z"; // ~100 days before 2026-07-30
  const built = buildEditedOrderFromCart(cartInput, refWithTwoRecipeVersions, {
    order: { ...originalOrder, created_at: saleTime },
    lines: originalLines,
  });
  expect(built.lines[0].migration_notes || "").not.toContain("rejected");
  expect(JSON.parse(built.lines[0].recipe_snapshot_json).ingredients
    .map((i: any) => i.ingredient_id)).toContain("BTP-004");
});
```

Build `refWithTwoRecipeVersions` from the real shape verified above: `REC-001`
for `VAR-001` containing `BTP-004` with `end_date` `2026-05-12T17:00:00+00:00`,
plus its successor containing `ING-022` created at that same instant.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/order-edit-cart.test.ts`
Expected: FAIL — both resolve against today and return `ING-022`.

- [ ] **Step 3: Implement**

Add an explicit, trusted resolution time to `CartInput` — for example
`recipe_as_of?: string` — used directly for recipe selection and **not** passed
through `resolveCapturedAt`. Leave the POS path untouched: it must keep
validating `client_captured_at`, because that value does come from a device.

`buildEditedOrderFromCart` passes `recipe_as_of: original.order.created_at`.

- [ ] **Step 4: Run tests, then the full suite**

Both new tests PASS. Then `npx vitest run` and `npx tsc --noEmit`, both clean.
The POS clock-guard tests must still pass unchanged — if you weakened
`resolveCapturedAt` instead of bypassing it, they will fail, and that is the
wrong fix.

- [ ] **Step 5: Commit**

```bash
git add lib/order-cart.ts lib/order-edit-cart.ts lib/order-edit-cart.test.ts
git commit -m "Claude-Sonnet fix: editing an order must resolve recipes against its original sale time"
```

---

### Task 2: Fix the writer identified in Task 0 Step 2

**Do not start until Task 0 Step 2 names a specific `file:line`.**

- [ ] **Step 1: Write a failing test** proving that writer produces the
  sale-time recipe rather than the current one, using the same `REC-001` /
  `VAR-001` shape as Task 1.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Replace its resolution with `selectEffectiveRecipe(recipes,
  "PRODUCT_VARIANT", variantId, saleTime)`.** Do not hand-roll a filter. The
  filter Claude wrote by hand — `status === "ACTIVE" && !end_date` — is what
  caused the wrong conclusion that started this investigation: it excludes every
  superseded version, so it can never answer a question about the past.
- [ ] **Step 4: Full suite green, `tsc` clean.**
- [ ] **Step 5: Commit.**

---

### Task 3: Repair the historical snapshots

**Files:**
- Create: `lib/recipe-snapshot-repair.ts`, `lib/recipe-snapshot-repair.test.ts`
- Create: `scripts/repair-recipe-snapshots.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
it("flags a line whose snapshot differs from the recipe in force at sale time", () => {
  const findings = findSnapshotMismatches({
    lines: [{ id: "L1", product_variant_id: "VAR-001", sale_time: "2026-04-20T03:00:00Z",
              recipe_snapshot_json: JSON.stringify({ ingredients: [{ ingredient_id: "ING-022", quantity: 20 }] }) }],
    recipes: recipeFixture,
  });
  expect(findings).toHaveLength(1);
  expect(findings[0].expected_ingredient_ids).toEqual(["BTP-004"]);
});

it("leaves a line alone when its snapshot already matches", () => {
  const findings = findSnapshotMismatches({
    lines: [{ id: "L2", product_variant_id: "VAR-001", sale_time: "2026-06-20T03:00:00Z",
              recipe_snapshot_json: JSON.stringify({ ingredients: [{ ingredient_id: "ING-022", quantity: 20 }] }) }],
    recipes: recipeFixture,
  });
  expect(findings).toEqual([]);
});

it("reports rather than repairs a line with no effective recipe", () => {
  // One such line exists in production (Hồng trà chanh 700ml). Repairing it
  // would mean inventing a recipe; it must surface as a named finding instead.
  const findings = findSnapshotMismatches({ lines: [lineInAGap], recipes: recipeFixture });
  expect(findings[0].reason).toBe("NO_EFFECTIVE_RECIPE");
  expect(findings[0].repairable).toBe(false);
});
```

- [ ] **Step 2: Run tests, confirm they fail.**

- [ ] **Step 3: Implement `findSnapshotMismatches`**, calling
  `selectEffectiveRecipe` for every line. Never re-implement its filtering.

- [ ] **Step 4: Write `scripts/repair-recipe-snapshots.ts`**

Dry run by default; `--apply` writes. It only ever writes
`order_lines_v2.recipe_snapshot_json` — no ledger row, no cost, no order header.
Write the summary to `docs/audits/2026-07-30-recipe-snapshot-repair-dryrun.json`.

- [ ] **Step 5: Run the dry run and check it against the worked example**

**VÍ DỤ ĐÃ TÍNH SẴN — đối chiếu trước khi chạy tiếp:**

```
variant  : VAR-001, Cà phê đá 500ml
window   : REC-001 in force 2026-03-26 -> 2026-05-12, consumes BTP-004 20 ml
expected : exactly 18 lines flagged for this variant before 2026-05-12
           all 18 currently say ING-022, none says BTP-004
           after repair, all 18 say BTP-004 20 ml
totals   : 238 lines flagged overall
           by month  Apr 9 | May 9 | Jun 198 | Jul 22
           1 line NOT repairable (Hồng trà chanh 700ml, no effective recipe)
```

**If the run reports a different count for `VAR-001`, or a different monthly
split, stop and report — do not run `--apply`.** Those numbers came from two
independent checks; a third number means something moved or the resolver is
being called differently.

- [ ] **Step 6: OWNER GATE — summary in Vietnamese, then wait**

Per month: how many lines change, and which products. Name the products in
full — "Trà đào dầm 26 dòng", not counts alone. State plainly that this step
changes no stock and no cost figure yet; those move in Task 4.

**Do not run `--apply` until the owner approves.**

- [ ] **Step 7: Apply, then commit**

```bash
git add docs/audits/2026-07-30-recipe-snapshot-repair-*.json lib/recipe-snapshot-repair.* scripts/repair-recipe-snapshots.ts
git commit -m "Claude-Sonnet fix: repair recipe snapshots against the recipe in force at sale time"
```

---

### Task 4: Re-run Phase 4 and Phase 5 on the corrected basis

Stock and cost were both computed from the old snapshots, so both are now stale.
Re-run the existing scripts unchanged — they recompute from source every time and
are not path-dependent.

- [ ] **Step 1: Fresh backup first.** Confirm a bundle captured *after* Task 3's
  apply. The 02:30 daily job overwrites the same filename per date, so if today's
  already exists, run `runDailyDriveBackup` again and confirm its `capturedAt`
  post-dates the repair.

- [ ] **Step 2: Phase 4 dry run, then apply.**

```bash
npx vite-node scripts/apply-phase4-stock-rebuild.ts
npx vite-node scripts/apply-phase4-stock-rebuild.ts --apply
```

Then call `rebuild_inventory_balances()`.

**Expected, and check it:** quantity totals should barely move — the 238 lines
are a 10% slice and most recipe changes were 40 ml → 30 ml of syrup, not new
ingredients. Muối hồng stays at −14.39 g unless the owner has ticked it
non-inventory by then. **A large stock swing here means Task 3 wrote something
wrong — stop and report rather than continuing to Phase 5.**

- [ ] **Step 3: Confirm the backdated-detection suppression still holds.**

0 rows added to `backdated_ledger_events` / `backdated_recipe_events` during the
apply window. Migration 0042 makes this so; a non-zero count means it regressed.

- [ ] **Step 4: Phase 5 dry run, owner gate, then apply.**

```bash
npx vite-node scripts/apply-phase5-cost-rebuild.ts
npx vite-node scripts/apply-phase5-cost-rebuild.ts --apply
```

**VÍ DỤ ĐÃ TÍNH SẴN:** Sonnet's investigation predicted the corrected snapshots
move cost by **−162,604 VND** (Jun −157,983 | Jul −3,837 | May −784), with the
worst single lines being Yogurt xoài on `UCK000185` and `UCK000223` at −6,102
each. The Phase 5 dry run should land close to that. **A wildly different figure
means Task 3 and the investigation disagree — stop and reconcile before applying.**

Owner approves the month-by-month table before `--apply`, same gate as before.

- [ ] **Step 5: Commit both audit records.**

---

### Task 5: Stop this from recurring (owner-approved 2026-07-30)

**Run after Task 4 applies, before declaring the repair done.** Without this, the
repair has a shelf life: the next time the owner back-dates a recipe, the
snapshots desynchronise again and nothing notices.

**Files:**
- Create: `supabase/migrations/0043_backdated_recipe_detection_on_update.sql`
- Create: `lib/backdated-recipe-detection-migration.test.ts`
- Modify: `lib/backdated-recipe-events/recompute-event.ts`
- Modify: `app/admin/semi-products/actions.ts:120,132`,
  `app/admin/products/actions.ts`, `app/admin/products/modifiers/actions.ts`

**Three holes, all verified against the current code.**

**Hole 1 — the trigger only fires on INSERT.**
`detect_backdated_recipe_entry` is `after insert on public.recipes`
(`0027_backdated_recipe_detection.sql:86-90`). The owner back-dates by editing an
existing recipe's `end_date`, which is an UPDATE. The trigger never runs.

> **Ví dụ:** REC-017 (Hồng trà chanh 700ml) currently ends `2026-06-04 14:15:45`.
> Change that to `2026-06-01` to reflect a change entered late. That is an UPDATE.
> Today: no `backdated_recipe_events` row, no cost recompute, no snapshot repair,
> and every sale between 01/06 and 04/06 keeps a snapshot nobody knows is stale.

**Hole 2 — the wrong column is watched.**
The trigger tests `new.created_at < now() - interval '5 minutes'`. Effectiveness
is decided by `start_date` (falling back to `created_at`,
`lib/recipe-selection.ts:43`), not `created_at`.

> **Ví dụ, and this is why ordering matters:** on 30/07 a recipe is saved with
> `start_date = 2026-06-14` and `created_at = 2026-07-30`. The trigger reads
> `created_at`, sees today, and stays silent — while the recipe just moved 46
> days into the past. **Populating `start_date` before fixing this trigger makes
> detection strictly worse than it is now.** Do the migration first.

**Hole 3 — detection repairs cost but not the snapshot.**
`lib/backdated-recipe-events/recompute-event.ts` references only
`old_cost_at_sale` / `new_cost_at_sale`. There is no mention of
`recipe_snapshot_json` anywhere in it. So even a correctly detected back-date
leaves the stale snapshot in place — which is exactly the state Task 3 is
cleaning up by hand.

- [ ] **Step 1: Write the failing migration test**

```typescript
const sql = readFileSync("supabase/migrations/0043_backdated_recipe_detection_on_update.sql", "utf8");

it("fires on update as well as insert", () => {
  expect(sql).toMatch(/after insert or update on public\.recipes/i);
});

it("evaluates the effective start, not the row's creation time", () => {
  expect(sql).toContain("coalesce(new.start_date, new.created_at)");
});

it("keeps the recovery escape hatch so replays do not trip it", () => {
  expect(sql).toContain("current_setting('app.mac_drift_recovery', true)");
});

it("still restricts the function", () => {
  expect(sql).toContain("revoke all on function");
});
```

- [ ] **Step 2: Run it, confirm it fails** (file does not exist).

- [ ] **Step 3: Write the migration**

Copy `flag_backdated_recipe_entry()` from `0027` and change exactly three things:
the threshold test uses `coalesce(new.start_date, new.created_at)`; the trigger
becomes `after insert or update on public.recipes`; and on UPDATE the event is
also raised when `end_date` moved, since that is how a predecessor's window is
shortened. **Keep the `app.mac_drift_recovery` skip and the 5-minute threshold
exactly as they are** — migration 0042 depends on that skip, and removing it
would make every rebuild flood the events table again.

- [ ] **Step 4: Teach recovery to repair the snapshot, not only the cost**

When an event is settled, re-resolve `recipe_snapshot_json` for every order line
in the affected window using `selectEffectiveRecipe(recipes, target_type,
target_id, saleTime)` — the same call Task 3 uses — and write it before the cost
recompute, because cost is derived from the snapshot.

Reuse `lib/recipe-snapshot-repair.ts` from Task 3 rather than writing a second
resolver. Two implementations of this will drift.

- [ ] **Step 5: Always write `start_date` on save**

`app/admin/semi-products/actions.ts:120` and `:132` insert with
`created_at: nowIso, end_date: ""` and no `start_date` — this is the origin of
the 129 null rows. Add `start_date: nowIso` there and in the product and
modifier save paths.

There is currently no UI for entering a back-dated recipe; back-dating has only
ever happened through scripts. So this step writes `start_date === created_at`
today, and simply makes the column honest. If a back-date input is added later,
it feeds `start_date` and the trigger from Step 3 will see it.

- [ ] **Step 6: Verify and apply**

Full suite green, `tsc` clean, then `npx supabase db push`. Confirm 0043 appears
on both sides of `npx supabase migration list`.

**Then prove the trigger actually works**, rather than trusting the migration
text: in a transaction, update one recipe's `end_date` backwards, confirm a
`backdated_recipe_events` row appears, then roll back. Report what you observed.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0043_backdated_recipe_detection_on_update.sql lib/ app/admin/
git commit -m "Claude-Sonnet fix: detect recipe back-dating on update and repair snapshots, not just cost"
```

**Deferred to Phase 7, deliberately:** backfilling `start_date` on the 129
existing null rows. It is safe only under one condition — after the backfill,
`selectEffectiveRecipe` must return the **identical** recipe for all 2,538 order
lines. A backfill that changes no resolution is documentation; one that changes
any resolution is a data change wearing a backfill's clothes, and must stop.

---

### Task 6: Verify

- [ ] **Step 1: Re-run the snapshot check.** `findSnapshotMismatches` over all
  lines must return only the non-repairable ones — the single Hồng trà chanh line,
  plus anything Task 0 identified as genuinely recipe-less.

- [ ] **Step 2: Re-run the full audit.**

```bash
npx vite-node scripts/audit-full-history-recompute.ts
```

`cost_mismatches: 0` and `quantity_items_with_diff: 0`. Anything else is a defect
in this repair, not a data problem.

- [ ] **Step 3: Report to the owner in Vietnamese.**

State the total profit movement from this repair, and say plainly that this is
the **third** revision of historical profit (Phase 5 +942,492; this one roughly
+162,604). Give the running total so he sees one number, not three.

- [ ] **Step 4: Update `DEVELOPMENT-TRACKING.md`, `docs/ROADMAP.md`, and the
  handoff doc. Commit.**

---

## Rollback

Task 3 writes only `recipe_snapshot_json`. Task 4 recomputes from source and is
re-runnable, so the ordinary recovery is to fix the cause and re-run, not to
restore. The backup from Task 4 Step 1 is the blunt lever and rolls back the
snapshot repair as well.

## What this plan deliberately does not do

- No change to `selectEffectiveRecipe`. It is correct; the callers were not.
- No weakening of `resolveCapturedAt`. The POS clock guard stays exactly as it is.
- No edit to any recipe row. The recipe table is the reference here, not the
  subject. Per `docs/COLLABORATION.md` C-bis, master data is never deleted, and
  under this plan it is not modified either.
- No attempt to resolve sales that fall inside a same-day recipe change where
  both versions share a midnight boundary. That subset is genuinely
  indeterminate; Task 3 must count it and name it rather than guess.
