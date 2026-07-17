# Task: UI-REMED-6 — Remove StickyFilterBar, Use PageHeader

## Context

User visual review sau UI-REMED-1 close phát hiện: StickyFilterBar có box styling (`bg-surface-card/95 backdrop-blur-md border-b border-border shadow-sm`) + negative margins (`-mx-4 md:-mx-8`) tạo cảm giác "hộp đè lên trang", không liền mạch như các trang dùng `PageHeader` (vd: brands, suppliers).

User decision 2026-07-17: **remove StickyFilterBar completely**. All 16+ client pages migrate to:
- `PageHeader` cho title (flat, consistent with brands/suppliers pages)
- Inline filter row (no sticky wrapper, scroll cùng page)

POS complaint (separate concern, deferred to POS-REDESIGN-1).

## Goal

1. Modify 16+ client files to remove StickyFilterBar usage, replace with PageHeader + inline filter row.
2. Delete `components/StickyFilterBar.tsx` after all callers migrated.
3. Verify each page visually matches brands/suppliers style (flat, no "box" feel).

## Migration pattern

### Before

```tsx
import StickyFilterBar from "@/components/StickyFilterBar";

<StickyFilterBar 
  title="Danh sách đơn hàng" 
  subtitle="..."
  rightContent={<Button onClick={handleNew}>Tạo mới</Button>}
>
  <SearchableSelect ... />
  <CustomDatePicker ... />
  <input ... />
</StickyFilterBar>
```

### After

```tsx
import { PageHeader } from "@/components/ui/PageHeader";

<PageHeader
  title="Danh sách đơn hàng"
  subtitle="..."
  actions={<Button onClick={handleNew}>Tạo mới</Button>}
/>
<div className="flex flex-wrap items-end gap-3 mb-6">
  <SearchableSelect ... />
  <CustomDatePicker ... />
  <input ... />
</div>
```

### Rules

1. **Title/subtitle**: move to `<PageHeader title="..." subtitle="..." />` props.
2. **rightContent**: rename to `actions` (PageHeader prop name).
3. **Filter children**: wrap in `<div className="flex flex-wrap items-end gap-3 mb-6">`. Apply same responsive classes if needed (`flex-col sm:flex-row` for mobile).
4. **Mobile expand button**: NOT needed (no sticky = no collapse). Filters stack on mobile naturally via flex-wrap.
5. **Remove import**: `import StickyFilterBar from "@/components/StickyFilterBar"` → remove. Add `import { PageHeader } from "@/components/ui/PageHeader"` if not already.
6. **Preserve all filter behavior**: search input, date picker, select, button — all keep same `value`, `onChange`, etc.

## Files to migrate (16+ client files)

Phase 1 audit flagged these StickyFilterBar users (verify all during implementation):

| File | StickyFilterBar count | Notes |
|---|---:|---|
| `app/admin/orders/OrderTable.tsx` | 2 | Filter-heavy, mobile-critical |
| `app/admin/products/ProductsClient.tsx` | 1 | |
| `app/admin/promotions/components/PromotionsClient.tsx` | 1 | |
| `app/admin/users/components/UsersClient.tsx` | 1 | |
| `app/admin/semi-products/components/SemiProductsClient.tsx` | 1 | |
| `app/admin/production/components/ProductionClient.tsx` | 1 | |
| `app/admin/inventory/items/components/ItemsClient.tsx` | 1 | |
| `app/admin/inventory/stock-adjustments/components/StockAdjustmentsClient.tsx` | 1 | |
| `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx` | 1 | |
| `app/admin/inventory/categories/components/CategoriesClient.tsx` | 1 | |
| `app/admin/inventory/conversions/components/ConversionsClient.tsx` | 1 | |
| `app/admin/inventory/base-ingredients/components/BaseIngredientsClient.tsx` | 1 | |
| `app/admin/activity-log/components/ActivityLogClient.tsx` | 2 | |
| `app/admin/backup/components/BackupClient.tsx` | 1 | |
| `app/admin/suppliers/components/SuppliersClient.tsx` | 1 | (verify — suppliers page might already use PageHeader) |
| `app/admin/brands/components/BrandsClient.tsx` | (verify) | (might already use PageHeader — check before migrating) |

Total: ~16-18 StickyFilterBar instances across ~15 files.

## Scope

### In scope

1. Migrate all 16+ client files per pattern above.
2. Delete `components/StickyFilterBar.tsx` after all callers migrated.
3. Visual verify each page (especially: title align matches brands, filter row visible, mobile 375px stacks correctly).
4. Verify no remaining `import StickyFilterBar` in codebase (grep returns 0).

### Out of scope

- Do NOT touch `PageHeader` component itself (works fine).
- Do NOT redesign POS (separate task POS-REDESIGN-1).
- Do NOT change filter logic, validation, or behavior.
- Do NOT migrate StickyFilterBar to a new "FilterRow" primitive — just inline `<div className="flex flex-wrap gap-3">`. If consistency needed later, extract component then.
- Do NOT push to remote.

## Constraints

- **PageHeader import**: every migrated file must import from `@/components/ui/PageHeader`.
- **Filter row class**: `flex flex-wrap items-end gap-3 mb-6` (consistent across all pages).
- **Mobile-first**: filter row must stack vertically at 375px (flex-wrap handles this).
- **No new component**: inline div only. If Antigravity feels need for FilterRow primitive, flag in report (don't create unsolicited).
- **Atomic commit**: all 16 files + StickyFilterBar deletion in single commit.
- **TS clean + build clean + tests pass**.

## Verification

1. **TS**: `tsc --noEmit` 0 errors.
2. **Build**: `npm run build` success.
3. **Tests**: `vitest run` 403/403 baseline (no test files modified).
4. **Grep**: `rg "StickyFilterBar" app/ components/` returns 0 matches.
5. **Visual smoke** at desktop 1280px + mobile 375px:
   - `/admin/orders` — title aligns left, filter row visible, no "box" feel
   - `/admin/products` — same
   - `/admin/inventory/items` — same
   - `/admin/users` — same
6. **`git diff --check`**: clean.

## Expected output

- 16+ modified client files.
- `components/StickyFilterBar.tsx` DELETED.
- Commit: `Antigravity ui: remove StickyFilterBar, use PageHeader (UI-REMED-6)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P1 — visual consistency fix after UI-REMED-1. Antigravity pickup. ~1.5-2 sessions (16 files mechanical migration + visual verify).

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (High)` — bulk mechanical refactor across many files with visual verification.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Any page's StickyFilterBar has unusual structure (e.g., nested rightContent, conditional rendering) that doesn't fit PageHeader pattern.
- Filter inputs need sticky behavior for usability (e.g., very long list with filters at top — would require different solution).
- Mobile layout breaks (filter row overflows horizontally at 375px).
- An existing page already uses PageHeader in addition to StickyFilterBar (would indicate double-header bug).

## Questions before starting

- Should filter row have its own `<FilterRow>` primitive for consistency? Recommend NO — inline div is enough. Extract later if 3+ pages diverge.
- PageHeader subtitle optional? Recommend YES — same as current (only render if prop provided).
- Filter row spacing: `gap-3 mb-6` enough, or need more breathing room? Recommend `gap-3 mb-6` (matches existing filter bar internal spacing).
