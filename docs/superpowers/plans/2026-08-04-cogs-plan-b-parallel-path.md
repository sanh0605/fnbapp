# Issue-Based COGS — Plan B: The Parallel Path

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it possible to record what left stock and to cost it, changing
nothing the reports currently show.

**Architecture:** Stock and issues move to the purchased-item level, where the
owner actually buys and hands out goods. A period count is one **source** of
issue events rather than the answer itself, so the quick-issue button deferred
to a later plan slots in without touching valuation. Nothing reaches the screen
in this plan — the report is switched over, once, in Plan C.

**Scope change 2026-08-04.** This plan originally ended by showing the new
figure beside the old one in the P&L. The owner declined a parallel display
(`BR-COGS-005`): the report carries one cost figure, never two. That task is
deleted rather than moved — Plan C replaces the figure outright. The new number
is checked once, from a script, before it is trusted with anything.

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
| `lib/issue-costing.ts` (modify) | Two more refusals: unusable timestamp, money with no quantity | 1b |
| `lib/purchase-order-write-plan.ts` (modify) | Stop writing a purchase line that records money with no quantity | 1c |
| `supabase/migrations/0052_stock_issues.sql` (create) | `stock_issues` table; widen `stocktake_lines.item_type`; widen the allow-list inside `open_stocktake_session_atomic` | 2 |
| `supabase/migrations/0053_stocktake_purchased_items.sql` (create) | Rewrite `save_stocktake_line_atomic` and `apply_stocktake_session_atomic` to branch on `item_type` | 3 |
| `app/admin/inventory/stocktake/**` (modify) | Count purchased items; emit issue events | 3 |
| `scripts/compare-cogs-methods.ts` (create) | One-off: print old vs new cost per month, for the owner to read once | 4 |

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

**Which timestamp fills `Purchase.at`, pinned here because sorting is the whole
mechanism.** It is `purchase_orders.transaction_date`, falling back to
`purchase_orders.created_at` when that is null. Never
`purchase_order_lines.created_at`, and never `purchase_orders.created_at` on its
own.

Measured 2026-08-04: of 62 completed purchase orders, **57 have a
`transaction_date` more than 12 hours from their `created_at`**, the widest gap
being 66,8 days (`PO-008`). Goods bought in one month are routinely entered in
another. `transaction_date` is currently never null — the fallback is
precaution, not load-bearing — but the column is nullable, so keep it.

Sorting by the wrong column reorders purchases for **1 of the 30 items that have
two or more purchases**, which is exactly the shape that survives review: one
item's average is wrong, the total still looks plausible. Worse, a purchase
entered 66 days late can sort after an issue that actually consumed it, and the
engine then throws "issue precedes any purchase" for a perfectly normal item.

This function is pure and takes `at` as given, so no test inside Task 1 can
catch a caller that fills it wrongly. The obligation therefore sits on every
caller, and Task 4 checks it against real data.

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/issue-costing.test.ts`
Expected: FAIL — module missing.

- [x] **Step 3: Write the engine**

Sort purchases and issues together by timestamp, per item. Maintain `quantity`
and `value`; on issue, take `value / quantity × issued` and subtract both.
Throw — never return zero — when an issue precedes any purchase or exceeds the
quantity on hand: a silent zero is indistinguishable from correct costing, and
that failure shape has cost this project six separate defects.

- [x] **Step 4: Tests and suite**

Run: `npx vitest run lib/issue-costing.test.ts && npx vitest run && npx tsc --noEmit`
Expected: 5 new tests pass, 962 total, 0 type errors.

- [x] **Step 5: Commit**

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

### Task 1b: Two more refusals in the engine

**Files:**
- Modify: `lib/issue-costing.ts`
- Modify: `lib/issue-costing.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: the same signature. Two more inputs throw instead of returning a
  number.

Task 1 shipped correct and is committed (`356f0fb`). Review of the committed
code found two inputs it accepts and silently misprices. Both are the shape this
engine already refuses twice; these are the third and fourth of the same kind.

**(a) An unusable timestamp sorts unpredictably.** The replay is
`events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())`.
An empty or malformed `at` yields `NaN`, the comparator returns `NaN`, and the
resulting order is undefined — the function still returns a number, computed
from events in arbitrary order. Task 1 pinned `at` to
`purchase_orders.transaction_date`, a **nullable** column, so this is a live
path, not a hypothetical. Throw naming the item and the offending value.

**(b) A purchase can carry money with no quantity.**
`lib/purchase-order-write-plan.ts:92-94` still computes
`quantity * (Number(draftConversion?.conversion_rate) || 0)` — a failed
conversion multiplies by zero rather than refusing. `docs/OPEN-ITEMS.md` item 29
records this and predicted exactly this moment: *"issue-based costing makes
purchases the sole source of cost, so a silent zero there stops being
cosmetic."*

Such a line adds its `subtotal` to running value while adding nothing to running
quantity, inflating the average for every later issue of that item:

```
Nhập 10 kg, 100.000đ, quy đổi hỏng -> base_quantity 0,  subtotal 100.000
Nhập 10 kg, 120.000đ, quy đổi tốt  -> base_quantity 10, subtotal 120.000
  máy cộng dồn: 10 kg / 220.000đ -> bình quân 22.000đ/kg
  đúng ra là:   10 kg / 120.000đ -> bình quân 12.000đ/kg
```

Refuse a purchase whose `base_quantity <= 0` while `subtotal > 0`. A line with
both at zero is inert and may pass.

- [x] **Step 1: Write the two failing tests**

Assert the message names the purchased item, so the person reading the failure
knows which one to go and look at.

Actually three tests: added a third asserting quantity-and-subtotal-both-zero
passes through unrefused, so the new guard's boundary is proven, not assumed.

- [x] **Step 2: Run them and watch them fail**

Expected: both return a number today rather than throwing. If either already
throws, the defect is elsewhere — stop and re-read before changing anything.

- [x] **Step 3: Add the two guards**

- [x] **Step 4: Suite, type check, commit**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 964 tests, 0 type errors.

Actual: 965 (one extra boundary test, see Step 1). 0 type errors. Commit `48001bc`.

---

### Task 1c: Stop creating the bad line in the first place

**Files:**
- Modify: `lib/purchase-order-write-plan.ts`
- Modify: its existing test file

**Interfaces:**
- Consumes: nothing.
- Produces: a purchase write that refuses rather than storing money against no
  quantity.

Task 1b stops the engine mispricing such a line. This stops the line existing.
Both are wanted: the guard protects the 137 rows already on record, this
protects every future one.

`docs/OPEN-ITEMS.md` item 29 deliberately left this open because refusing a save
is a behaviour change and Plan A was not allowed to make one. This plan is.

Replace the `|| 0` fallback with a refusal that names the item and the
unresolved conversion. Do not invent a default rate.

- [x] **Step 1: Write the failing test — an unresolvable conversion refuses the write**

Two tests: unresolvable `conversion_id` (typo/dangling reference), and no
`conversion_id` at all while `subtotal > 0`.

- [x] **Step 2: Run it and watch it fail**

- [x] **Step 3: Remove the fallback, refuse instead**

- [x] **Step 4: Confirm the existing purchase tests still pass unchanged**

If a test breaks because it relied on the zero fallback, that test was
documenting the defect. Rewrite it to assert the refusal and say so in the
commit — do not delete it silently.

All 4 pre-existing tests passed unchanged, including "allows an incomplete
draft line without creating stock" (quantity set, subtotal 0) — the guard is
scoped to `subtotal > 0`, so a genuinely blank in-progress line still saves.

- [x] **Step 5: Verify no completed purchase order is now unsaveable**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-02:
  Cả 137 dòng nhập hàng hiện có ĐỀU đã có conversion_id trỏ tới một dòng quy đổi
  có thật. Không dòng nào thiếu. Nên thay đổi này KHÔNG được làm hỏng dòng nào
  đang có.
  Nếu chạy thử mà thấy dòng cũ bị từ chối -> điều kiện từ chối viết quá rộng.
  DỪNG.
```

By construction, not just by testing: the new guard only runs in the
`!receipt` branch, and `receipt` is always truthy when the order is
COMPLETED. A completed order cannot reach this guard at all. Measured
separately: 0 draft orders currently exist in production, so no live order is
affected either way. Commit `fd811c9`.

- [x] **Step 6: Close item 29 in `docs/OPEN-ITEMS.md`, suite, type check, commit**

---

### Task 1d: Guard the path that actually writes purchases

**Files:**
- Modify: `lib/purchase-ledger-rebuild.ts`
- Modify: its existing test file

**Interfaces:**
- Consumes: `computeBaseQuantity` from `lib/purchase-line-base-quantity.ts`.
- Produces: `buildPurchaseReceipt` refusing what it currently converts to zero.

Task 1c is correct and its guard is correctly placed — but it is on the
`!receipt` branch, which is the **draft** branch, and there are **0 draft
purchase orders**. It protects a path with no rows.

Every real purchase takes the completed branch, and that branch computes
(`lib/purchase-ledger-rebuild.ts:63-65`):

```ts
const conversionRate = conversion ? Number(conversion.conversion_rate) || 0 : 1;
const quantity = Number(input.line.quantity) || 0;
const quantityChange = quantity * conversionRate;
```

The same `|| 0`, one file over, unguarded.

**How live is it?** `resolveConversion` throws when a conversion cannot be
found, so a missing conversion is already safe. What remains is a stored rate of
zero, or a line quantity of zero against a real subtotal.
`uom_conversions.conversion_rate` is `numeric(18,6) not null` with **no
positivity check** (`0001_init_schema.sql:187`), so a zero rate is storable.
Measured 2026-08-04: **0 of 57 conversion rows are unusable.** Latent, not
firing. Worth closing anyway, because purchases are now the only source of cost.

**There is already a hardened version of this arithmetic.**
`lib/purchase-line-base-quantity.ts` was written for Plan A and refuses both
cases with named errors. It is called by one backfill script and not by the
write path. Two implementations of one rule, one of them safe — use the safe one
rather than writing a third.

Keep the non-raw case as it is: an item with no `base_ingredient_id` has no
conversion and legitimately uses rate 1.

- [x] **Step 1: Write the failing tests**

A completed line whose conversion rate is 0, and a completed line with quantity
0 and a subtotal above 0. Both must throw and name the purchased item.

- [x] **Step 2: Run them and watch them fail**

Expected: both return 0 today. If either already throws, stop — the defect is
somewhere other than where this task says it is.

- [x] **Step 3: Route the raw-item branch through `computeBaseQuantity`**

`buildPurchaseReceipt` catches `computeBaseQuantity`'s error and rewraps it
with the purchased item id prefixed, so the failure names the item as required
even though the pure function itself only knows the line and the conversion.

- [x] **Step 4: Prove no existing purchase order breaks**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  57 dòng quy đổi, 0 dòng có tỷ lệ <= 0. 62 đơn nhập đã hoàn tất.
  Chạy lại toàn bộ 137 dòng nhập qua hàm mới -> phải KHÔNG có dòng nào bị từ
  chối, và base_quantity từng dòng phải ra ĐÚNG bằng giá trị đang lưu.
  Có dòng bị từ chối -> điều kiện quá rộng. DỪNG.
```

Actual: 137/137 checked, 0 rejected, 0 mismatched. Commit `e930cc8`.

- [x] **Step 5: Close item 30 in `docs/OPEN-ITEMS.md`, suite, type check, commit**

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

- [x] **Step 1: List the target tables' triggers before writing**

```sql
select tgname, pg_get_triggerdef(oid)
  from pg_trigger
 where tgrelid in ('public.stocktake_lines'::regclass, 'public.stock_ledger'::regclass)
   and not tgisinternal;
```

State, for each, what it does with the rows this migration touches. The
`start_date` incident happened because this step did not exist.

Ran live via `supabase db query --linked` (direct pg connection from this
shell hit a DNS dead end — Node's resolver couldn't reach the direct host;
the CLI's management-API path worked). `stock_ledger`: `detect_backdated_ledger_entry`
(AFTER INSERT) and `trg_stock_ledger_inventory_balances` (AFTER INSERT OR
DELETE OR UPDATE OF item_reference, quantity_change — not every UPDATE, only
those two columns). `stocktake_lines`: none. This migration inserts nothing
into `stock_ledger`, so neither fires.

- [x] **Step 2: Write the migration**

Widening a `check` constraint requires dropping and re-adding it. Name the new
constraint the same as the old one so a future reader finds one constraint, not
two generations of it.

Exact constraint name confirmed live before writing the drop:
`stocktake_lines_item_type_check`.

- [x] **Step 3: Verify the constraint accepts three values and still refuses a fourth**

Prove both directions, at **both** gates — the table constraint and the
function's allow-list. A widened constraint that accepts anything is not a
constraint, and a widened constraint sitting behind an un-widened function
accepts nothing at all.

All four proven live, each inside a transaction rolled back afterward: table
refuses `TOTALLY_INVALID` (23514) and accepts `PURCHASED_ITEM`; function
refuses `BOGUS_TYPE` (P0001, its own `RAISE`, not the table's error) and
accepts `PURCHASED_ITEM` through a real `open_stocktake_session_atomic` call.
Confirmed 0 rows left in `stocktake_sessions`/`stocktake_lines`/`stock_issues`
afterward.

- [x] **Step 4: Apply and confirm**

Run: `npx supabase db push`, then confirm `stock_issues` exists,
`stocktake_lines` accepts `PURCHASED_ITEM`, and
`open_stocktake_session_atomic` opens a session containing a `PURCHASED_ITEM`
line without raising.

- [x] **Step 5: Commit**

Commit `8261c0b`.

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

Branch on `item_type`. For `PURCHASED_ITEM`, theoretical stock is:

```
sum(base_quantity of that item's purchase lines whose ORDER is COMPLETED)
  − sum(base_quantity of that item's stock_issues rows)
```

**There is no such thing as a completed purchase line.** `purchase_order_lines`
has no status column at all (`0001_init_schema.sql:331-343`); `status` lives on
`purchase_orders` and is checked against `('DRAFT','COMPLETED','CANCELLED')`.
The filter is therefore only reachable by joining to the header — the same rule
`lib/purchase-ledger-audit.ts:119`, `lib/purchase-order-write-plan.ts` and
`scripts/reprocess-all-po-ledger.ts` already apply. Join
`purchase_order_lines pol` to `purchase_orders po` and filter
`po.status = 'COMPLETED'`.

**No time filter. Deliberately.** The two existing item types compute theoretical
stock by summing *every* `stock_ledger` row for the item with no time bound —
"as of the moment of counting" is already what an unbounded sum of everything
recorded means, since `theoretical_at_count` is frozen at count time. The
purchased-item branch does the same: sum everything, bound nothing.

Adding a time bound here would buy nothing and would open the
`transaction_date` / `created_at` trap described in Task 1 — 57 of 62 completed
orders diverge by more than 12 hours. If a future change ever does need a bound,
it must use `purchase_orders.transaction_date`, never either `created_at`.

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
in Task 1 changes** — which is the whole reason for building it this way today.

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

### Task 4: Put the new number in front of the owner, once

**Files:**
- Create: `scripts/compare-cogs-methods.ts`

**Interfaces:**
- Consumes: `computeIssueCosting` (Task 1), `stock_issues` (Task 2, 3).
- Produces: printed output only. **Reads nothing into the application, writes
  nothing anywhere.**

The owner declined a permanent side-by-side display, and he is right that it is
clutter. But the new figure still has to be looked at by a person before the old
one is destroyed, and this is the last moment that comparison is possible —
after Plan C the old figure no longer exists to compare against.

So the comparison is a script he reads once, not a screen he lives with.

Read-only. It touches `app/admin/reports/actions.ts` not at all; the P&L keeps
showing exactly what it shows today until Plan C.

- [ ] **Step 1: Write the script**

For each month: revenue, cost the old way (sum of `cost_at_sale`), cost the new
way (`computeIssueCosting` over that period's purchases and issues), and both
cost-to-revenue ratios. Vietnamese headings, real item names anywhere an item is
named.

This is the first caller of `computeIssueCosting` against real data, so it is
where the `at` obligation from Task 1 is checked. Load purchases by joining
`purchase_order_lines` to `purchase_orders`, filtering `status = 'COMPLETED'`,
and taking `at` from `transaction_date` with `created_at` as fallback.

- [ ] **Step 1b: Prove the sort column is the right one**

Sort the same purchases both ways and compare the resulting `issued_value` per
item.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  62 đơn nhập đã hoàn tất, 57 đơn có ngày giao dịch lệch ngày ghi sổ quá 12 giờ,
  lệch xa nhất 66,8 ngày (PO-008).
  Sắp theo hai cột khác nhau phải cho ra kết quả KHÁC NHAU ở ĐÚNG 1 mặt hàng
  (trong số 30 mặt hàng có từ 2 lần nhập trở lên).
  Nếu ra giống hệt nhau -> script đang lấy cùng một cột cho cả hai lần sắp,
  phép kiểm không chứng minh được gì. DỪNG và sửa phép kiểm trước.
```

- [ ] **Step 2: Run it and read the output with the owner**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  Cách cũ, tháng 6: 16.688.133đ trên doanh thu 32.416.000đ = 51,5%
  Cách cũ, tháng 7:  7.711.264đ trên doanh thu 19.124.000đ = 40,3%
  Cách cũ, tháng 8:    605.743đ trên doanh thu  1.763.000đ = 34,4%
  Cột "cách cũ" của script PHẢI khớp đúng ba con số này tới từng đồng.
  Lệch -> script đọc sai dữ liệu, DỪNG. Đừng đi tiếp sang cột mới.
```

The new column will be far smaller, because it only covers the period the count
covers. That is expected, not a defect — say so out loud rather than letting it
look like a bug.

- [ ] **Step 3: Type check, commit**

This is the gate into Plan C. Plan C does not start until the owner has read
this output.

---

## Verification bar

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — green, 962+ tests.
- The old COGS figure identical to the dong for every month checked, before and
  after every task — 16.688.133đ / 7.711.264đ / 605.743đ for June, July, August
  2026, measured 2026-08-04.
- Revenue untouched throughout: 32.416.000đ / 19.124.000đ / 1.763.000đ.
- The P&L screen renders identically to today. This plan changes no report.
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
- Switching the report to the new figure, retiring the old path, deleting
  derived rows and stored `cost_at_sale`, rewriting `CLAUDE.md` section 7 —
  Plan C (`docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md`).
- Historical restatement — needs the owner's past issue records first, and
  those need this path to exist.
