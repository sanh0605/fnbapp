# Antigravity Prompt — UI Consistency Sweep (Task U2)

Date: 2026-07-10
Owner: Antigravity (UI Lead)
Trigger: U1 (sidebar reorg) done. Page hierarchy stable. Apply shared UI components comprehensively across all admin pages.

## Background

Existing reference: `docs/audits/2026-07-06-ui-consistency-audit.md` (28 pages audited).

Shared components already built in prior sessions:
- `components/ui/PageHeader.tsx` — title + subtitle + actions layout
- `components/ui/EmptyState.tsx` — rich empty state with icon
- `components/ui/Skeleton.tsx` + `SkeletonTable.tsx` — loading skeletons

Loading.tsx exists only on 4 routes:
- `/admin` (global)
- `/admin/orders`
- `/admin/reports/sales`
- `/admin/audit/backdated-ledger`

**Gap:** 20+ admin pages still use inconsistent patterns. Audit identified:
- 15+ empty state variations
- Mix of inline alerts vs native `alert()`
- Inconsistent table headers (text-sm vs text-[11px] uppercase)
- 4 pages with custom hardcoded headers
- Color fragmentation (red/rose, amber/yellow/orange, green/emerald)

## Goal

Comprehensive UI sweep — apply shared components + standardize patterns across all admin pages. Multiple commits, batched by category for clean rollback.

## Standard pattern (apply to every page)

Every list/form admin page should have:

1. **PageHeader** at top (`<PageHeader title="..." subtitle="..." actions={...} />`)
2. **Loading state**: local `loading.tsx` with Skeleton OR `<Suspense fallback={<SkeletonTable />}>`
3. **Empty state**: `<EmptyState>` component (not `<div>Không có dữ liệu</div>` or `<tr><td className="py-8">...</td></tr>`)
4. **Error state**: inline alert with `rose` color (NOT native `alert()`)
5. **Table header**: `text-[11px] uppercase tracking-wider font-bold text-gray-500`
6. **Table row hover**: `hover:bg-gray-50/50 transition-colors`
7. **Colors**:
   - Success: `emerald-*`
   - Error: `rose-*`
   - Warning: `amber-*`

## Mobile-first requirement (CRITICAL — applies to all batches)

User directive: **mobile-first, then desktop**. App is used heavily on mobile (POS, dashboard, inventory). Building desktop-first then "making it responsive" produces worse mobile UX.

### Required patterns for every list page

1. **Two render paths** — mobile card layout + desktop table:
   ```tsx
   {/* Desktop table (>= md) */}
   <div className="overflow-x-auto hidden md:block">
     <table>...</table>
   </div>

   {/* Mobile card layout (< md) */}
   <div className="md:hidden flex flex-col gap-3 p-4 bg-gray-50/30">
     {items.map(item => (
       <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
         {/* card content */}
       </div>
     ))}
   </div>
   ```

2. **Touch targets min 44×44px** — buttons, links, icons clickable on mobile:
   ```tsx
   <button className="p-2 -m-2 md:p-0 md:m-0 min-h-[44px] md:min-h-0">
   ```

3. **StickyFilterBar mobile behavior** — must collapse or wrap on mobile, not horizontal scroll:
   - Verify search input full width on mobile (`flex-1`)
   - Verify filters wrap to second row or drawer on narrow screens

4. **No hover-dependent primary actions** — hover tooltips OK, but click/tap must work standalone

5. **Forms** — stacked labels on mobile (`block`), large inputs (`py-3` minimum), no multi-column on narrow screens (`md:grid-cols-2`)

### Reference implementation

See `app/admin/inventory/items/components/ItemsClient.tsx`:
- Lines 87-156: Desktop table (`hidden md:block`)
- Lines 158-220: Mobile card layout (`md:hidden flex flex-col`)

Use this as template for other pages.

### Verification per page

Before marking page done:
- Open Chrome DevTools → Toggle device toolbar
- Test 375px width (iPhone SE) and 768px width (iPad mini)
- Verify:
  - No horizontal overflow
  - All interactive elements ≥ 44px tall
  - Text readable without zoom
  - Filter bar wraps or collapses correctly
  - Empty state renders correctly in card layout

## Files

Antigravity owns: `app/**/*.tsx`, `components/**/*.tsx`. Do NOT touch `lib/`, `supabase/`, `scripts/`.

## Out of scope (do NOT touch)

- **`/admin/products/modifiers/*`** — Codex E1 recently touched this area (commit b6ffd73). Avoid conflict.
- `app/admin/layout.tsx` — already done in U1
- `app/admin/audit/backdated-ledger/*` — already done in Task 3.2 Phase C
- `components/ui/*` shared components themselves (use as-is, don't modify)
- Server actions (`actions.ts`) business logic — only UI layer
- `lib/` files
- `supabase/` migrations
- `scripts/`

## Batches

Work through batches sequentially. Commit per batch.

### Batch 1R: Mobile-first retrofit for Batch 1 (NEW — required before Batch 2)

**Context:** Batch 1 (commit `3882798`) applied shared components but did NOT verify mobile-first consistently. Audit found:
- `ItemsClient.tsx`: ✅ mobile-first (mobile card layout + desktop table)
- `SuppliersClient.tsx`: ❌ desktop-only (table always shown, no mobile card layout)

Suspected similar inconsistency in: `BaseIngredientsClient`, `ConversionsClient`, `BrandsClient`, `categories`, `units`.

**Task:** Verify all 7 Batch 1 pages have mobile-first pattern per spec above. Add mobile card layout where missing.

Pages to verify + fix:
- `/admin/brands`
- `/admin/suppliers` (confirmed missing)
- `/admin/inventory/categories`
- `/admin/inventory/base-ingredients`
- `/admin/inventory/conversions`
- `/admin/inventory/units`
- (`/admin/inventory/items` — reference impl, no changes needed)

Reference: `ItemsClient.tsx` lines 87-220.

**Verification:**
- Open each page in DevTools mobile (375px)
- Confirm card layout shows on mobile, table on desktop
- Touch targets ≥ 44px
- No horizontal overflow

**Commit:** `Antigravity fix: Batch 1 mobile-first retrofit (Task U2 Batch 1R)`

**Pause after this commit** — Claude reviews mobile-first retrofit → signal Batch 2.

### Batch 2: Inventory ops pages (Nhập hàng & Tồn kho)

### Batch 2: Inventory ops pages (Nhập hàng & Tồn kho)

- `/admin/inventory/purchase-orders`
- `/admin/inventory/stock-adjustments`
- `/admin/inventory/sync`
- `/admin/audit/backdated-ledger` (verify already meets standard, no changes if so)

Same pattern as Batch 1.

**Commit:** `Antigravity feat: UI sweep batch 2 - inventory ops pages`

### Batch 3: Production + Menu pages

- `/admin/semi-products`
- `/admin/production`
- `/admin/products/categories`
- `/admin/products`
- `/admin/products/toppings`
- `/admin/products/cogs-estimate`
- (skip `/admin/products/modifiers` — Codex area)

**Commit:** `Antigravity feat: UI sweep batch 3 - production + menu pages`

### Batch 4: Sales + Reports pages

- `/admin/orders` — **PRIORITY: remove native alert() calls**
- `/admin/promotions`
- `/admin/reports/pnl`
- `/admin/reports/stock`
- (`/admin/reports/sales` already has loading.tsx — verify others match)

For `/admin/orders`: search for `alert(` calls and replace with inline alert component or toast.

**Commit:** `Antigravity feat: UI sweep batch 4 - sales + reports pages (remove native alert)`

### Batch 5: System pages

- `/admin/users`
- `/admin/activity-log`
- `/admin/backup`
- `/admin/clear-cache`

**Commit:** `Antigravity feat: UI sweep batch 5 - system pages`

### Batch 6: Color palette standardization (optional, time-permitting)

Run global find-replace for color standardization:
- `green-500` / `green-600` → `emerald-500` / `emerald-600` (success)
- `red-500` / `red-600` → `rose-500` / `rose-600` (error) — BUT not `bg-red-50 border-red-200` (some existing alerts)
- `yellow-500` / `orange-500` → `amber-500` (warning)

Verify visual parity in browser before committing.

**Commit:** `Antigravity chore: standardize semantic colors (emerald/rose/amber)`

## Verification per batch

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → all tests pass (baseline 335+)
- Manual Playwright spot-check on 2-3 pages per batch:
  - Page loads without errors
  - PageHeader visible
  - Empty state renders (when applicable)
  - Loading skeleton shows on slow network (DevTools throttle)
  - No visual regression on adjacent pages

## Commit protocol

- **One commit per batch** (5-6 commits total)
- Pause after each batch — Claude reviews → next batch
- If batch fails review: revert that batch only, others stay
- Do NOT push (Claude pushes when ready)

## If blocker encountered

Likely blockers:
- Page has unusual structure that doesn't fit shared components: pause, ask Claude. May need new shared component variant.
- Form error states tied to validation library (zod, react-hook-form): do not refactor validation logic, only style.
- Native `alert()` in /admin/orders tied to complex state: replace with toast library if exists, else inline alert.
- Color change breaks existing contrast / a11y: revert that change, document.

Document with `WIP - blocked:` prefix and pause.

## Coordination

- U2 runs **in parallel with Codex work** if any (different file scopes)
- Codex E1 already done (commit b6ffd73)
- Other pending engine tasks (E2, E3) are blocked or backlog — won't conflict with U2
- After U2 complete, ROADMAP P1 empty → next priority is E2 (Task 3.3 investigation) for Codex

## Out of scope (do NOT do)

- Do NOT redesign layouts (just apply shared components)
- Do NOT add new pages or routes
- Do NOT change route paths
- Do NOT modify server-side data fetching logic
- Do NOT touch auth/session logic
- Do NOT introduce new dependencies (toast lib, etc.) without Claude approval
- Do NOT skip Pause-after-batch protocol
