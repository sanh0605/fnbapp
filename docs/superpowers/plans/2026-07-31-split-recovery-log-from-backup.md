# Split the Recovery Log Out of the Daily Backup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking — **tick them as you go**, see the note at the end.

**Goal:** Stop shipping a technical repair log inside the disaster-recovery
bundle, so the daily backup stops drifting toward the 50 MB ceiling.

**Architecture:** Remove `data_recovery_changes` from `BACKUP_TABLES` on both
sides of the pipeline. No new mechanism, no second backup file, no compression.
One table leaves the list.

**Tech Stack:** TypeScript (Supabase Edge Function), Google Apps Script.

## Why now, not "when there is time"

Tonight's automatic backup succeeded at **39.6 MB**. That looks comfortable
against the 50 MB `UrlFetchApp` limit and is not:

| | |
|---|---|
| Headroom | 10.4 MB |
| Cost of one full rebuild | **~14 MB** of recovery-log rows |
| When the 30-day retention first deletes anything | **~2026-08-23** |

The oldest surviving row is from 2026-07-24, so the retention rule added in
migration 0045 removes nothing until late August. Until then the table only
grows. **The next full rebuild breaks the backup again, weeks before retention
can help.** That is not a hypothetical: this program has run four full rebuilds
in five days.

## Why removing it entirely is the right call, not a compromise

`data_recovery_changes` records what each repair run changed, for two purposes:
per-`run_id` idempotency guards, and the ability to reverse one specific run.

Neither survives a disaster-recovery restore usefully. After restoring, you would
re-run corrections from source rather than replay a log — and Phases 4 and 5 are
re-runnable from source by design, which is the property this whole program was
built on. The table is operational scratch, not business data.

It stays in the database with its 30-day retention. It simply stops being copied
into a bundle whose job is to bring the shop back.

**Expected result: ~39.6 MB → ~11.5 MB, permanently.**

---

### Task 1: Remove it, in the order the validator allows

**The order matters and only one direction works.** `validateBundle_` throws on a
**missing** table but only warns on an **unexpected** one, after commit `e3f1d02`:

| Order | Result |
|---|---|
| Edge Function first | Apps Script reports `missing=1` → **throws, no backup at all** |
| **Apps Script first** | Bundle carries one table the script no longer expects → **warns, backup still written** |

Apps Script first is the only sequence with no broken window. That relaxation was
added for exactly this reason; use it.

- [ ] **Step 1: Write the failing test**

```typescript
it("does not ship the recovery log in the disaster-recovery bundle", () => {
  expect(BACKUP_TABLES).not.toContain("data_recovery_changes");
});

it("still ships every table that holds business data", () => {
  for (const t of ["order_payments", "orders_v2", "order_lines_v2", "stock_ledger",
                   "purchase_orders", "purchase_order_lines", "recipes"]) {
    expect(BACKUP_TABLES).toContain(t);
  }
});
```

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: OWNER ACTION — update the Apps Script first.**

Prepare the edited `EXPECTED_TABLES` (39 names, `data_recovery_changes` removed)
in `scratchpad/` for the owner to paste, exactly as was done for the 40-table
update. Tell him plainly that after pasting, the next backup logs a warning about
one unexpected table — that is the intended intermediate state, not a fault.

- [ ] **Step 4: Remove it from `supabase/functions/backup-to-drive/core.ts` and
  deploy the Edge Function.** The warning from Step 3 disappears once this lands.

- [ ] **Step 5: Prove it end to end, through the real path.**

Owner runs `runDailyDriveBackup` by hand. Then **read the produced Drive file**
and assert: 39 table keys, no `data_recovery_changes`, `order_payments` still
present with a non-zero count, and total size **under 15 MB**.

Reading the delivered artifact is the point. A green local test is what let this
pipeline sit broken for weeks.

- [ ] **Step 6: Commit and update tracking.**

---

### Task 2: Say what is no longer protected

- [ ] **Step 1:** Add a short section to `docs/runbooks/restore-from-backup.md`
  stating that `data_recovery_changes` is deliberately **not** in the bundle,
  why (operational scratch, 30-day retention, corrections are re-runnable from
  source), and what that means during a real restore: the restored database
  starts with an empty recovery log, so run-id idempotency guards for past runs
  are gone. Re-running a historical repair after a restore would not be blocked —
  which is fine, because those repairs recompute from source, but the operator
  should know rather than discover it.

- [ ] **Step 2: Commit.**

---

## A note on these checkboxes

Across the twelve plan files written for this program there are **285 unticked
boxes**, most of them describing work that is finished — including plans whose
closure is already recorded in `DEVELOPMENT-TRACKING.md` and `docs/ROADMAP.md`.
The plan files therefore cannot be read to find out what is left, which is the
one job they were supposed to do between sessions.

Tick each box in this plan as it completes. Separately, and as its own small
chore: add a one-line status banner to the top of each closed plan file pointing
at where its completion is recorded, so a future reader does not mistake stale
checkboxes for outstanding work. Do not retroactively tick 285 boxes — asserting
completion that has not been verified is worse than leaving them blank.
