# Inventory Ledger Clean Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete every derived inventory and cost row, regenerate all of it from
the only three trustworthy sources — sales orders, purchase orders, recipes —
and make it structurally impossible for a script to write inventory data again.

**Architecture:** Seven ordered tasks. A verified local snapshot first, so
nothing that follows depends on the daily backup. Then the engine's trust model
moves from *label* to *provenance*. Then the 13 orphan adjustment rows go, the
constraint that would have prevented them lands, and only then does the rebuild
run — dry-run, owner review of the money differences, apply. Verification
asserts absolute expected values, not agreement between two computations of the
same thing. The direct-write grant is revoked last, once nothing needs it.

**Tech Stack:** TypeScript, Supabase Postgres RPCs and migrations, Vitest,
`vite-node` for scripts.

Spec: `docs/superpowers/specs/2026-07-31-inventory-ledger-clean-rebuild-design.md`.
Read it before Task 1 — it carries the root-cause evidence and the owner's four
decisions, and this plan does not repeat them.

## Global Constraints

- Code and comments in English. Operator-facing strings Vietnamese.
- Every writing script is **dry-run by default**; `--apply` required, exact
  counts and targets printed before writing (`docs/COLLABORATION.md` D.1).
- `npx tsc --noEmit` — 0 errors. Full suite green before every commit.
- One commit per outcome plus its verification (`COLLABORATION.md` D.2).
- Commit prefix `Claude-Sonnet <type>:` (`COLLABORATION.md` E).
- **Do not push.** Do not deploy. Nothing here reaches the live site in this plan.
- Migration numbers continue from `0051` (reserved by the `start_date` plan);
  this plan uses `0052` and `0053`.
- **Stop conditions are not advisory.** Every step that names one halts the plan
  and reports. Do not "fix it up and continue" — three previous rounds did
  exactly that and are why this plan exists.

## Baseline facts (verified against production 2026-07-31, read-only)

| Fact | Value |
|---|---|
| `stock_ledger` rows | 10,345 |
| ...`SALES_CONSUME` | 6,834 |
| ...`PRODUCTION_CONSUME` / `PRODUCTION_YIELD` | 1,840 / 1,449 |
| ...`PO_RECEIPT` | 137 |
| ...`EDIT_REVERSAL` | 72 |
| ...`STOCK_ADJUST` | **13 — all orphans, see below** |
| `stock_adjustments` rows (all time) | **0** |
| `stocktake_sessions` rows (all time) | **0** |
| `production_orders` rows (all time) | **0** |
| Order lines to recost | 2,604 |
| Completed, non-superseded orders | 1,839 |
| Semi-products | 14 |
| Non-zero semi-product balances | 11, totalling 46,170 units |
| Units injected by the 13 orphan rows | **+102,200** |
| Negative balances right now | 0 |

The 13 `STOCK_ADJUST` rows carry `reference_id` values of
`NEGATIVE-STOCK-AUDIT-2026-06-25T07:31:08.402Z` (8 rows, +99,410) and
`PHASE9-NEGATIVE-STOCK-2026-06-26` (5 rows, +2,790). None has a matching
`stock_adjustments` row, because that table has never had one.

---

### Task 1: Snapshot the three primitive sources and prove it restores

**Files:**
- Create: `scripts/snapshot-primitive-sources.ts`
- Create: `scripts/verify-primitive-snapshot-restore.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a snapshot file on disk at a path the later tasks reference but do
  not read. No exported symbols.

**Why this is Task 1 and cannot move.** Everything after this deletes production
data. The daily backup is not the safety net — it is 39.6 MB against a 50 MB
limit and this rebuild adds roughly 14 MB, so it may well fail during the very
window it would be needed. The three primitive tables total about **4.4 MB**;
fetching them takes seconds and removes the dependency entirely.

**"Prove it restores" is the whole point of the task.** `DEVELOPMENT-TRACKING.md`
(2026-07-31) records the Phase 3 restore drill verifying repo code and never the
deployed pipeline — which is how `order_payments` sat unbacked for weeks while a
local script reported 40/40 tables healthy. A file that exists is not a backup.

- [ ] **Step 1: Write the snapshot script**

Create `scripts/snapshot-primitive-sources.ts`. It reads (never writes) and
saves one JSON file containing every row of:

```
orders_v2, order_lines_v2, order_payments,
purchase_orders, purchase_order_lines, purchased_items, purchase_sources, suppliers,
recipes, products, product_variants, product_categories, modifiers, promotions,
semi_products, base_ingredients, item_categories, units, uom_conversions, brands
```

It must page through every table (Supabase caps a select at 1,000 rows), print
one line per table with its row count, and write to
`C:/Users/Admin/Desktop/fnbapp-snapshots/primitives-<ISO timestamp>.json`.

**That directory is outside the repository on purpose.** `.gitignore` already
blocks `fnbapp-backup-*.json` after a 45 MB production dump sat untracked in the
repo root on 2026-07-30; do not create a second way to make that mistake.

- [ ] **Step 2: Run it and check the counts against the table above**

Run: `npx vite-node scripts/snapshot-primitive-sources.ts`

Expected, exactly:
```
orders_v2            1839
order_lines_v2       2604
purchase_orders        62
purchase_order_lines  137
recipes               137
semi_products          14
```

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Nếu order_lines_v2 khác 2.604 hoặc orders_v2 khác 1.839 -> DỪNG.
  Số lệch nghĩa là đã có đơn hàng mới phát sinh trong lúc chụp, hoặc
  script phân trang sai. Cả hai đều phải xử lý trước khi đi tiếp -- ảnh
  chụp thiếu một đơn là dựng lại thiếu một đơn.
```

- [ ] **Step 3: Write the restore-proof script**

Create `scripts/verify-primitive-snapshot-restore.ts`. It must:

1. Read the snapshot file.
2. Load every table into a **scratch Supabase project or a local
   `npx supabase start` instance** — never production. The connection target is
   a required `--target-url` / `--target-key` argument pair with no default, so
   it cannot accidentally point at production.
3. Re-read each table from the target and compare row counts **and** a stable
   checksum per table (sorted row IDs, hashed) against the snapshot.
4. Exit non-zero on any mismatch, printing the table and both values.

- [ ] **Step 4: Run the restore proof**

Run:
```
npx vite-node scripts/verify-primitive-snapshot-restore.ts \
  --snapshot <path> --target-url <scratch url> --target-key <scratch key>
```

Expected: every table reports `MATCH`, process exits 0.

**Stop condition:** any table mismatching. Do not proceed to Task 2 — a snapshot
that does not restore is not a snapshot, and Tasks 3-6 delete production data on
the assumption that it does.

- [ ] **Step 5: Commit**

```bash
git add scripts/snapshot-primitive-sources.ts scripts/verify-primitive-snapshot-restore.ts
git commit -m "Claude-Sonnet feat: snapshot the three primitive sources and prove restore

Precondition for the ledger rebuild. The daily backup cannot serve as its
safety net -- 39.6 MB against a 50 MB limit, and the rebuild adds ~14 MB.
The primitives are 4.4 MB and restore in seconds.

verify-primitive-snapshot-restore.ts loads into a scratch target and compares
counts and per-table checksums, because a file that exists is not a backup --
see DEVELOPMENT-TRACKING.md 2026-07-31 on the Phase 3 drill.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Trust provenance, not the label

**Files:**
- Modify: `lib/full-history-recompute.ts:118-130`, and the
  `buildTrustedPrimitiveLedger` filter at `:188`
- Test: `lib/full-history-recompute.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `buildTrustedPrimitiveLedger` gains one required input field.
  New signature — every caller must pass it:

```ts
buildTrustedPrimitiveLedger(input: {
  purchaseOrders: RawPurchaseOrder[];
  purchaseOrderLines: RawPurchaseOrderLine[];
  purchasedItems: RawPurchasedItem[];
  conversions: RawConversion[];
  rawStockLedger: Array<{          // exact existing name -- not `existingLedger`
    id?: string;
    reference_id?: string;
    item_reference?: string;
    transaction_type?: string;
    quantity_change?: string | number;
    unit_cost?: string | number;
    created_at?: string;
  }>;
  approvedAdjustmentIds: Set<string>;   // NEW -- required, no default
}): { rows: SimLedgerRow[]; skippedPoReceipts: string[] }
```

`approvedAdjustmentIds` holds the `id` of every `stock_adjustments` row with
`status = 'APPROVED'` and a non-null `created_by_id`. Today that set is **empty**
and will stay empty until the owner performs a real stocktake.

**The defect, stated once.** `lib/full-history-recompute.ts:130` reads
`const TRUSTED_PRIMITIVE_TYPES = new Set(["STOCK_ADJUST"])`, on the documented
assumption that the label means "a real physical count". It does not: all 13
rows carrying it are compensating entries from June correction scripts, which
the same file's header comment (lines 30-32) names as exactly the class that
must never be trusted. The engine distinguishes by label where it needed to
distinguish by origin.

- [ ] **Step 1: Write the failing test**

Add to `lib/full-history-recompute.test.ts`:

```ts
describe("buildTrustedPrimitiveLedger trusts provenance, not the label", () => {
  const base = {
    purchaseOrders: [], purchaseOrderLines: [], purchasedItems: [], conversions: [],
  };
  const scriptWritten = {
    id: "STK-AUDIT-1", item_reference: "BTP-008", transaction_type: "STOCK_ADJUST",
    quantity_change: "37370", unit_cost: "0",
    reference_id: "NEGATIVE-STOCK-AUDIT-2026-06-25T07:31:08.402Z",
    created_at: "2026-06-25T07:31:08.402Z",
  };

  it("ignores a STOCK_ADJUST row with no approved stock_adjustments parent", () => {
    const { rows } = buildTrustedPrimitiveLedger({
      ...base, existingLedger: [scriptWritten], approvedAdjustmentIds: new Set(),
    });
    expect(rows.filter(r => r.transaction_type === "STOCK_ADJUST")).toHaveLength(0);
  });

  it("keeps a STOCK_ADJUST row whose reference_id is an approved adjustment", () => {
    const ownerCounted = { ...scriptWritten, id: "STK-1", reference_id: "ADJ-001" };
    const { rows } = buildTrustedPrimitiveLedger({
      ...base, existingLedger: [ownerCounted],
      approvedAdjustmentIds: new Set(["ADJ-001"]),
    });
    expect(rows.filter(r => r.transaction_type === "STOCK_ADJUST")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify both fail**

Run: `npx vitest run lib/full-history-recompute.test.ts -t "trusts provenance"`
Expected: FAIL — `approvedAdjustmentIds` is not a parameter yet.

- [ ] **Step 3: Replace the type-keyed set with a provenance check**

Delete the `TRUSTED_PRIMITIVE_TYPES` constant and its comment block
(lines 118-130). Add `approvedAdjustmentIds: Set<string>` to the input type.
Replace the filter at line 188:

```ts
    if (!row.transaction_type || !TRUSTED_PRIMITIVE_TYPES.has(row.transaction_type)) continue;
```

with:

```ts
    // Trust origin, not label. A STOCK_ADJUST row is a primitive fact only when
    // it descends from a stock_adjustments row the owner approved in the UI.
    // The 13 rows written by the June 2026 correction scripts carry this label
    // and no parent, which is how three rebuilds each re-added +102,200 units
    // on top of an otherwise correct result.
    if (row.transaction_type !== "STOCK_ADJUST") continue;
    if (!row.reference_id || !input.approvedAdjustmentIds.has(row.reference_id)) continue;
```

- [ ] **Step 4: Update every caller**

Run: `npx tsc --noEmit` and fix each error by loading the approved set. In
callers that read the database, the query is:

```ts
const { data } = await db.from("stock_adjustments")
  .select("id").eq("status", "APPROVED").not("created_by_id", "is", null);
const approvedAdjustmentIds = new Set((data ?? []).map(r => r.id));
```

Pass `new Set()` in tests that do not exercise adjustments. **Do not add a
default value to the parameter** — a caller that forgets it must fail to
compile, not silently trust nothing or everything.

- [ ] **Step 5: Run tests and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/full-history-recompute.ts lib/full-history-recompute.test.ts
git commit -m "Claude-Sonnet fix: rebuild engine trusts provenance, not transaction_type

TRUSTED_PRIMITIVE_TYPES treated every STOCK_ADJUST row as a physical count.
All 13 in production are compensating entries from two June correction
scripts, with no stock_adjustments parent -- the table has never had a row.
The file's own header names that class as untrustworthy; the code let them
through because they carry a different label.

A STOCK_ADJUST row is now primitive only when its reference_id resolves to an
APPROVED stock_adjustments row with a non-null created_by_id. That set is
empty today and stays empty until the owner performs a real stocktake.

approvedAdjustmentIds is required, not defaulted: a caller that forgets it
must fail to compile.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Remove the 13 orphan adjustment rows

**Files:**
- Create: `scripts/remove-orphan-stock-adjustments.ts`

**Interfaces:** none. One-off operation; later tasks depend only on the database
state it leaves.

**Why they must go rather than merely be untrusted.** Task 2 stops the *engine*
from treating them as input. It does not remove them from `stock_ledger`, and
`inventory_balances` is maintained by a trigger over every ledger row
(`0038_materialize_inventory_balances.sql:65-68`) regardless of what any engine
thinks. Left in place they keep inflating the live balance by 102,200 units.

- [ ] **Step 1: Write the script**

Create `scripts/remove-orphan-stock-adjustments.ts`. Dry-run by default.

1. Select every `stock_ledger` row with `transaction_type = 'STOCK_ADJUST'`.
   **Expected: exactly 13.** Any other count → print all of them, exit non-zero.
2. For each, check whether `reference_id` matches a `stock_adjustments` row.
   **Expected: zero matches.** Any match → print it, exit non-zero. A real
   adjustment must never be deleted by this script.
3. Print each row: id, item, quantity, `reference_id`.
4. Print the per-item total to be removed, and the current balance of each
   affected item alongside what it becomes.
5. Under `--apply`, delete them inside a single transaction, then re-read and
   print the count remaining.

- [ ] **Step 2: Dry run**

Run: `npx vite-node scripts/remove-orphan-stock-adjustments.ts`

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  STOCK_ADJUST rows found      : 13
  with a stock_adjustments parent : 0
  total quantity to remove     : +102.200

  BTP-008  hiện 24.570  ->  bỏ 38.780
  BTP-001  hiện  9.400  ->  bỏ 27.900
  BTP-007  hiện    160  ->  bỏ    160

Sai bất kỳ con số nào -> DỪNG, đừng chạy --apply.
Đặc biệt: nếu "with a stock_adjustments parent" khác 0 thì có một phiếu
kiểm kê thật đã tồn tại -- báo chủ quán, đừng xoá.
```

Balances going negative at this step is **expected and correct** — the rebuild
in Task 5 regenerates them. Do not react to it.

- [ ] **Step 3: Apply**

Run: `npx vite-node scripts/remove-orphan-stock-adjustments.ts --apply`
Expected: `deleted 13`, then `STOCK_ADJUST rows remaining: 0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/remove-orphan-stock-adjustments.ts
git commit -m "Claude-Sonnet fix: remove 13 orphan STOCK_ADJUST rows (+102,200 units)

Two June 2026 correction passes injected quantity to clear negative
semi-product balances. The 24/07 rebuild then regenerated implicit production
that covered the same sales properly, but nobody removed the injections, so
every hole was plugged twice. BTP-007 is the clean case: four sales of -40,
four yields of +40 netting to zero, then +160 sitting on top since 25/06.

Untrusting them in the engine (previous commit) is not enough --
inventory_balances is maintained by a trigger over every ledger row.

Refuses to run if any of the 13 turns out to have a stock_adjustments parent.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Make an unparented adjustment impossible

**Files:**
- Create: `supabase/migrations/0052_stock_ledger_adjust_requires_approved_source.sql`
- Modify within the same migration: `submit_stock_adjustment_atomic` and
  `approve_stock_adjustment_atomic` (from `0019_atomic_stock_adjustments.sql`)

**Interfaces:** `stock_ledger` gains `stock_adjustment_id text` referencing
`stock_adjustments(id)`, nullable, required whenever
`transaction_type = 'STOCK_ADJUST'`.

- [ ] **Step 1: Write the migration**

```sql
-- An adjustment row cannot exist without an owner-approved parent.
--
-- stock_ledger.reference_id is plain text with no foreign key. 0019 uses it by
-- convention (see 0019:152, `where reference_id = p_adjustment_id`) but nothing
-- enforced it, so two June 2026 scripts wrote 13 rows with reference_id values
-- like 'NEGATIVE-STOCK-AUDIT-...' pointing at nothing. Those rows then read as
-- primitive facts to the rebuild engine for a month.

alter table public.stock_ledger
  add column if not exists stock_adjustment_id text
    references public.stock_adjustments(id);

do $$
declare
  orphan_count integer;
begin
  select count(*) into orphan_count
    from public.stock_ledger
   where transaction_type = 'STOCK_ADJUST' and stock_adjustment_id is null;
  if orphan_count > 0 then
    raise exception
      'Cannot add stock_ledger_adjust_requires_approved_source: % unparented STOCK_ADJUST rows remain. Run scripts/remove-orphan-stock-adjustments.ts --apply first.',
      orphan_count;
  end if;
end $$;

alter table public.stock_ledger
  add constraint stock_ledger_adjust_requires_approved_source
  check (transaction_type <> 'STOCK_ADJUST' or stock_adjustment_id is not null);
```

Then re-declare both `0019` functions unchanged except that every
`insert into public.stock_ledger` they perform also sets
`stock_adjustment_id = p_adjustment_id`.

- [ ] **Step 2: Prove the guard fires**

In a scratch transaction against a non-production database:

```sql
begin;
insert into public.stock_ledger
  (id, transaction_type, reference_id, item_reference, quantity_change, unit_cost, created_at)
  values ('TEST-1','STOCK_ADJUST','FORGED-REF','BTP-008',999,0,now());
rollback;
```

Expected: `new row ... violates check constraint "stock_ledger_adjust_requires_approved_source"`.

```
VÍ DỤ ĐÃ TÍNH SẴN:
  Đây chính xác là dạng dòng mà hai script tháng 6 đã ghi được.
  Nếu câu lệnh trên chạy THÀNH CÔNG -> ràng buộc chưa có tác dụng, DỪNG.
```

- [ ] **Step 3: Apply, then exercise the real path end to end**

Run `npx supabase db push`, then through the admin UI on the local dev server:
submit a stock adjustment, approve it, and confirm the resulting ledger row has
a non-null `stock_adjustment_id` pointing at the new `stock_adjustments` row.

**A migration that blocks forged rows but also blocks the real path is a
regression.** Verify the real path before committing.

- [ ] **Step 4: Run tests, type check, commit**

```bash
npx vitest run && npx tsc --noEmit
git add supabase/migrations/0052_stock_ledger_adjust_requires_approved_source.sql
git commit -m "Claude-Sonnet feat: migration 0052, STOCK_ADJUST requires an approved parent

reference_id was plain text with no foreign key, so a script could write an
adjustment pointing at nothing -- which is what happened 13 times in June.
Adds stock_adjustment_id with a real FK and a CHECK requiring it for
STOCK_ADJUST rows, and threads it through 0019's submit/approve RPCs.

Guard raises if any unparented row survives, so a partial cleanup cannot pass
as success.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Full rebuild — dry run and owner review

**Files:**
- Modify: `scripts/apply-full-history-stock-ledger-rebuild.ts` (pass
  `approvedAdjustmentIds`)
- Create: `docs/audits/2026-08-01-ledger-rebuild-dry-run.md`

**Interfaces:** uses the existing `rebuild_stock_ledger_for_order(p_order_id,
p_run_id, p_expected_delete_count, ...)` RPC from
`0034_rebuild_stock_ledger_from_scratch.sql`, which per order takes an advisory
lock, refuses if the derived-row count has changed since planning, deletes that
order's derived rows, regenerates them, and updates `cost_at_sale` on its lines.
**No new rebuild mechanism is written.** The engine and the apply path already
exist and are reviewed; only their trusted input changed, in Task 2.

- [ ] **Step 1: Thread the approved-adjustment set through the script**

Load it as in Task 2 Step 4 and pass it to `buildTrustedPrimitiveLedger`.
Print the count at startup — expected `0`.

- [ ] **Step 2: Dry run over all 1,839 orders**

Run: `npx vite-node scripts/apply-full-history-stock-ledger-rebuild.ts`

- [ ] **Step 3: Write the dry-run report for the owner**

`docs/audits/2026-08-01-ledger-rebuild-dry-run.md`, with a plain-Vietnamese
summary at the top, covering:

1. **All 14 semi-product balances after the rebuild.** Expected: every one
   exactly `0.000`. Reasoning is forced, not estimated — after Task 3 nothing
   adds semi-product stock except implicit production, which yields exactly the
   shortfall the same sale consumes (`lib/inventory-consumption.ts:138`,
   `:297-306`), and `production_orders` has 0 rows.
2. **Every raw-ingredient balance, before and after.** Expect falls: roughly
   56,030 units of semi-product were consumed from the phantom stock, and those
   sales never triggered implicit production, so their raw ingredients were
   never debited. They will be now.
3. **Any balance that ends negative**, by item, with the shortfall.
4. **`cost_at_sale` movement**, aggregated by month: total before, total after,
   difference, and the ten largest per-line changes with product names.
5. **The 72 `EDIT_REVERSAL` rows** — how many regenerate identically and how
   many do not. The spec does not assert these are safe; this is where that is
   measured.

- [ ] **Step 4: Owner review — hard gate**

Present the report. Two things need a decision and neither is the implementer's
to make:

- **Negative balances.** The response is fixed in advance (spec 3.3): enter the
  missing purchase, fix the recipe, or mark the item non-inventory — then re-run.
  **Never inject a quantity.** But *which* applies to each item is the owner's
  call, and it may require him to find a paper receipt.
- **Changed historical margins.** Monthly profit figures he has already seen
  will move. He should see the size before it happens, not after.

**Do not run `--apply` until the owner has responded.** Stop here.

- [ ] **Step 5: Commit the dry run**

```bash
git add scripts/apply-full-history-stock-ledger-rebuild.ts docs/audits/2026-08-01-ledger-rebuild-dry-run.md
git commit -m "Claude-Sonnet docs: full-history rebuild dry run, no data written

Dry run over 1,839 orders with the corrected trust model. Reports predicted
semi-product balances, raw-ingredient before/after, negatives, cost_at_sale
movement by month, and EDIT_REVERSAL regeneration fidelity.

Awaiting owner review before --apply.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Apply and verify

**Files:**
- Create: `scripts/verify-ledger-rebuild.ts`
- Create: `docs/audits/2026-08-01-ledger-rebuild-result.md`

- [ ] **Step 1: Apply**

Run: `npx vite-node scripts/apply-full-history-stock-ledger-rebuild.ts --apply`

- [ ] **Step 2: Write the verification script**

`scripts/verify-ledger-rebuild.ts`, read-only, asserting **absolute expected
values**. `DEVELOPMENT-TRACKING.md` records that
`scripts/audit-full-history-recompute.ts:156` computed "is anything negative"
from the mismatched-items list alone, so a balance the system agreed with itself
about could never be reported — which is why every audit read clean while the
screen showed −6,651 g. Do not compare two computations of the same thing.

Assertions, each pass/fail on its own:

1. Every one of the 14 semi-products has balance exactly `0.000`.
2. `count(stock_ledger where transaction_type = 'STOCK_ADJUST')` equals
   `count(stock_adjustments where status = 'APPROVED')`. Today both are 0.
3. No `stock_ledger` row has `transaction_type = 'STOCK_ADJUST'` with a null
   `stock_adjustment_id`.
4. Every `order_lines_v2.cost_at_sale` equals the engine's recomputed value for
   that line, to the stored precision.
5. `inventory_balances` equals a fresh sum over `stock_ledger` per item — this
   one *is* a two-way comparison, and it is legitimate because it checks the
   `0038` trigger, not the engine.

- [ ] **Step 3: Prove idempotence — the direct test of "never a fourth time"**

Run the dry run again against the just-rebuilt data. Expected: **zero orders
with any change**. A rebuild that is not idempotent is still accumulating
residue somewhere, and that is precisely the failure this whole program exists
to end.

**Stop condition:** any order shows a difference. Report it; do not apply again.

- [ ] **Step 4: Run the standing audits**

```
npx vite-node scripts/audit-mac-cogs-drift.ts
npx vite-node scripts/audit-cogs-drift.ts
npx vite-node scripts/audit-pnl-mac-consistency.ts
npx vite-node scripts/audit-current-stock.ts
npx vite-node scripts/audit-negative-stock-periods.ts
```

Filenames verified present 2026-07-31. Note it is `audit-mac-cogs-drift.ts`;
there is no `audit-mac-drift.ts`.

Expected per `COLLABORATION.md` E: 0 mismatch, or documented as informational.

Read each script's own reporting logic before trusting a clean result. The
`audit-full-history-recompute.ts:156` defect — deriving "is anything negative"
from the mismatched-items list only — means a clean line from an audit in this
family is not automatically evidence. If a script cannot report a problem it
was not already looking for, say so in the result report rather than counting
it as a pass.

- [ ] **Step 5: Write the result report and commit**

`docs/audits/2026-08-01-ledger-rebuild-result.md` — plain-Vietnamese summary,
then before/after for every item, every assertion with its measured value, and
the idempotence result.

```bash
git add scripts/verify-ledger-rebuild.ts docs/audits/2026-08-01-ledger-rebuild-result.md
git commit -m "Claude-Sonnet feat: verify the rebuilt ledger against absolute expected values

All 14 semi-product balances exactly 0.000; STOCK_ADJUST count equals approved
adjustment count; no unparented adjustment rows; cost_at_sale matches the
engine per line; inventory_balances matches a fresh ledger sum.

Asserts absolute values rather than agreement between two computations --
audit-full-history-recompute.ts:156 did the latter and could never report a
balance the system agreed with itself about.

Second dry run reports zero changing orders, which is the direct test of
whether this will be needed a fourth time.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Revoke direct write access to the ledger

**Files:**
- Create: `supabase/migrations/0053_revoke_direct_stock_ledger_writes.sql`
- Create: `docs/audits/2026-08-01-direct-ledger-writers.md`

**Owner decision D7: absolute blocking, not merely visible.** Verified feasible
in spec 4.2b — exactly one application path writes `stock_ledger` directly
(`lib/sheets-db-v2.ts:60`), it has no production caller, and
`app/pos/actions.test.ts:19` asserts checkout must not use it. Every other write
goes through a `security definer` function, which executes as its owner and is
unaffected by revoking the caller's grant.

- [ ] **Step 1: Enumerate every direct writer before revoking anything**

```bash
grep -rn 'from("stock_ledger")\|from("Stock_Ledger")\|insert("Stock_Ledger"\|insertMany("Stock_Ledger"\|update("Stock_Ledger"' app/ lib/ scripts/ --include=*.ts
```

Record all of them in `docs/audits/2026-08-01-direct-ledger-writers.md` with,
for each: whether it still has a caller, and whether it is converted to an RPC
or retired. **Scripts breaking after the revoke is the intended outcome. Do not
grant an exception to keep one working.**

- [ ] **Step 2: Write the migration**

```sql
-- Only reviewed RPCs may write the inventory ledger.
--
-- Two June 2026 scripts wrote 13 rows directly with the service key, and those
-- rows read as primitive facts to the rebuild engine for a month. 0052 stops a
-- malformed adjustment; this stops an arbitrary row.
--
-- Every writer is a `security definer` function, which executes as its owner
-- and keeps working. The single direct path in application code
-- (lib/sheets-db-v2.ts insertOrderV2Records) has no production caller --
-- app/pos/actions.test.ts asserts checkout must not use it.

revoke insert, update, delete on table public.stock_ledger from service_role;
```

- [ ] **Step 3: Prove both directions**

Against the local dev server, in this order:

1. A direct insert with the service key **fails** with a permission error.
2. A POS checkout **succeeds** and writes its ledger rows.
3. A stock adjustment submitted and approved through the UI **succeeds**.

**Stop condition:** 2 or 3 failing. Revoking write access must not stop the shop
selling. Roll the migration back and report.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0053_revoke_direct_stock_ledger_writes.sql docs/audits/2026-08-01-direct-ledger-writers.md
git commit -m "Claude-Sonnet feat: migration 0053, only RPCs may write stock_ledger

Owner requirement: block scripts absolutely, not merely make them visible.
service_role loses insert/update/delete on stock_ledger; every writer is a
security definer function and is unaffected.

What this does not stop, stated plainly: a script can still call the
adjustment RPCs and produce a real, owner-visible stock_adjustments row. What
becomes impossible is the June pattern -- ledger rows appearing with a
reference_id pointing at nothing and no parent record anywhere.

Verified both directions: direct insert refused, POS checkout and UI
adjustment both still work.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Out of scope

- **The backup rescope and CSV export.** Next piece of work, and this one is its
  precondition — see spec 6.1 and 6.3.
- **Semi-product production and disposal entry** (problem E). Balances of 0.000
  after this rebuild are correct given nothing records cooking; making them
  reflect physical reality is separate.
- **`deleteSemiProductAction` performs no safety checks.** See the `start_date`
  plan's Out of scope.
- **`lib/sheets-db-v2.ts` becomes dead code** after Task 7. Flag, do not delete.
- **Operating-expense capture** (problem D) and everything in `OPEN-ITEMS.md`.

## Verification bar

Per `docs/COLLABORATION.md` section E, plus this plan's own:

- `npx tsc --noEmit` — 0 errors; full suite green before every commit.
- All 14 semi-product balances exactly `0.000`.
- Second dry run reports zero changing orders (idempotence).
- MAC drift, COGS drift, P&L MAC consistency, current stock audits: 0 mismatch
  or documented as informational.
- Owner has reviewed the dry-run report before `--apply` ran.
- No push, no deploy.

## Ownership

Claude Sonnet 5 implements. Opus 5 coordinator reviews **every commit** before
the next task starts — not every task, every commit. Tasks 3, 5, 6 and 7 write
or delete production data; none proceeds on the implementer's own sign-off.
