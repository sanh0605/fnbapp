# Antigravity Prompt — a11y: touch-action + form labels htmlFor

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Trigger: UI audit follow-up. 2 systemic a11y issues remain: (1) `touch-action: manipulation` system-wide = 0 (mobile tap delay), (2) ~172 `<label>` elements without `htmlFor` binding (screen reader users can't associate labels with inputs).

## Task 1: `touch-action: manipulation` (10 minutes)

**File:** `app/globals.css`

**Why:** Mobile users experience 300ms tap delay on buttons/links because browsers wait to detect double-tap zoom. `touch-action: manipulation` disables double-tap detection, making UI feel instant.

**Fix:** Add to existing globals.css (after the `:focus-visible` block from Phase B):

```css
/* Mobile: remove 300ms tap delay on interactive elements */
button,
a,
[role="button"],
input[type="submit"],
input[type="button"],
[tabindex]:not([tabindex="-1"]) {
  touch-action: manipulation;
}
```

**Verify:** Open `/admin/orders` on mobile viewport (DevTools → Toggle device toolbar → iPhone 12). Tap a button — should feel instant, no delay.

## Task 2: Form labels htmlFor audit + fix (1-2 hours)

**Why:** Screen reader users navigate forms by label. Without `htmlFor`/`id` binding, screen reader announces "edit text" with no context — unusable. Login page already fixed (Phase C1). Other 20 form files still have this issue.

**Pattern:**

```tsx
// Current (broken):
<label className="block text-sm font-medium text-gray-700 mb-1">
  Tên Nhà Cung Cấp
</label>
<input type="text" ... />

// Fixed:
<label htmlFor="supplier-name" className="block text-sm font-medium text-gray-700 mb-1">
  Tên Nhà Cung Cấp
</label>
<input id="supplier-name" type="text" ... />
```

**Files to audit + fix** (form components only, skip non-form `<label>` usages like status badges):

| File | Labels | Priority |
|---|---|---|
| `app/admin/promotions/components/PromotionForm.tsx` | 11 | High (largest) |
| `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx` | 10 | High |
| `components/PurchaseOrderForm.tsx` (legacy) | 10 | Skip if not used |
| `components/PurchaseOrderForm.tsx` | 10 | High |
| `components/ProductForm.tsx` | 7 | High |
| `app/admin/inventory/items/components/PurchasedItemForm.tsx` | 6 | Medium |
| `components/inventory/PurchasedItemForm.tsx` (legacy) | 7 | Skip if not used |
| `app/admin/inventory/conversions/components/ConversionForm.tsx` | 4 | Medium |
| `components/inventory/ConversionForm.tsx` | 5 | Medium |
| `app/admin/semi-products/components/SemiProductForm.tsx` | 5 | Medium |
| `app/admin/suppliers/components/SupplierForm.tsx` | 5 | Medium |
| `app/admin/products/cogs-estimate/CogsCalculator.tsx` | 5 | Medium |
| `components/ModifierForm.tsx` | 4 | Medium |
| `app/admin/products/modifiers/components/ModifierForm.tsx` | 3 | Medium |
| `app/admin/brands/components/BrandForm.tsx` | 3 | Medium |
| `app/admin/inventory/base-ingredients/components/BaseIngredientForm.tsx` | 3 | Medium |
| `components/inventory/BaseIngredientForm.tsx` | 3 | Medium |
| `app/admin/users/components/UserForm.tsx` | 3 | Medium |
| `app/admin/users/components/EditUserForm.tsx` | 3 | Medium |
| `components/EditUserForm.tsx` | 3 | Medium |
| `components/UserForm.tsx` | 3 | Medium |
| `components/SemiProductForm.tsx` | 5 | Medium |
| `components/SupplierForm.tsx` | 5 | Medium (ref pattern — already done?) |
| `app/admin/production/components/ProductionForm.tsx` | 2 | Low |
| `components/ProductionForm.tsx` | 2 | Low |
| `app/admin/inventory/units/UnitForm.tsx` | 2 | Low |
| `components/inventory/CategoryForm.tsx` | 2 | Low |
| `app/admin/products/categories/components/ProductCategoryForm.tsx` | 1 | Low |
| `components/ProductCategoryForm.tsx` | 1 | Low |
| `app/settings/password/page.tsx` | 3 | Low |

**ID convention:** Use kebab-case based on field name, prefixed with form name to avoid collisions. Examples:
- `supplier-name`, `supplier-phone`, `supplier-address`
- `po-supplier`, `po-order-date`, `po-line-1-item`
- `promotion-code`, `promotion-start`, `promotion-end`

**For dynamically-generated IDs (e.g., PO line items):** Use React's `useId()` hook:

```tsx
const lineId = useId();
// ...
<label htmlFor={`${lineId}-item`}>Hàng hoá</label>
<input id={`${lineId}-item`} ... />
```

**Skip:**
- `<label>` used as status badge in tables (not associated with input)
- `<label>` in non-form contexts (filter tabs, etc.)
- Legacy duplicates in `components/inventory/*` if they're not used (verify imports first)

**Verify:**
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual: open 3 representative forms (SupplierForm, PromotionForm, PurchaseOrderForm), use browser accessibility tree (DevTools → Elements → Accessibility) — verify each input is associated with its label

## Commit strategy

Suggested: split into 2 commits for clean history:

1. `Antigravity ui(a11y): touch-action manipulation system-wide (mobile tap delay)`
2. `Antigravity ui(a11y): form labels htmlFor binding (screen reader a11y)`

## Out of scope

- Do NOT change label styling or layout
- Do NOT refactor form architecture
- Do NOT touch the legacy `components/inventory/*` files UNLESS they're actively imported (verify first)
- Do NOT add `aria-label` to inputs that already have visible labels (would be redundant)

## Follow-up

After this completes, the original UI audit's accessibility findings are officially CLOSED except for:
- `aria-live` regions on admin error displays (only POSScreen + login have it now)
- Full URL state sync to remaining pages (Stock, Items, Promotions)
- Phase D items: Intl.NumberFormat, snapshot-first lookup audit on POS cart
