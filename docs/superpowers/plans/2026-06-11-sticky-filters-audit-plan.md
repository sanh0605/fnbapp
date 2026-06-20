# Audit Report: Sticky Filters Feature

**Auditor:** Claude CLI (Architect / Auditor)
**Date:** 2026-06-11
**Scope:** 5 files related to the Sticky Filters feature

---

## Summary

The Sticky Filters feature is structurally sound. The component split is clean, auto-submit with debounce is correctly implemented, and the `useMemo` / `useEffect` dependency arrays are complete. However, the audit found **6 issues** ranging from a broken CSS class (mobile scrollbar not hidden) to a missing status filter, URL encoding bugs, and type safety violations.

**Severity scale:** P0 = broken behavior, P1 = wrong behavior in edge cases, P2 = code quality / consistency.

---

## File-by-File Findings

### 1. `components/StickyFilterBar.tsx`

**[P0] `hide-scrollbar` CSS class is never defined**

- `overflow-x-auto hide-scrollbar` is used on line 15, but the class `hide-scrollbar` does not exist in `globals.css`, `tailwind.config.ts`, or any stylesheet. The scrollbar will always be visible on mobile.
- **Fix:** Add the utility class to `app/globals.css`:
  ```css
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  ```

**[P2] `ml-auto` on `rightContent` inside scrollable container**

- Line 19: `ml-auto` pushes `rightContent` to the far right of the flex container, which is inside `overflow-x-auto`. On mobile with many filters, the user must scroll past ALL filters to reach the right content (e.g., preset buttons, result count).
- **Fix:** Remove `ml-auto` and use a fixed-position approach or move right content outside the scrollable row. Alternatively, add a visible separator and accept the scroll behavior. Low priority since current filter counts fit on most screens.

### 2. `components/SalesFilter.tsx`

**[P1] URL construction uses raw string interpolation, no encoding**

- Lines 58-61: URL is built via template literal:
  ```
  let url = `?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
  if (brandId) url += `&brandId=${brandId}`;
  if (staffName) url += `&staffName=${staffName}`;
  ```
  If `staffName` contains `&`, `=`, `+`, or Unicode characters, the URL will break or decode incorrectly on the server side.
- **Fix:** Use `URLSearchParams`:
  ```typescript
  const params = new URLSearchParams();
  params.set("start", startDate.toISOString());
  params.set("end", endDate.toISOString());
  if (brandId) params.set("brandId", brandId);
  if (staffName) params.set("staffName", staffName);
  if (categoryId) params.set("categoryId", categoryId);
  router.push(`?${params.toString()}`);
  ```

**[P1] Debounce logic captures stale `startDate` / `endDate` in some edge cases**

- The debounce pattern (setTimeout + cleanup) is correct in isolation. However, if `startDate` and `endDate` change in the same event tick (e.g., preset buttons call `setStartDate` and `setEndDate` back-to-back on lines 68-75), React batches the state updates, the effect fires once with both new values, and a single timeout is created. This is actually fine.
- **But:** The `setPreset` function (lines 68-75) sets both dates without checking if `startDate` and `endDate` are already the same. Each preset click always triggers a re-render and URL push even if the dates haven't changed.
- **Fix (optional):** Compare new dates with current before setting. Low priority.

**[P2] All props typed as `any[]`**

- Lines 9-11, 24-27: `brands: any[]`, `users: any[]`, `categories: any[]`. Violates CLAUDE.md rule "Prefer explicit typing. Avoid `any`."
- **Fix:** Define interfaces for `Brand`, `User`, `Category` (or reuse from a shared types file).

**[P2] Inline filter `.filter(b => b.status !== "DELETED" && b.status !== "INACTIVE")` repeated 3 times**

- Lines 111, 122, 133: Same filter logic duplicated for brands, users, categories.
- **Fix:** Filter once at the top of the component or accept as-is (3 occurrences is tolerable).

### 3. `app/admin/orders/OrderTable.tsx`

**[P1] `currentOrders` is not memoized**

- Line 92: `const currentOrders = filteredOrders.slice(...)` is computed directly (not wrapped in `useMemo`). It recalculates on every render, including when modals open/close (`setSelectedOrder`, `setEditingOrder`, `setOrderToDelete`).
- **Fix:** Wrap in `useMemo`:
  ```typescript
  const currentOrders = useMemo(() =>
    filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredOrders, currentPage]
  );
  ```

**[P2] Inconsistent DatePicker component**

- Uses raw `react-datepicker` (line 4) while `SalesFilter.tsx` uses `CustomDatePicker`. The raw `DatePicker` doesn't match the app's styling wrapper.
- **Fix:** Use `CustomDatePicker` for consistency (or leave as-is if `CustomDatePicker` doesn't support `isClearable`).

**[P2] All props typed as `any[]`**

- Lines 43-48: `brands: any[]`, `products: any[]`, etc.
- **Fix:** Define proper interfaces.

### 4. `app/admin/products/page.tsx`

**No sticky-filter-related issues.** This is a server component that fetches data and passes it to `ProductsClient`. The data fetching and filtering logic is correct.

**[P2] Excessive `any` casts** (lines 40, 41, 45, 51, 56, 58, 67) -- server component, less critical but still violates type safety guidelines.

### 5. `app/admin/products/ProductsClient.tsx`

**[P1] Missing "Trang thai" (Status) filter**

- Requirements spec says: "Them bo loc Danh muc (Category) va **Trang thai** cho trang San pham." Only category filter is implemented. Status filter is absent.
- **Fix:** Add a status dropdown (e.g., "Active", "Inactive", "Deleted") and include it in the `useMemo` filter logic. Alternatively, confirm with the user whether status filtering is needed for Phase 1.

**[P2] `rightContent` is recreated on every render**

- Lines 32-36: `rightContent` is a JSX element computed on every render. It depends on `filteredProducts.length` which is memoized, so the cost is minimal (just JSX allocation). Low priority.

---

## Issues Summary Table

| # | File | Severity | Issue |
|---|------|----------|-------|
| 1 | StickyFilterBar.tsx | **P0** | `hide-scrollbar` class undefined -- mobile scrollbar always visible |
| 2 | StickyFilterBar.tsx | P2 | `ml-auto` right content can scroll off-screen on mobile |
| 3 | SalesFilter.tsx | **P1** | URL built with raw string interpolation -- breaks on special chars |
| 4 | SalesFilter.tsx | P2 | All props typed as `any[]` |
| 5 | SalesFilter.tsx | P2 | Inline filter logic repeated 3 times |
| 6 | OrderTable.tsx | **P1** | `currentOrders` not memoized -- recalculates on modal open/close |
| 7 | OrderTable.tsx | P2 | Inconsistent DatePicker usage |
| 8 | ProductsClient.tsx | **P1** | Missing Status filter (required by spec) |
| 9 | Multiple files | P2 | Excessive `any` types |

---

## Refactoring Plan

Execute in this order. Each item is independently deliverable.

### Step 1: Fix `hide-scrollbar` (P0)
- **File:** `app/globals.css`
- **Action:** Add `.hide-scrollbar` utility class.
- **Verify:** Open any page with StickyFilterBar on mobile browser -- scrollbar should be invisible.

### Step 2: Fix URL encoding in SalesFilter (P1)
- **File:** `components/SalesFilter.tsx`
- **Action:** Replace string interpolation with `URLSearchParams` in the `useEffect` auto-submit.
- **Verify:** Set `staffName` to a value containing `&` or Vietnamese diacritics -- URL should encode correctly and filters should still work after page reload.

### Step 3: Memoize `currentOrders` in OrderTable (P1)
- **File:** `app/admin/orders/OrderTable.tsx`
- **Action:** Wrap `currentOrders = filteredOrders.slice(...)` in `useMemo` with deps `[filteredOrders, currentPage]`.
- **Verify:** Open/close order detail modal -- no unnecessary re-slice of the array.

### Step 4: Add Status filter to ProductsClient (P1)
- **File:** `app/admin/products/ProductsClient.tsx`
- **Action:** Add `statusFilter` state and a dropdown. Include status check in the `useMemo` filter. Only show if products have a `status` field that differs from the server-side pre-filter (check data shape first).
- **Verify:** Filter by status -- product list updates correctly.
- **Note:** Confirm with user whether this is needed for Phase 1 before implementing, since the server component already filters out DELETED products.

### Step 5 (Optional): Type safety improvements (P2)
- **Files:** `SalesFilter.tsx`, `OrderTable.tsx`, `ProductsClient.tsx`, `page.tsx`
- **Action:** Replace `any[]` with proper interfaces. Create shared types if not already present.
- **Verify:** `rtk tsc` passes with zero errors.

### Step 6 (Optional): Right content scroll behavior (P2)
- **File:** `components/StickyFilterBar.tsx`
- **Action:** Evaluate whether `ml-auto` on rightContent causes usability issues on real mobile devices. If so, move rightContent outside the scrollable row or use a different layout strategy.
- **Verify:** Manual testing on mobile viewport.

---

## What Looks Good

- Component architecture: `StickyFilterBar` as a shared wrapper is clean and reusable.
- Debounce pattern in `SalesFilter`: `setTimeout` + cleanup in `useEffect` is the correct React pattern.
- `isMounted` ref to skip initial render auto-submit: correctly prevents duplicate initial fetch.
- Dependency arrays: all `useMemo` and `useEffect` hooks have complete dependency lists.
- Server/client split in Products: `page.tsx` (server) fetches data, `ProductsClient.tsx` (client) handles filtering -- correct pattern.
- Tailwind styling: consistent, uses `shrink-0` on each filter to prevent collapse in scrollable container.
- `Suspense` boundary in `SalesFilter`: correctly wraps `useSearchParams()` usage.
