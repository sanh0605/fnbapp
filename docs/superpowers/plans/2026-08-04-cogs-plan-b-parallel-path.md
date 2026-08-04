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

## Before you start: challenge this plan

Standing rule since 2026-07-31. Read the whole plan, report what is wrong,
missing, or unverifiable, then wait — before writing code.

Attack these three first:

1. **Task 1's opening-balance question.** Valuing an issue needs a running
   average, which needs an opening quantity and value per purchased item. This
   plan derives both from `purchase_order_lines` alone. Check whether that is
   actually sufficient — in particular whether any item was ever consumed
   without a purchase line, and what the first count should do about an item
   whose purchases total less than what is physically on the shelf.
2. **Task 3's parallel-display claim.** The plan asserts the new figure can be
   shown without altering the old one. `app/admin/reports/actions.ts:181` is the
   single place total COGS is summed. Verify nothing downstream recomputes or
   re-derives from it in a way that a second figure would perturb.
3. **The `item_type` constraint.** `stocktake_lines` restricts `item_type` to
   `BASE_INGREDIENT` or `SEMI_PRODUCT`. Task 2 widens it. Confirm no code
   branches on that column in a way that silently mishandles a third value.

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
| `supabase/migrations/0052_stock_issues.sql` (create) | `stock_issues` table; widen `stocktake_lines.item_type` | 2 |
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

Prove both directions. A widened constraint that accepts anything is not a
constraint.

- [ ] **Step 4: Apply and confirm**

Run: `npx supabase db push`, then confirm `stock_issues` exists and
`stocktake_lines` accepts `PURCHASED_ITEM`.

- [ ] **Step 5: Commit**

---

### Task 3: Count purchased items, produce issues

**Files:**
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

- [ ] **Step 2: Extend the count to purchased items**

- [ ] **Step 3: Emit `stock_issues` rows on apply**

Inside the same transaction as the existing `STOCK_ADJUST` write. Do not add a
second write path that can half-succeed.

- [ ] **Step 4: Run one real count end to end**

The feature has never been exercised. Open a session, count a handful of items,
apply it, and read back the `stock_issues` rows.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Chọn một mặt hàng đã mua nhưng CHƯA xuất lần nào — ví dụ một loại bột chỉ
  có đúng một đơn nhập. Đếm đúng bằng số đã mua -> phải sinh 0 dòng xuất.
  Đếm thiếu đi 1 đơn vị -> phải sinh đúng 1 dòng, số lượng 1.
  Nếu đếm đủ mà vẫn sinh dòng xuất -> DỪNG, phép trừ sai.
```

- [ ] **Step 5: Suite, type check, commit**

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
- `stocktake_lines` accepts `PURCHASED_ITEM` and still refuses an invalid value.
- Nothing deleted.
- No push.

## Out of scope

- The quick-issue button at the counter — deferred by the owner 2026-08-04,
  designed for but not built. Its own plan.
- Retiring the old path, deleting derived rows, rewriting `CLAUDE.md` section 7
  — Plan C.
- Historical restatement — needs the owner's past issue records first, and
  those need this path to exist.
