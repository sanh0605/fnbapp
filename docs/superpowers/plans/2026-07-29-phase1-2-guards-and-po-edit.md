# Phases 1-2 Implementation Plan: Guards, Instruments, and Admin PO Edit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two defects that let PO-037 corrupt silently, give the owner an admin-only way to repair a completed purchase order himself, and run one cheap diagnostic before the rebuild.

**Architecture:** Pure logic in `lib/`, thin wrappers in `scripts/`, minimal UI change in the existing purchase-order pages. Nothing here rebuilds data — that is Phase 4.

**Tech Stack:** TypeScript, Vitest, Next.js App Router server actions, Supabase.

**Spec:** `docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`, Phases 1 and 2.

**Implementer:** Claude Sonnet 5.

## Global Constraints

- **No data rebuild, no corrections, no deletions.** Task 5 is read-only.
- **Owner-facing strings in Vietnamese; code and comments in English.**
- Owner-facing reports use real names, never ids (`CLAUDE.md` §7).
- No new dependencies. Lodash is **not** installed — do not add it.
- Script runner is `npx vite-node`.
- Verification bar: `npx tsc --noEmit` clean, full suite green (822 tests as of
  2026-07-29), `next build` passes.

## Background the implementer needs

**Defect A — the negative-balance indicator cannot report the negatives that
matter.** In `scripts/audit-full-history-recompute.ts`, `qtyFindings` is built
only from items whose theoretical balance *differs* from the recorded one
(`Math.abs(delta) > 0.01`, line ~144). Line 156 then filters negatives out of
that list. An item whose theoretical and recorded balances agree — the normal
case — can therefore never be reported as negative, no matter how negative it
is. Sữa đặc sits at -6,651 g on both sides and is invisible to this indicator.
That is why every audit reported clean while the owner's screen showed a
negative.

**Defect B — the server trusts a client-supplied total.**
`app/admin/inventory/purchase-orders/actions.ts:53` reads `subtotal_amount`
straight from the form and never compares it against the lines saved in the
same request. PO-037 carries a 3,571,000 header against a single 102,000 line.
The line loss itself was fixed on 2026-07-02 when writes became atomic; this
validation is the guard that would have caught the corruption at creation.

**Current edit gating.** `app/admin/inventory/purchase-orders/[id]/page.tsx:25`
computes `isDraft = po.status === "DRAFT"` and renders `PurchaseOrderForm` only
when true. The page performs **no session or role check at all** — unlike, say,
`app/admin/reports/stock/page.tsx`. The real protection is at the action layer
(`requireAdmin()` at `actions.ts:20,39,118`), so nothing is currently exposed,
but the page must gate properly once an edit affordance exists.

The server already supports editing a completed PO: `savePurchaseOrder` passes
`replaceExisting: Boolean(id)`, and the `save_purchase_order_atomic` RPC
(migration 0006) locks the row, updates the header, deletes the PO's lines and
its `PO_RECEIPT` ledger rows, and reinserts everything in one transaction. **No
RPC or migration work is needed for the edit feature** — only UI gating plus the
guards in this plan.

## File Structure

| File | Responsibility |
|---|---|
| `lib/item-balance-summary.ts` (create) | Pure: split per-item balances into mismatches and negatives, independently. |
| `lib/item-balance-summary.test.ts` (create) | Tests, including the balanced-but-negative case that Defect A missed. |
| `scripts/audit-full-history-recompute.ts` (modify) | Use the new module instead of the inline filter. |
| `app/admin/inventory/purchase-orders/actions.ts` (modify) | Reject a COMPLETED save whose header total disagrees with its lines; write an edit-trail row. |
| `app/admin/inventory/purchase-orders/[id]/page.tsx` (modify) | Role check; allow editing a COMPLETED PO behind an explicit `?edit=1`. |
| `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx` (modify) | "Sửa phiếu" affordance for COMPLETED, admin only. |
| `supabase/migrations/0041_purchase_order_edits.sql` (create) | Edit trail table. |
| `lib/duplicate-item-audit.ts` + test + `scripts/audit-duplicate-items.ts` (create) | Read-only diagnostic for the duplicate purchased-item hypothesis. |

---

### Task 1: Report negative balances independently of mismatches

**Files:**
- Create: `lib/item-balance-summary.ts`
- Test: `lib/item-balance-summary.test.ts`
- Modify: `scripts/audit-full-history-recompute.ts:138-162`

**Interfaces:**
- Produces: `summariseItemBalances(input): ItemBalanceSummary` and the type
  `ItemBalanceRow`, consumed by the audit script.

- [ ] **Step 1: Write the failing test**

Create `lib/item-balance-summary.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { summariseItemBalances } from "./item-balance-summary";

const nameOf = (id: string) => ({ "ING-003": "Sữa đặc" }[id] || id);

describe("summariseItemBalances", () => {
  it("reports a negative item even when theoretical and recorded agree", () => {
    // The Sua dac case: -6651 on both sides, so it is NOT a mismatch,
    // but it IS negative. The old inline filter could never see this.
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-003", -6651]]),
      recordedByItem: new Map([["ING-003", -6651]]),
      nameOf,
    });
    expect(result.mismatches).toHaveLength(0);
    expect(result.negatives).toHaveLength(1);
    expect(result.negatives[0].item_name).toBe("Sữa đặc");
    expect(result.negatives[0].theoretical).toBe(-6651);
  });

  it("reports a mismatch that is not negative", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-002", 2000]]),
      recordedByItem: new Map([["ING-002", 1800]]),
      nameOf,
    });
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].delta).toBe(200);
    expect(result.negatives).toHaveLength(0);
  });

  it("reports an item that is both negative and mismatched, in both lists", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-009", -500]]),
      recordedByItem: new Map([["ING-009", -300]]),
      nameOf,
    });
    expect(result.mismatches).toHaveLength(1);
    expect(result.negatives).toHaveLength(1);
  });

  it("ignores differences and negatives within tolerance", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-004", -0.005]]),
      recordedByItem: new Map([["ING-004", 0]]),
      nameOf,
    });
    expect(result.mismatches).toHaveLength(0);
    expect(result.negatives).toHaveLength(0);
  });

  it("covers items present in only one of the two maps", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-005", -100]]),
      recordedByItem: new Map([["ING-006", 50]]),
      nameOf,
    });
    expect(result.negatives.map(r => r.item)).toEqual(["ING-005"]);
    expect(result.mismatches).toHaveLength(2);
  });

  it("sorts negatives most negative first", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["A", -10], ["B", -900], ["C", -50]]),
      recordedByItem: new Map([["A", -10], ["B", -900], ["C", -50]]),
      nameOf,
    });
    expect(result.negatives.map(r => r.item)).toEqual(["B", "C", "A"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/item-balance-summary.test.ts`
Expected: FAIL — cannot resolve `./item-balance-summary`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/item-balance-summary.ts`:

```typescript
/**
 * Splits per-item stock balances into two independent views.
 *
 * These were previously conflated in scripts/audit-full-history-recompute.ts,
 * where negatives were filtered out of the mismatch list. An item whose
 * theoretical and recorded balances agree is not a mismatch, so a negative
 * balance the system agrees with itself about could never be reported -- which
 * is exactly the case the owner was seeing on screen while audits read clean.
 */

export interface ItemBalanceRow {
  item: string;
  item_name: string;
  theoretical: number;
  recorded: number;
  delta: number;
}

export interface ItemBalanceSummary {
  mismatches: ItemBalanceRow[];
  negatives: ItemBalanceRow[];
}

export function summariseItemBalances(input: {
  theoreticalByItem: Map<string, number>;
  recordedByItem: Map<string, number>;
  nameOf: (id: string) => string;
  tolerance?: number;
}): ItemBalanceSummary {
  const tolerance = input.tolerance ?? 0.01;
  const allItemIds = new Set([
    ...input.theoreticalByItem.keys(),
    ...input.recordedByItem.keys(),
  ]);

  const mismatches: ItemBalanceRow[] = [];
  const negatives: ItemBalanceRow[] = [];

  for (const item of allItemIds) {
    const theoretical = input.theoreticalByItem.get(item) || 0;
    const recorded = input.recordedByItem.get(item) || 0;
    const row: ItemBalanceRow = {
      item,
      item_name: input.nameOf(item),
      theoretical,
      recorded,
      delta: theoretical - recorded,
    };

    if (Math.abs(row.delta) > tolerance) mismatches.push(row);
    // Evaluated over every item, never filtered through the mismatch list.
    if (theoretical < -tolerance) negatives.push(row);
  }

  mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  negatives.sort((a, b) => a.theoretical - b.theoretical);

  return { mismatches, negatives };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/item-balance-summary.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Rewire the audit script**

In `scripts/audit-full-history-recompute.ts`, replace the inline block that
builds `qtyFindings` and `negativeTheoretical` (roughly lines 138-162) with a
call to the new module. Keep the existing console output shape, but source
`negativeTheoretical` from `summary.negatives` and `qtyFindings` from
`summary.mismatches`. Keep both keys in the JSON summary object unchanged
(`quantity_items_with_diff`, `quantity_items_negative_theoretical`) so existing
artifacts stay comparable.

Update the console line for negatives so it always prints, including when the
count is zero, and lists every negative item by real name with its balance.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — expected: no output.
Run: `npm test` — expected: green, +6 from the 822 baseline.

- [ ] **Step 7: Commit**

```bash
git add lib/item-balance-summary.ts lib/item-balance-summary.test.ts scripts/audit-full-history-recompute.ts
git commit -m "Claude-Sonnet fix: report negative stock balances independently of mismatches"
```

- [ ] **Step 8: Re-run the audit live and report**

Run: `npx vite-node scripts/audit-full-history-recompute.ts`

Report to the owner, in Vietnamese with real names, how many items are actually
negative and by how much. This is the first time that number has ever been
correct — expect it to be greater than zero, and say so plainly.

---

### Task 2: Reject a completed purchase order whose header disagrees with its lines

**Files:**
- Modify: `app/admin/inventory/purchase-orders/actions.ts`
- Test: `app/admin/inventory/purchase-orders/actions.subtotal.test.ts` (create)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the validation behaviour Task 3's edit flow relies on.

Apply the check **only when `status === "COMPLETED"`**. Drafts do not touch
stock or money, and a draft may legitimately be saved mid-entry.

- [ ] **Step 1: Write the failing test**

Follow the mocking style already used in
`app/admin/inventory/actions.auth.test.ts`. The test must assert that a
COMPLETED save whose `subtotal_amount` disagrees with the sum of its line
subtotals returns a failure and that `savePurchaseOrderAtomic` was never called:

```typescript
it("rejects a COMPLETED purchase order whose header total does not match its lines", async () => {
  const formData = buildFormData({
    status: "COMPLETED",
    subtotal_amount: "3571000",
    lines_json: JSON.stringify([
      { purchased_item_id: "PI-1", unit: "Túi", conversion_id: "CV-1", quantity: 2, subtotal: 102000 },
    ]),
  });

  const res = await savePurchaseOrder(formData);

  expect(res.ok).toBe(false);
  expect(res.error).toContain("không khớp");
  expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
});

it("accepts a COMPLETED purchase order whose header total matches its lines", async () => {
  const formData = buildFormData({
    status: "COMPLETED",
    subtotal_amount: "102000",
    lines_json: JSON.stringify([
      { purchased_item_id: "PI-1", unit: "Túi", conversion_id: "CV-1", quantity: 2, subtotal: 102000 },
    ]),
  });

  const res = await savePurchaseOrder(formData);

  expect(res.ok).toBe(true);
});

it("does not apply the check to DRAFT saves", async () => {
  const formData = buildFormData({
    status: "DRAFT",
    subtotal_amount: "3571000",
    lines_json: JSON.stringify([{ purchased_item_id: "PI-1", quantity: 1, subtotal: 0 }]),
  });

  const res = await savePurchaseOrder(formData);

  expect(res.ok).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/admin/inventory/purchase-orders/actions.subtotal.test.ts`
Expected: FAIL — the mismatched COMPLETED save currently succeeds.

- [ ] **Step 3: Write minimal implementation**

In `savePurchaseOrder`, immediately after `const lines = JSON.parse(linesJson);`
and before `buildPurchaseOrderWritePlan`:

```typescript
// PO-037 guard: the client computes subtotal_amount by summing the same line
// rows it submits, so any disagreement means the payload is inconsistent and
// must not be persisted. A header total with no lines behind it is exactly how
// PO-037 came to show 3,571,000 against a single 102,000 line.
if (status === "COMPLETED") {
  const lineSubtotalSum = lines.reduce(
    (sum: number, line: { subtotal?: string | number }) => sum + (Number(line.subtotal) || 0),
    0,
  );
  if (Math.abs(lineSubtotalSum - subtotal_amount) >= 1) {
    return fail(
      `Tổng tiền hàng (${subtotal_amount}) không khớp tổng các dòng hàng (${lineSubtotalSum}). Vui lòng kiểm tra lại danh sách mặt hàng.`,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/admin/inventory/purchase-orders/actions.subtotal.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/admin/inventory/purchase-orders/actions.ts app/admin/inventory/purchase-orders/actions.subtotal.test.ts
git commit -m "Claude-Sonnet fix: reject completed PO whose header total disagrees with its lines"
```

---

### Task 3: Edit trail for purchase orders

**Files:**
- Create: `supabase/migrations/0041_purchase_order_edits.sql`
- Modify: `app/admin/inventory/purchase-orders/actions.ts`

Purchase orders have no edit history; sales orders have `order_events`. Once a
completed PO becomes editable, "who changed this and when" is a money question.

- [ ] **Step 1: Write the migration**

```sql
-- Edit trail for purchase orders. Sales orders already have order_events;
-- purchase orders had none, which becomes a gap once completed POs are
-- editable by an admin (see the clean rebuild program, Phase 2).
create table if not exists public.purchase_order_edits (
  id text primary key,
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  edited_by_id text not null,
  edited_by_name text not null,
  edited_at timestamptz not null default now(),
  previous_status text not null,
  previous_subtotal_amount bigint not null,
  previous_line_count integer not null,
  new_subtotal_amount bigint not null,
  new_line_count integer not null
);
create index if not exists idx_purchase_order_edits_po
  on public.purchase_order_edits(purchase_order_id, edited_at desc);
```

- [ ] **Step 2: Write the failing test**

Assert that editing an existing PO inserts exactly one `purchase_order_edits`
row carrying the previous and new subtotal and line counts, and that creating a
new PO inserts none.

- [ ] **Step 3: Implement**

In `savePurchaseOrder`, when `id` is present, read the existing PO and its line
count **before** calling `savePurchaseOrderAtomic`, and insert the trail row
after a successful save. A failed save must leave no trail row.

- [ ] **Step 4: Verify and commit**

```bash
git add supabase/migrations/0041_purchase_order_edits.sql app/admin/inventory/purchase-orders/
git commit -m "Claude-Sonnet feat: record who edited a purchase order and what changed"
```

---

### Task 4: Admin-only edit of a completed purchase order

**Files:**
- Modify: `app/admin/inventory/purchase-orders/[id]/page.tsx`
- Modify: `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx`

Editing must be deliberate. Viewing a completed PO must never open the form by
itself; the owner opts in through an explicit action.

- [ ] **Step 1: Gate the detail page**

Add a session and role check to `[id]/page.tsx`, matching the pattern in
`app/admin/reports/stock/page.tsx` (redirect to `/login` when there is no
session, then read `role` from the session user). Then:

```typescript
const isAdmin = role === "ADMIN";
const editRequested = searchParams?.edit === "1";
const isDraft = po.status === "DRAFT";
const showForm = isDraft || (isAdmin && editRequested);
```

Render `PurchaseOrderForm` when `showForm`. When a non-admin requests
`?edit=1`, ignore it and render the read-only view.

- [ ] **Step 2: Add the opt-in affordance**

On the completed-PO read-only view, show a "Sửa phiếu" link to
`?edit=1`, visible only when `isAdmin`. Place it beside the existing status
badge. Add a short warning line above the form when editing a COMPLETED PO:

> "Sửa phiếu đã hoàn thành sẽ ghi lại tồn kho và giá vốn của phiếu này. Kiểm tra kỹ trước khi lưu."

- [ ] **Step 3: Update the list screen**

In `PurchaseOrdersClient.tsx`, the COMPLETED rows currently render "Xem chi
tiết". Leave that as the default action — the edit entry point stays on the
detail page, one deliberate step further in.

- [ ] **Step 4: Test**

Cover: admin plus `?edit=1` on a COMPLETED PO renders the form; admin without
`?edit=1` does not; a STAFF role with `?edit=1` does not; a DRAFT still renders
the form for anyone with a session.

- [ ] **Step 5: Verify and commit**

Run `npx tsc --noEmit`, `npm test`, and `next build`.

```bash
git add app/admin/inventory/purchase-orders/
git commit -m "Claude-Sonnet feat: admin-only edit of completed purchase orders"
```

- [ ] **Step 6: Tell the owner it is ready**

Report in Vietnamese: where the button is, that it only appears for his admin
account, and that the header total must equal the sum of the line items or the
save is rejected. **Do not edit PO-037 on his behalf.**

---

### Task 5: Duplicate purchased-item diagnostic (read-only)

**Files:**
- Create: `lib/duplicate-item-audit.ts`, `lib/duplicate-item-audit.test.ts`,
  `scripts/audit-duplicate-items.ts`

Tests the remaining explanation for Sữa đặc: that purchases were recorded
against a different item record than the recipes consume. Run this before
Phase 4, so the owner is not surprised when a rebuild reproduces the same
negative.

- [ ] **Step 1: Define the signature to look for**

For every base ingredient and semi-product, compute total purchased quantity
(from `PO_RECEIPT` rows) and total consumed quantity (from recipe-driven
consumption). Flag:

- **`CONSUMED_NEVER_PURCHASED`** — consumed but with zero purchase history.
- **`PURCHASED_NEVER_CONSUMED`** — purchased but never consumed by any recipe.
- **`NAME_TWIN`** — two different item ids whose names normalise to the same
  string (lowercase, trimmed, accents and punctuation stripped), where one is in
  each of the two lists above. This is the duplicate-record signature.

- [ ] **Step 2: Write tests for all three flags**

One fixture per flag, plus a fixture where similar names both have purchases and
consumption and must therefore **not** be flagged.

- [ ] **Step 3: Implement the pure module, then the CLI wrapper**

Wrapper reads `Stock_Ledger`, `Base_Ingredients`, `Semi_Products`, `Recipes`
read-only, prints results with real names, and writes
`docs/audits/2026-07-29-duplicate-item-diagnostic.json`.

- [ ] **Step 4: Run live and report**

Report in Vietnamese with real names. State plainly whether Sữa đặc has a twin
record. If it does not, say so — that closes the last alternative explanation
and confirms the purchases were simply never entered.

- [ ] **Step 5: Commit**

```bash
git add lib/duplicate-item-audit.ts lib/duplicate-item-audit.test.ts scripts/audit-duplicate-items.ts docs/audits/
git commit -m "Claude-Sonnet audit: duplicate purchased-item diagnostic"
```

---

### Task 6: Update tracking

- [ ] Append a `DEVELOPMENT-TRACKING.md` entry covering all five tasks, the live
  results of Task 1 Step 8 and Task 5 Step 4, and an explicit statement that no
  data was rebuilt or corrected.
- [ ] Add rows to `docs/ROADMAP.md` for the clean rebuild program, marking
  Phases 1-2 done and 3-7 pending.
- [ ] Commit.

---

## What comes next

Phase 3 (backup plus a **verified restore drill**) must complete before Phase 4
touches any data. Phase 4 waits on the owner's own PO-037 edit. Neither is in
this plan.
