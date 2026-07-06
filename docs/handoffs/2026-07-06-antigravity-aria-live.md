# Antigravity Prompt — aria-live regions for admin error displays

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Priority: 2 (per roadmap)
Estimated effort: ~45 minutes

## Goal

Add `aria-live="polite"` and `role="alert"` to error display elements in 12 admin form/client files. After this change, screen reader users get announced when form submission fails or async errors occur.

Currently only `app/login/page.tsx` and `components/POSScreen.tsx` have aria-live (1 occurrence each). The other 12 form/client files render error `<div>`s without semantics.

## Pattern

**Before (broken):**
```tsx
{error && (
  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
    {error}
  </div>
)}
```

**After (fixed):**
```tsx
{error && (
  <div
    role="alert"
    aria-live="polite"
    className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100"
  >
    {error}
  </div>
)}
```

Why both `role="alert"` AND `aria-live="polite"`:
- `role="alert"` → screen reader announces immediately when element appears
- `aria-live="polite"` → screen reader announces content changes (e.g., error message updates from "Validating..." to "Username required")
- Combined: covers both initial appearance and content updates

## Files to fix (12 files)

```text
app/admin/promotions/components/PromotionForm.tsx
app/admin/products/categories/components/ProductCategoryForm.tsx
app/admin/production/components/ProductionForm.tsx
app/admin/users/components/EditUserForm.tsx
app/admin/users/components/UserForm.tsx
app/admin/inventory/base-ingredients/components/BaseIngredientForm.tsx
app/admin/products/modifiers/components/ModifierForm.tsx
app/admin/semi-products/components/SemiProductForm.tsx
app/admin/inventory/conversions/components/ConversionForm.tsx
app/admin/inventory/items/components/PurchasedItemForm.tsx
app/admin/suppliers/components/SupplierForm.tsx
app/admin/inventory/sync/page.tsx
app/admin/inventory/stock-adjustments/components/StockAdjustmentsClient.tsx
app/admin/backup/components/BackupClient.tsx
```

(Note: 14 files have error state; login + POSScreen already done. So 12 remain — the list above.)

## How to find each instance

For each file, search for error display patterns:

```bash
grep -nA2 "error &&\|{error\|setError" <file>
```

Look for `<div>` blocks that render error text. Add `role="alert" aria-live="polite"` attributes.

## Edge cases

1. **Multiple error blocks in same file** — add to ALL of them (some forms have inline field errors + summary error)
2. **Toast notifications** — if the file has toast UI (not just inline errors), wrap the toast container with `role="region" aria-live="polite"` (mirror POSScreen pattern, line ~849)
3. **Success messages** — add `role="status" aria-live="polite"` (success is informational, not urgent like error)
4. **Warning messages** — `aria-live="polite"` only (no role, warnings aren't critical)

## Don't change

- Error styling (colors, padding, borders)
- Error state logic (setState, try/catch)
- Form architecture
- Component structure

Just add the 2 attributes to existing error `<div>`s.

## Verify

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual a11y check on 3 representative forms:
   - Open `/admin/suppliers`, click "Thêm Nhà Cung Cấp", submit empty form
   - Verify error appears AND has `role="alert"` (DevTools → Accessibility tab)
   - Screen reader test (VoiceOver/NVDA if available): error should be announced
4. Pre-commit hook passes

## Commit

Suggested: `Antigravity ui(a11y): aria-live regions for admin error displays (12 files)`

## Out of scope

- Do NOT add aria-live to non-error elements (labels, hints, help text)
- Do NOT refactor error state management
- Do NOT touch login/POSScreen (already done)
- Do NOT add new dependencies
- Surgical: ~24 attribute additions across 12 files

## Coordination note

This task is INDEPENDENT of Task 1 (Intl migration). Can be done in parallel or in any order. If Task 1 is in progress, wait for it to commit first to avoid merge conflicts.
