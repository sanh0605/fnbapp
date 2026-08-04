# Issue-Based COGS — Plan B: The Parallel Path

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute COGS from goods issued, show it beside the existing figure,
and change nothing the old path reports.

**Architecture:** Stock and issues move to the purchased-item level, where the
owner actually buys and hands out goods. A period count is one **source** of
issue events rather than the answer itself, so the quick-issue button deferred
to a later plan slots in without touching valuation. The new figure appears
beside the old one in the P&L; the old one keeps driving everything until
Plan C.

**Tech Stack:** TypeScript, Vitest, Supabase Postgres migrations, `vite-node`.

**Spec:** `docs/superpowers/specs/2026-08-02-issue-based-cogs-design.md`

## Challenge round 1 — findings, and what they changed

Sonnet challenged this plan 2026-08-04 against the three targets below. All
three found real defects; every claim was re-verified against the source before
being accepted. The plan below is the corrected version. Recorded here so a
later reader sees why the SQL work exists.

1. **Opening balance from `purchase_order_lines` alone.** Two of 52 purchased
   items have no completed purchase line: `SPM-005` (Đá viên) and `SPM-052`
   (Khoai lang). Both map to base ingredients flagged `is_non_inventory = TRUE`,
   and `app/admin/inventory/stocktake/actions.ts:96` already filters on exactly
   that flag. Task 3 now states the filter must be carried across the join
   rather than left implied — without it, `computeIssueCosting` throws on the
   first count and blocks the whole session.
2. **Parallel display.** `getPnLDataV2` has exactly one consumer
   (`app/admin/reports/pnl/page.tsx`), and nothing else in the repo reads
   `totalCOGS`. But `app/admin/reports/actions.ts:318-324` does re-derive from
   it: the rounding remainder is forced onto the first row of `cogsDetails` so
   the detail table sums to `totalCOGS` exactly. Task 4 now names that block and
   forbids the new figure from entering `cogsDetails` or that sum.
3. **`item_type`.** The table constraint is not the only gate. Three SQL
   functions assume two values, and one of them fails silently — the defect
   shape that has cost this project six separate incidents. Details in Tasks 2
   and 3; this is now the largest piece of work in the plan, not a one-line
   constraint widening.

**A fourth, found while verifying the third.**
`supabase/migrations/0038_materialize_inventory_balances.sql:64-68` defines
`trg_stock_ledger_inventory_balances`, firing `after insert or delete or update`
on `stock_ledger` and accumulating `quantity_change` into `inventory_balances`
keyed by `item_reference`. Writing a `STOCK_ADJUST` row for a purchased item
would therefore not merely add a ledger row — it would silently mint new
balance rows in the table the live stock screens read.

Resolution, decided rather than guarded against: **purchased items write no
`stock_ledger` row at all.** They write `stock_issues` only. An untouched table
fires no trigger, so the old figure holds still by construction instead of by
argument.

## Global Constraints

- Code and comments in English. User-facing strings Vietnamese.
- `npx tsc --noEmit` — 0 errors. Full suite green before each commit.
  Baseline 957 tests.
- **The old COGS path keeps working, unchanged, throughout.** Revenue and the
  existing COGS figure must read identically at every step. This plan adds a
  second computation; it replaces nothing.
- Nothing is deleted. Deletion is Plan C.
- Any script that writes data is dry-run by default, `--apply` to write, exact
  counts printed first, owner approves the apply. (`CLAUDE.md` section 2.)
- Migrations continue from `0052`.
- Do not push.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `lib/issue-costing.ts` (create) | Pure: purchases + issues → running average, issue values, closing balance | 1 |
| `lib/issue-costing.test.ts` (create) | The owner's worked example, to the dong | 1 |
| `supabase/migrations/0052_stock_issues.sql` (create) | `stock_issues` table; widen `stocktake_lines.item_type`; widen the allow-list inside `open_stocktake_session_atomic` | 2 |
| `supabase/migrations/0053_stocktake_purchased_items.sql` (create) | Rewrite `save_stocktake_line_atomic` and `apply_stocktake_session_atomic` to branch on `item_type` | 3 |
| `app/admin/inventory/stocktake/**` (modify) | Count purchased items; emit issue events | 3 |
| `app/admin/reports/actions.ts` (modify) | Second COGS figure alongside the first | 4 |
| `app/admin/reports/pnl/page.tsx` (modify) | Show both, labelled in Vietnamese | 4 |

---

### Task 1: The costing engine

**Files:**
- Create: `lib/issue-costing.ts`
- Test: `lib/issue-costing.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks. Pure functions over data passed in, no
  database access — the same shape as `lib/full-history-recompute.ts`.
- Produces:
  ```ts
  type Purchase = { purchased_item_id: string; at: string; base_quantity: number; subtotal: number };
  type Issue    = { purchased_item_id: string; at: string; base_quantity: number; source: "STOCKTAKE" | "MANUAL" };
  type ItemCost = { purchased_item_id: string; issued_quantity: number; issued_value: number; closing_quantity: number; closing_value: number };

  computeIssueCosting(purchases: Purchase[], issues: Issue[]): ItemCost[]
  ```

Replay purchases and issues in time order per item. A purchase raises quantity
and value; an issue removes quantity at the current average and accrues that
value as cost. Sales are not an input — that is the entire point.

- [ ] **Step 1: Write the failing test**

Create `lib/issue-costing.test.ts`. The first case is the owner's own example,
extended in the spec to expose the averaging rule:

```ts
import { describe, it, expect } from "vitest";
import { computeIssueCosting } from "@/lib/issue-costing";

describe("computeIssueCosting", () => {
  // Chủ quán chốt 2026-08-02, ví dụ của chính anh, mở rộng ở spec mục 1.
  it("giá vốn theo bình quân tại lúc xuất", () => {
    const [row] = computeIssueCosting(
      [
        { purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 10, subtotal: 100 },
        { purchased_item_id: "SPM-X", at: "2026-08-05T00:00:00Z", base_quantity: 10, subtotal: 120 },
      ],
      [
        { purchased_item_id: "SPM-X", at: "2026-08-02T01:00:00Z", base_quantity: 2, source: "STOCKTAKE" },
        { purchased_item_id: "SPM-X", at: "2026-08-07T00:00:00Z", base_quantity: 3, source: "STOCKTAKE" },
      ],
    );

    // 02/08: 10 túi, bình quân 10,00 -> xuất 2 = 20,00
    // 05/08: còn 8 (=80đ) + 10 (=120đ) = 18 túi / 200đ -> bình quân 11,111...
    // 07/08: xuất 3 = 33,333...
    expect(row.issued_quantity).toBe(5);
    expect(row.issued_value).toBeCloseTo(53.333333, 4);
    expect(row.closing_quantity).toBe(15);
    expect(row.closing_value).toBeCloseTo(166.666667, 4);
  });

  it("xuất trước khi nhập thì báo lỗi, không âm thầm cho giá 0", () => {
    expect(() => computeIssueCosting(
      [{ purchased_item_id: "SPM-X", at: "2026-08-05T00:00:00Z", base_quantity: 10, subtotal: 100 }],
      [{ purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" }],
    )).toThrow(/SPM-X/);
  });

  it("xuất nhiều hơn tồn thì báo lỗi", () => {
    expect(() => computeIssueCosting(
      [{ purchased_item_id: "SPM-X", at: "2026-08-01T00:00:00Z", base_quantity: 5, subtotal: 50 }],
      [{ purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 6, source: "STOCKTAKE" }],
    )).toThrow(/SPM-X/);
  });

  it("hai mặt hàng không trộn giá vào nhau", () => {
    const rows = computeIssueCosting(
      [
        { purchased_item_id: "SPM-A", at: "2026-08-01T00:00:00Z", base_quantity: 10, subtotal: 100 },
        { purchased_item_id: "SPM-B", at: "2026-08-01T00:00:00Z", base_quantity: 10, subtotal: 500 },
      ],
      [
        { purchased_item_id: "SPM-A", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" },
        { purchased_item_id: "SPM-B", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" },
      ],
    );
    expect(rows.find(r => r.purchased_item_id === "SPM-A")!.issued_value).toBeCloseTo(10, 6);
    expect(rows.find(r => r.purchased_item_id === "SPM-B")!.issued_value).toBeCloseTo(50, 6);
  });

  it("không làm tròn giữa chừng", () => {
    const [row] = computeIssueCosting(
      [{ purchased_item_id: "SPM-X", at: "2026-08-01T00:00:00Z", base_quantity: 3, subtotal: 10 }],
      [{ purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" }],
    );
    expect(row.issued_value).toBeCloseTo(3.333333, 6);
  });
});
```

The last case exists because rounding mid-computation was a real defect here on
2026-07-30 (`65c3e9a`). Do not reintroduce it.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/issue-costing.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the engine**

Sort purchases and issues together by timestamp, per item. Maintain `quantity`
and `value`; on issue, take `value / quantity × issued` and subtract both.
Throw — never return zero — when an issue precedes any purchase or exceeds the
quantity on hand: a silent zero is indistinguishable from correct costing, and
that failure shape has cost this project six separate defects.

- [ ] **Step 4: Tests and suite**

Run: `npx vitest run lib/issue-costing.test.ts && npx vitest run && npx tsc --noEmit`
Expected: 5 new tests pass, 962 total, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/issue-costing.ts lib/issue-costing.test.ts
git commit -m "Claude-Sonnet feat: cost goods at the moment they leave stock

Pure replay of purchases and issues per purchased item, weighted average at
issue time. Sales and recipes are deliberately not inputs.

Locks the owner's own worked example to the dong, refuses to value an issue
that precedes any purchase or exceeds stock on hand, and keeps full precision
throughout -- mid-computation rounding was a real defect here on 2026-07-30.

Not wired to anything yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Somewhere to record an issue

**Files:**
- Create: `supabase/migrations/0052_stock_issues.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: the `stock_issues` table Task 3 writes and Task 4 reads.

**Read the bulk-data-change skill before writing this migration**
(`fnbapp-bulk-data-change`). It exists because a migration here on 2026-07-31
targeted a trigger's name instead of its function's and applied cleanly while
doing nothing.

Two changes:

**A new `stock_issues` table.** Deliberately separate from `stock_ledger`, which
Plan C empties down to purchase receipts. Columns: `id`, `purchased_item_id`,
`issued_at`, `base_quantity`, `source` (`STOCKTAKE` | `MANUAL`),
`session_id` (nullable, set when it came from a count), `note`, `created_at`.

`source` is the field that makes the deferred counter button additive rather
than a rewrite. Do not omit it because only one value is used today.

**Widen `stocktake_lines.item_type`** to accept `PURCHASED_ITEM` alongside the
two existing values. Counting has to happen at the level the owner buys at.

**Widen the allow-list inside `open_stocktake_session_atomic`.** The table
constraint is not the only gate — `0036_stocktake_sessions.sql:146-147` carries
its own hardcoded list and raises an exception on anything else:

```sql
if v_item.item_type not in ('BASE_INGREDIENT', 'SEMI_PRODUCT') then
  raise exception 'Invalid item_type for %: %', v_item.item_reference, v_item.item_type;
```

Widening the constraint without widening this leaves every count of a purchased
item rejected at the moment the session opens. Re-declare the function with
`PURCHASED_ITEM` added; keep the exception for a genuinely invalid fourth value.

- [ ] **Step 1: List the target tables' triggers before writing**

```sql
select tgname, pg_get_triggerdef(oid)
  from pg_trigger
 where tgrelid in ('public.stocktake_lines'::regclass, 'public.stock_ledger'::regclass)
   and not tgisinternal;
```

State, for each, what it does with the rows this migration touches. The
`start_date` incident happened because this step did not exist.

- [ ] **Step 2: Write the migration**

Widening a `check` constraint requires dropping and re-adding it. Name the new
constraint the same as the old one so a future reader finds one constraint, not
two generations of it.

- [ ] **Step 3: Verify the constraint accepts three values and still refuses a fourth**

Prove both directions, at **both** gates — the table constraint and the
function's allow-list. A widened constraint that accepts anything is not a
constraint, and a widened constraint sitting behind an un-widened function
accepts nothing at all.

- [ ] **Step 4: Apply and confirm**

Run: `npx supabase db push`, then confirm `stock_issues` exists,
`stocktake_lines` accepts `PURCHASED_ITEM`, and
`open_stocktake_session_atomic` opens a session containing a `PURCHASED_ITEM`
line without raising.

- [ ] **Step 5: Commit**

---

### Task 3: Count purchased items, produce issues

**Files:**
- Create: `supabase/migrations/0053_stocktake_purchased_items.sql`
- Modify: `app/admin/inventory/stocktake/actions.ts`
- Modify: `app/admin/inventory/stocktake/components/StocktakeClient.tsx`
- Modify: `lib/stocktake-transaction.ts`

**Interfaces:**
- Consumes: `stock_issues` from Task 2.
- Produces: `STOCKTAKE` rows in `stock_issues`, one per counted item with a
  shortfall.

The screen exists, is deployed, and has never been used —
`stocktake_sessions` holds 0 rows. It counts generic ingredients and
semi-products; it must count purchased items.

**Three things must change together, and two of them are in SQL.** The screen
alone is not enough; the RPCs behind it are written for two item types.

**(a) The count list must carry the non-inventory filter across the join.**
`actions.ts:96` filters base ingredients on
`is_non_inventory !== true && is_non_inventory !== "TRUE"`. The purchased-item
list must apply the same filter through `base_ingredient_id`. Two items depend
on this — Đá viên and Khoai lang have no purchase line at all, and
`computeIssueCosting` correctly refuses to value an issue against them. Correct
refusal at the wrong moment still blocks the whole session.

**(b) `save_stocktake_line_atomic` computes theoretical stock from the wrong
table for purchased items.** `0036_stocktake_sessions.sql:206-207` reads:

```sql
select coalesce(sum(quantity_change), 0) into v_theoretical
from public.stock_ledger where item_reference = v_item_reference;
```

`stock_ledger.item_reference` holds base-ingredient ids (`NNL-xxx`, `ING-xxx`),
never purchased-item ids (`SPM-xxx`) — spec section 2. A `PURCHASED_ITEM` line
therefore matches zero ledger rows and `theoretical_at_count` lands at **0**
without error, for essentially every item counted. That is the silent-zero
shape, again.

Branch on `item_type`. For `PURCHASED_ITEM`, theoretical stock at the moment of
counting is:

```
sum(base_quantity of that item's completed purchase lines, up to now)
  − sum(base_quantity of that item's stock_issues rows, up to now)
```

Leave the two existing types reading `stock_ledger` exactly as they do today.

**(c) `apply_stocktake_session_atomic` must not touch `stock_ledger` for
purchased items.** `0037_apply_stocktake_session.sql:74-76` repeats the same
wrong query, and lines 109-121 then insert a `STOCK_ADJUST` row. That insert
fires `trg_stock_ledger_inventory_balances`
(`0038_materialize_inventory_balances.sql:64-68`), which mints a new
`inventory_balances` row keyed by the purchased-item id.

Split the write path by `item_type`:

| `item_type` | Writes |
|---|---|
| `BASE_INGREDIENT`, `SEMI_PRODUCT` | `stock_ledger` `STOCK_ADJUST` — unchanged, byte for byte |
| `PURCHASED_ITEM` | `stock_issues` only. No ledger row, no trigger, no balance row |

Both writes stay inside the one existing transaction.

**(d) A count above everything ever purchased blocks its own line and shows its
siblings.** Owner decision 2026-08-04, recorded in `docs/BUSINESS-RULES.md`.

Two situations were being conflated, and only one needs handling:

- *Staff issued the wrong brand.* Costs nothing and needs no rule. The count is
  taken per purchased item, so a bag taken by mistake simply leaves that bag's
  own item short — it is valued correctly without anyone declaring intent.
  Over-issuing likewise lowers a count and raises cost, which is the truth.
- *The count exceeds the item's total ever purchased.* No handling error
  produces this; goods are physically present that no purchase line explains.
  Either the purchase was recorded against a different item code, or the stock
  predates the system.

For the second case, `save_stocktake_line_atomic` refuses that one line and
returns, alongside the refusal, every other purchased item sharing its
`base_ingredient_id` with each one's total purchased and current counted
quantity. A mis-recorded purchase almost always lands on a sibling brand, and
three numbers side by side make that visible where a bare error message would
not.

The refusal is scoped to the line. Other items in the session save normally —
the owner does not restart a count because one item disagrees.

Do not value the surplus. Any price assigned to goods with no purchase behind
them is a guess entering the cost figure permanently.

**The arithmetic, and why the count is an input rather than the answer:**

```
đã xuất chưa ghi = tồn đầu kỳ + nhập trong kỳ − xuất lẻ đã ghi − đếm được
```

With no manual issues yet, the middle term is zero and this reduces to the
simple form. When the counter button arrives it becomes non-zero and **nothing
in Task 1 or Task 4 changes** — which is the whole reason for building it this
way today.

- [ ] **Step 1: Write the failing test for the shortfall arithmetic**

Include a case with a non-zero manual issue, even though nothing produces one
yet. That case is the proof the deferred button will not require a rewrite.

- [ ] **Step 2: Extend the count list to purchased items, carrying the filter**

Point (a) above. Verify by count, not by eye: the list must exclude every
purchased item whose base ingredient is flagged `is_non_inventory`, and Đá viên
and Khoai lang must be absent from it. If either appears, the join dropped the
filter.

- [ ] **Step 3: Write migration `0053` — the two RPCs**

Points (b) and (c). Re-declare `save_stocktake_line_atomic` with the branch on
`item_type`, and `apply_stocktake_session_atomic` with the split write path.

Prove the branch on the existing types first: open a session on a base
ingredient, save a line, and confirm `theoretical_at_count` reads exactly what
it read before the migration. The two old types must be untouched.

- [ ] **Step 4: Prove the ledger and the balance table did not move**

Before applying a purchased-item count, record:

```sql
select count(*) from public.stock_ledger;
select count(*), sum(quantity) from public.inventory_balances;
```

Apply the count. Re-read both. **All three numbers must be identical.** If a
ledger row appeared or a balance row was minted, the split write path leaked and
the old figure is no longer safe — stop and report.

- [ ] **Step 5: Run one real count end to end**

The feature has never been exercised. Open a session, count a handful of items,
apply it, and read back the `stock_issues` rows.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Chọn một mặt hàng đã mua nhưng CHƯA xuất lần nào — ví dụ một loại bột chỉ
  có đúng một đơn nhập. Đếm đúng bằng số đã mua -> phải sinh 0 dòng xuất.
  Đếm thiếu đi 1 đơn vị -> phải sinh đúng 1 dòng, số lượng 1.
  Nếu đếm đủ mà vẫn sinh dòng xuất -> DỪNG, phép trừ sai.

  ĐẾM THỪA: đếm nhiều hơn tổng đã mua 1 đơn vị -> dòng đó phải bị TỪ CHỐI,
  kèm danh sách các mặt hàng cùng nguyên liệu gốc và số đã mua của từng cái.
  Các dòng khác trong phiên vẫn lưu được.
  Nếu dòng đó lưu êm -> DỪNG, đây đúng là kiểu số 0 im lặng.
```

- [ ] **Step 6: Suite, type check, commit**

---

### Task 4: Show both figures side by side

**Files:**
- Modify: `app/admin/reports/actions.ts`
- Modify: `app/admin/reports/pnl/page.tsx`

**Interfaces:**
- Consumes: `computeIssueCosting` (Task 1), `stock_issues` (Task 2, 3).
- Produces: an additional field on the P&L payload. **No existing field
  changes.**

`app/admin/reports/actions.ts:181` is the one place total COGS is summed
(`typedLines.reduce((s, l) => s + l.cost_at_sale, 0)`). Leave that line exactly
as it is. Add a second figure beside it.

**One block downstream does re-derive from it** — `actions.ts:318-324` forces
the rounding remainder onto the first row of `cogsDetails` so the detail table
sums to `totalCOGS` exactly:

```ts
const cogsDetailDelta = totalCOGS - cogsDetails.reduce((sum, row) => sum + row.cogs, 0);
```

The new figure must stay entirely outside this: it does not enter `cogsDetails`,
is not included in that sum, and does not alter `cogsDetailDelta`. It is a
separate field on the payload with no arithmetic relationship to the old one.
`pnl/page.tsx:156` computes a percentage from `data.totalCOGS` client-side —
same rule, leave the existing field alone and it is unaffected.

- [ ] **Step 1: Add the second computation**

Load purchases and issues for the period, call `computeIssueCosting`, sum
`issued_value`. Add it to the payload as a new field. **Do not touch
`totalCOGS`.**

- [ ] **Step 2: Show both, labelled so the owner can tell them apart**

Vietnamese labels, plain, no jargon:

```
Giá vốn (cách cũ — theo công thức từng ly)     X đ
Giá vốn (cách mới — theo hàng đã xuất kho)     Y đ
```

Below them, one line stating why they differ, in the owner's terms: the old
figure counts ingredients inferred from drinks sold; the new one counts goods
recorded as leaving the store.

- [ ] **Step 3: Prove the old figure did not move**

Read the P&L for a closed month before and after. **The old figure must be
identical to the dong.** If it moved, the parallel display is not parallel —
stop and report.

- [ ] **Step 4: Suite, type check, commit**

---

## Verification bar

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — green, 962+ tests.
- The old COGS figure identical to the dong for every month checked, before and
  after every task.
- Revenue untouched throughout.
- One real stocktake session completed end to end, with its `stock_issues` rows
  read back and checked against the worked example.
- `stocktake_lines` accepts `PURCHASED_ITEM` and still refuses an invalid value —
  proven at the table constraint **and** at `open_stocktake_session_atomic`.
- `stock_ledger` row count and `inventory_balances` row count and quantity sum
  identical before and after a purchased-item count.
- `theoretical_at_count` for the two existing item types reads the same value
  after migration `0053` as before it.
- Nothing deleted.
- No push.

## Out of scope

- The quick-issue button at the counter — deferred by the owner 2026-08-04,
  designed for but not built. Its own plan.
- Retiring the old path, deleting derived rows, rewriting `CLAUDE.md` section 7
  — Plan C.
- Historical restatement — needs the owner's past issue records first, and
  those need this path to exist.
