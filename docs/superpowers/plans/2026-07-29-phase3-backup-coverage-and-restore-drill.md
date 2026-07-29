# Phase 3 Implementation Plan: Backup Coverage and Restore Drill

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps in what the backup captures, then prove by restoring it into a throwaway database that it can actually bring the system back.

**Architecture:** Extend the existing `supabase/functions/backup-to-drive/core` table list, then add a restore path that can only ever target a database explicitly declared as a scratch target. No production writes anywhere in this plan.

**Tech Stack:** TypeScript, Vitest, Supabase JS client.

**Spec:** `docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`, Phase 3.

**Implementer:** Claude Sonnet 5, with two owner-only steps marked below.

## Global Constraints

- **No writes to the production database, at any point, in any task.**
- The restore script must refuse to run when its target resolves to the
  production URL. This is a structural guard, not a convention.
- Owner-facing output in Vietnamese with real names; code and comments English.
- No new dependencies. Lodash is not installed.
- Runner is `npx vite-node`.
- Verification bar: `npx tsc --noEmit` clean, full suite green (847 tests as of
  2026-07-29).

## Why this phase exists

Phase 4 deletes derived stock data and rewrites `cost_at_sale` across the order
history. No backup in this project has ever been restore-tested, so the safety
net protecting that operation is unproven.

Reading `supabase/functions/backup-to-drive/core.ts` before running anything
already found a hole: `BACKUP_TABLES` lists 32 tables and the database has more.
Missing:

| Table | Consequence if lost |
|---|---|
| **`order_payments`** | **Payment records — cash vs transfer, split payments.** No other source exists. This is money data. |
| `stocktake_sessions`, `stocktake_lines` | Physical count records — exactly what Phase 6 is about to create |
| `shifts`, `shift_stock_checks` | Shift open/close records |
| `backdated_recipe_events` | Backdated recipe correction history |
| `purchase_order_edits` | The PO edit trail added this week (migration 0041) |
| `pos_sync_failures` | Offline POS sync failures (migration 0040) |
| `inventory_balances` | **Deliberately excluded** — derived, rebuilt by `rebuild_inventory_balances()`. Document the omission so it does not look like an oversight. |

A restore drill run against the current table list would validate an incomplete
backup and produce false confidence. Fix coverage first.

---

### Task 1: Extend backup coverage

**Files:**
- Modify: `supabase/functions/backup-to-drive/core.ts`
- Modify/create: the corresponding test file under
  `supabase/functions/backup-to-drive/` or `lib/drive-backup*.test.ts`, matching
  where `validateBackupBundle` is currently tested.

- [ ] **Step 1: Write the failing test**

Assert that `BACKUP_TABLES` contains every table the application writes to,
listing the eight additions explicitly, and that `inventory_balances` is
absent by design:

```typescript
it("covers every persisted table except deliberately derived ones", () => {
  for (const table of [
    "order_payments",
    "shifts",
    "shift_stock_checks",
    "stocktake_sessions",
    "stocktake_lines",
    "backdated_recipe_events",
    "purchase_order_edits",
    "pos_sync_failures",
  ]) {
    expect(BACKUP_TABLES).toContain(table);
  }
});

it("excludes inventory_balances, which is derived and rebuilt from stock_ledger", () => {
  expect(BACKUP_TABLES).not.toContain("inventory_balances");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run` filtered to the backup test file.
Expected: FAIL on the first eight assertions.

- [ ] **Step 3: Implement**

Add the eight names to `BACKUP_TABLES`. All eight have an `id` primary key, so
none needs an entry in `BACKUP_TABLE_ORDER_COLUMNS`.

**One thing to check by hand:** `backdated_recipe_events.id` is `uuid`, not
`text`. The snapshot paginator orders by `id` and pages with a `gt` comparison.
Confirm pagination over that table returns every row and does not stall or skip
— if a `uuid` comparison misbehaves, add an explicit order column for it rather
than changing the shared paginator.

- [ ] **Step 4: Verify and commit**

```bash
git add supabase/functions/backup-to-drive/
git commit -m "Claude-Sonnet fix: back up payments, shifts, stocktakes and the new audit tables"
```

---

### Task 2: Take and validate a full snapshot (read-only)

- [ ] **Step 1: Run the existing verifier**

Run: `npx vite-node scripts/verify-drive-backup.ts`

It builds a snapshot read-only and validates the bundle. Confirm the run now
covers 40 tables.

- [ ] **Step 2: Record the baseline**

Write the per-table row counts to
`docs/audits/2026-07-29-backup-coverage-baseline.json`. Task 5 compares the
restored database against exactly these numbers.

- [ ] **Step 3: Report**

Tell the owner, in Vietnamese, how many tables and rows the backup now covers,
and confirm `order_payments` is included with its row count.

- [ ] **Step 4: Commit**

```bash
git add docs/audits/2026-07-29-backup-coverage-baseline.json
git commit -m "Claude-Sonnet audit: backup coverage baseline before the restore drill"
```

---

### Task 3: OWNER ACTION — create a scratch database

**This task is the owner's. Do not attempt it, and do not proceed past it.**

Ask the owner to:

1. Create a **new, empty Supabase project** in his account, named so it is
   obviously disposable (for example `fnbapp-restore-drill`).
2. Apply the migration chain to it so the schema matches production.
3. Put its connection details in `.env.local` as **`RESTORE_TARGET_SUPABASE_URL`**
   and **`RESTORE_TARGET_SERVICE_KEY`** — new variable names, never reusing the
   production ones.

Explain plainly why a separate project: a restore drill that writes into the
live database is not a drill, and there is no way to make that safe. The scratch
project is deleted at the end of Task 6.

---

### Task 4: Restore into the scratch target

**Files:**
- Create: `lib/backup-restore.ts`, `lib/backup-restore.test.ts`
- Create: `scripts/restore-backup-to-target.ts`

- [ ] **Step 1: Write the failing safety test first**

The most important test in this plan. The restore must be structurally unable
to touch production:

```typescript
it("refuses to run when the target URL equals the production URL", () => {
  expect(() =>
    assertSafeRestoreTarget({
      productionUrl: "https://abc.supabase.co",
      targetUrl: "https://abc.supabase.co",
    }),
  ).toThrow(/production/i);
});

it("refuses to run when no explicit target is configured", () => {
  expect(() =>
    assertSafeRestoreTarget({ productionUrl: "https://abc.supabase.co", targetUrl: "" }),
  ).toThrow(/RESTORE_TARGET_SUPABASE_URL/);
});

it("allows a distinct, explicitly configured target", () => {
  expect(() =>
    assertSafeRestoreTarget({
      productionUrl: "https://abc.supabase.co",
      targetUrl: "https://scratch.supabase.co",
    }),
  ).not.toThrow();
});
```

- [ ] **Step 2: Implement `assertSafeRestoreTarget` and the restore**

The restore reads the snapshot bundle and inserts each table's rows into the
target, in `BACKUP_TABLES` order so foreign keys resolve. Call
`assertSafeRestoreTarget` **before opening any client**, and derive the target
client only from the `RESTORE_TARGET_*` variables — never fall back to
`SUPABASE_URL`.

- [ ] **Step 3: Run the restore**

Run: `npx vite-node scripts/restore-backup-to-target.ts`

- [ ] **Step 4: Commit**

```bash
git add lib/backup-restore.ts lib/backup-restore.test.ts scripts/restore-backup-to-target.ts
git commit -m "Claude-Sonnet feat: restore a backup bundle into an explicitly declared scratch target"
```

---

### Task 5: Verify the restored database

- [ ] **Step 1: Compare row counts**

For all 40 tables, compare the restored counts against
`docs/audits/2026-07-29-backup-coverage-baseline.json`. Any difference is a
finding, not a rounding detail.

- [ ] **Step 2: Spot-check content, not just counts**

Row counts alone do not prove the data is intact. Verify at least:

- **PO-037** — its lines and header total match production exactly. This is the
  purchase order the whole rebuild depends on.
- **One split-payment order** from `order_payments` — the payment rows and
  amounts match. This is the table that was missing entirely until Task 1.
- **Sữa đặc (ING-003)** — its `stock_ledger` row count matches.

- [ ] **Step 3: Report the verdict**

In Vietnamese. State plainly whether the backup restored completely. If anything
is missing or wrong, **say so and stop** — Phase 4 must not proceed on a backup
that failed its drill.

- [ ] **Step 4: Commit the result**

```bash
git add docs/audits/
git commit -m "Claude-Sonnet audit: restore drill result"
```

---

### Task 6: Write the runbook, then tear down

- [ ] **Step 1: Write `docs/runbooks/restore-from-backup.md`**

Written for the owner, in Vietnamese, assuming no memory of this session: where
backups live, how to create a scratch project, how to run the restore, how to
verify it worked, and how long it took this time. This is what gets read during
an actual incident, when nobody is calm.

- [ ] **Step 2: Tell the owner he can delete the scratch project**

Do not delete it — it is in his account. Confirm the drill is recorded first.

- [ ] **Step 3: Update tracking**

`DEVELOPMENT-TRACKING.md` and `docs/ROADMAP.md`, including the eight tables that
were missing and the drill's outcome.

- [ ] **Step 4: Commit**

---

## Gate before Phase 4

Phase 4 proceeds **only if Task 5 reports a complete, verified restore**. A
failed or partial drill means the safety net does not exist, and deleting
derived data without one is not acceptable regardless of schedule pressure.
