# UI Consistency Audit Findings

Date: 2026-07-06

## Summary

- **Pages audited:** 28
- **Loading states:** 5 pages use global skeleton, 4 use basic `<Suspense>`, most remaining use blank fallback (no boundary).
- **Empty states:** 15+ inconsistent patterns found (mixing `py-8` non-italic, `py-12 italic`, rich states with icons, and basic standalone divs).
- **Error states:** Mix of inline styled alerts (red vs rose), native `alert()` calls, and completely unhandled errors in UI.
- **Page headers:** `StickyFilterBar` is widely used, but several core pages (Dashboard, Brands, Units, Categories) hardcode custom flexbox headers.
- **Table layouts:** Inconsistent header typography (`text-sm font-medium` vs `text-[11px] uppercase tracking-wider`) and hover states (`hover:bg-gray-50` vs `hover:bg-gray-50/50 transition-colors`).
- **Colors:** Semantic colors are fragmented across palettes (`red`/`rose`, `amber`/`orange`/`yellow`, `green`/`emerald`).

## Per-pattern findings

### Loading states

| Page | Current | Recommended | Priority |
|---|---|---|---|
| /admin/orders | `<Suspense fallback="Đang tải...">` | `<Suspense>` + Skeleton | High |
| /admin/inventory/items | `<Suspense fallback="Đang tải...">` | `<Suspense>` + Skeleton | High |
| /admin/reports/* | Blank (No boundary) | `<Suspense>` + Skeleton | High |
| /admin/products/* | Blank (No boundary) | `<Suspense>` + Skeleton | High |
| /admin/brands, suppliers, etc. | Global `loading.tsx` | Local `<Suspense>` + Skeleton | Medium |

### Empty states

| Page | Current | Recommended | Priority |
|---|---|---|---|
| /admin/brands, /units, /categories | `py-8` non-italic table row | Rich empty state component | High |
| /admin/suppliers, /inventory/* | `py-12 italic` table row | Rich empty state component | High |
| /admin/promotions, /products | Rich block with icon/emoji | Rich empty state component | Medium |
| /admin/semi-products, /activity-log | Bordered div block | Rich empty state component | Medium |

### Error states

| Page | Current | Recommended | Priority |
|---|---|---|---|
| /admin/orders | Native `alert()` on Void/Save | Inline Alert component or Toast | High |
| /admin/products/categories (Forms) | Inline `bg-red-50 text-red-600` | Standardized semantic `rose` alert | Medium |
| /admin/backup, /inventory/stock-adj | Inline `bg-rose-50 text-rose-800` | Standardized semantic `rose` alert | Low |

### Page headers

| Page | Current | Recommended | Priority |
|---|---|---|---|
| /admin/brands | Inline flexbox | `<StickyFilterBar>` or standard header | Medium |
| /admin/inventory/units | Inline flexbox | `<StickyFilterBar>` or standard header | Medium |
| /admin/inventory/categories | Inline flexbox | `<StickyFilterBar>` or standard header | Medium |
| /admin/products/cogs-estimate | Custom border-b div | Standard header component | Medium |

### Table layout

| Page | Current | Recommended | Priority |
|---|---|---|---|
| /admin/brands | `text-sm`, `hover:bg-gray-50` | `text-[11px] uppercase`, `hover:bg-gray-50/50 transition` | Medium |
| /admin/inventory/units, /categories | `text-sm font-medium`, `p-4` or `px-6 py-4` | `text-[11px] uppercase`, `hover:bg-gray-50/50 transition` | Medium |
| /admin/reports/sales | `py-2` spacing, `hover:bg-gray-50` | Standard `px-6 py-4` spacing | Low |

### Form footers

| Page | Current | Recommended | Priority |
|---|---|---|---|
| /admin/brands (BrandForm) | Cancel text button (no bg) | Filled Cancel button (`bg-gray-100`) | Low |
| DeleteConfirmModal | Cancel filled button | Standardize Cancel button | Low |

### Colors

| Context | Current | Recommended | Priority |
|---|---|---|---|
| Success | `emerald-500` vs `green-500` | `emerald` across the board | Low |
| Error | `red-500` vs `rose-500` | `rose` across the board | Low |
| Warning | `amber` vs `yellow` vs `orange` | `amber` for warnings | Low |

## Top Priority Fixes

1. **Standardize empty states**: Build and deploy a reusable `<EmptyState>` component to replace the 15+ variations of table rows and standalone divs across all list pages.
2. **Standardize table layouts**: Unify all tables to use the modern `text-[11px] uppercase tracking-wider font-bold` for headers, and `hover:bg-gray-50/50 transition-colors` for rows.
3. **Fix error handling on Orders**: Remove native `alert()` calls and replace with inline styled alerts matching the rest of the application.
4. **Standardize page headers**: Convert `Brands`, `Units`, and `Categories` pages to use `<StickyFilterBar>` or the standard header layout.
5. **Standardize loading states**: Implement local `<Suspense>` boundaries with skeleton loaders across data-heavy pages instead of relying on blank fallbacks or plain text "Đang tải...".
