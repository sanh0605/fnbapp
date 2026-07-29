# Phase 2b Implementation Plan: Edit-Trail Safety and Audit Scope

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a secondary bookkeeping write from reporting a successful save as failed, apply the pending migration, and stop the stock audit from counting deliberately untracked ingredients as problems.

**Architecture:** Two small, surgical code changes plus one migration apply. No data rebuild.

**Tech Stack:** TypeScript, Vitest, Supabase.

**Spec:** `docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`, Phase 1-2 follow-up.

**Implementer:** Claude Sonnet 5.

## Global Constraints

- No data rebuild, no ledger corrections. Migration 0041 creates an empty table.
- Owner-facing strings in Vietnamese; code and comments in English.
- Owner-facing reports use real names, never ids (`CLAUDE.md` §7).
- No new dependencies. Lodash is not installed.
- Runner is `npx vite-node`.
- Verification bar: `npx tsc --noEmit` clean, full suite green (841 tests as of
  2026-07-29), `next build` passes.

## What happened, and why Task 1 matters most

The owner edited PO-037 on 2026-07-29 through the new admin edit feature. The
screen showed:

```
Lỗi: findAll(purchase_order_edits): Could not find the table
'public.purchase_order_edits' in the schema cache
```

**The save had already succeeded.** In `savePurchaseOrder`,
`savePurchaseOrderAtomic` runs first and commits transactionally; the edit-trail
insert runs afterwards and calls `generateNewId("purchase_order_edits", "POE")`,
which reads a table that migration 0041 had not yet created. The throw was
caught by the outer handler and returned as a failure, so a completed write was
reported as a failed one.

The owner has since confirmed PO-037 is correct, so no data repair is needed.
But this is the dangerous shape: a user told the save failed will re-enter the
data, and only atomic replace-semantics saved this from becoming duplicate or
divergent records.

Applying migration 0041 fixes today's symptom. **Task 1 fixes the class of
defect**: an observability write must never be able to change the reported
outcome of the operation it observes. Do both.

Note also: `localhost` development points at the hosted Supabase project — there
is no local database. Every local save is a production write. Out of scope here,
recorded as a risk in the program spec.

---

### Task 1: The edit trail must never fail the save

**Files:**
- Modify: `app/admin/inventory/purchase-orders/actions.ts` (the `if (id && previousPo)` block)
- Test: `app/admin/inventory/purchase-orders/actions.subtotal.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add to the existing test file:

```typescript
it("still reports success when the edit-trail write fails", async () => {
  mocks.insert.mockRejectedValueOnce(
    new Error("findAll(purchase_order_edits): Could not find the table 'public.purchase_order_edits' in the schema cache"),
  );

  const formData = buildFormData({
    id: "PO-037",
    status: "COMPLETED",
    subtotal_amount: "102000",
    lines_json: JSON.stringify([
      { purchased_item_id: "PI-1", unit: "Túi", conversion_id: "CV-1", quantity: 2, subtotal: 102000 },
    ]),
  });

  const res = await savePurchaseOrder(formData);

  // The atomic save committed; a bookkeeping failure must not mask that.
  expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalled();
  expect(res.ok).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/admin/inventory/purchase-orders/actions.subtotal.test.ts`
Expected: FAIL — `res.ok` is `false`, because the rejected insert propagates to
the outer catch.

- [ ] **Step 3: Write minimal implementation**

Wrap only the trail block:

```typescript
if (id && previousPo) {
  // The atomic save has already committed at this point. The edit trail is
  // observability, not correctness -- a failure here must never be reported
  // as a failed save, or the operator re-enters data that was in fact stored.
  try {
    const editId = await generateNewId("purchase_order_edits", "POE");
    await insert("purchase_order_edits", {
      id: editId,
      purchase_order_id: po_id,
      edited_by_id: auth.actor.id,
      edited_by_name: created_by,
      edited_at: new Date().toISOString(),
      previous_status: previousPo.status,
      previous_subtotal_amount: Number(previousPo.subtotal_amount) || 0,
      previous_line_count: previousLineCount,
      new_subtotal_amount: subtotal_amount,
      new_line_count: lines.length,
    });
  } catch (trailError: unknown) {
    console.error("purchase_order_edits trail write failed (save already committed):", trailError);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/admin/inventory/purchase-orders/actions.subtotal.test.ts`
Expected: PASS, including the pre-existing subtotal-guard tests.

- [ ] **Step 5: Commit**

```bash
git add app/admin/inventory/purchase-orders/
git commit -m "Claude-Sonnet fix: edit-trail failure must not report a committed save as failed"
```

---

### Task 2: Apply migration 0041

- [ ] **Step 1: Apply**

Run the project's normal migration apply path for `0041_purchase_order_edits.sql`.

- [ ] **Step 2: Verify**

Confirm the table exists and is queryable, then confirm an admin PO edit now
writes exactly one `purchase_order_edits` row. Use a PO other than PO-037 for
this check, or re-save PO-037 unchanged — a replace of identical data is safe,
but say which you did.

- [ ] **Step 3: Report**

Tell the owner in Vietnamese that the false error is gone, and that his earlier
PO-037 edit has no trail row because the table did not exist at the time. That
gap is expected and needs no repair.

---

### Task 3: The stock audit must skip deliberately untracked ingredients

**Files:**
- Modify: `lib/item-balance-summary.ts`
- Modify: `lib/item-balance-summary.test.ts`
- Modify: `scripts/audit-full-history-recompute.ts`

`base_ingredients.is_non_inventory` exists (migration 0001, line 153) and
`getRealtimeStock` already excludes flagged ingredients. The audit does not, so
tap water and boiled water appear in the negative list — Nước sôi at -112,230
currently sits at the top and buries the five ingredients that actually matter.

The owner decided on 2026-07-29 that **Nước, Nước sôi, and Đá viên** are all
non-inventory. He will tick the "Phi lưu kho" checkbox himself on
`/admin/inventory/base-ingredients`; do not write those flags for him.

- [ ] **Step 1: Write the failing test**

```typescript
it("excludes non-inventory ingredients from both lists", () => {
  const result = summariseItemBalances({
    theoreticalByItem: new Map([["ING-001", -112230], ["ING-003", -6651]]),
    recordedByItem: new Map([["ING-001", -112230], ["ING-003", -6651]]),
    nameOf: (id) => ({ "ING-001": "Nước sôi", "ING-003": "Sữa đặc" }[id] || id),
    nonInventoryItems: new Set(["ING-001"]),
  });
  expect(result.negatives.map(r => r.item_name)).toEqual(["Sữa đặc"]);
  expect(result.mismatches).toHaveLength(0);
});

it("treats an omitted nonInventoryItems set as excluding nothing", () => {
  const result = summariseItemBalances({
    theoreticalByItem: new Map([["ING-001", -5]]),
    recordedByItem: new Map([["ING-001", -5]]),
    nameOf: (id) => id,
  });
  expect(result.negatives).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/item-balance-summary.test.ts`
Expected: FAIL — `nonInventoryItems` is not yet a parameter.

- [ ] **Step 3: Implement**

Add an optional `nonInventoryItems?: Set<string>` to the input and skip those
ids when building both lists. Default to excluding nothing, so existing callers
and existing artifacts are unaffected.

- [ ] **Step 4: Wire the script**

`scripts/audit-full-history-recompute.ts` already loads `Base_Ingredients` for
`nameOf`. Build the set from rows whose `is_non_inventory` is `true` or the
string `"TRUE"` (the column is written as a string by
`app/admin/inventory/base-ingredients/actions.ts:96`; handle both). Pass it in.

Print the excluded count on its own line so the exclusion is visible rather than
silent:

> `Bỏ qua N nguyên liệu phi lưu kho: <tên>, <tên>`

- [ ] **Step 5: Verify and commit**

Run `npx tsc --noEmit`, `npm test`.

```bash
git add lib/item-balance-summary.ts lib/item-balance-summary.test.ts scripts/audit-full-history-recompute.ts
git commit -m "Claude-Sonnet fix: exclude non-inventory ingredients from the stock audit"
```

---

### Task 4: Re-run the audit and report the current picture

Run **after** the owner confirms he has ticked the three ingredients.

- [ ] **Step 1: Run live**

Run: `npx vite-node scripts/audit-full-history-recompute.ts`

- [ ] **Step 2: Report to the owner**

This is the first reading that reflects both the PO-037 repair and the
non-inventory exclusions. Report in Vietnamese with real names:

- Which ingredients are still negative, and by how much.
- Whether PO-037's restored lines changed anything (compare against the eight
  negatives found on 2026-07-29: Nước sôi -112,230.24, Đá viên -14,729.32,
  Sữa đặc -6,651, Lá hồng trà -2,009.58, Trái tắc -420, Siro việt quất -290,
  Nước -13, Trái chanh -13).
- The mismatch count, which is expected to be **non-zero now**: PO-037's edit
  wrote fresh backdated `PO_RECEIPT` rows, so the derived layer is stale until
  Phase 4 rebuilds it. Say this plainly so it is not mistaken for new damage.

- [ ] **Step 3: Update tracking and commit**

Append to `DEVELOPMENT-TRACKING.md` and update `docs/ROADMAP.md`.

---

## What comes next

Phase 3: full backup plus a **verified restore drill**, which has never been
done in this project and must complete before Phase 4 deletes derived data.
Phase 4 then rebuilds stock from source, now that PO-037 carries its real lines.
