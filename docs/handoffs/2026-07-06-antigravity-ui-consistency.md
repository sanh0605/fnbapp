# Antigravity Prompt — UI consistency audit + fixes

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Priority: 5 (per roadmap)
Estimated effort: ~4-6 hours (large audit + fixes)

## Goal

Audit the admin UI for visual + interaction consistency. Identify and fix discrepancies in:
1. Loading states (skeleton vs spinner vs blank)
2. Empty states (placeholder text, CTA buttons)
3. Error states (inline error, modal, toast)
4. Page header layout (title + actions placement)
5. Table header + row spacing
6. Form footer button placement
7. Color semantic usage (success/error/warning/info)
8. Mobile responsive gaps

This is the largest task. Recommend: do AUDIT first (no code changes), present findings doc, get user sign-off on which fixes to apply, then implement.

## Phase A: Audit (1-2 hours) — DO FIRST

Read all major admin pages and document findings in `docs/audits/2026-07-06-ui-consistency-audit.md`.

### Audit checklist per page

For each of these pages, document:
- Loading state behavior (initial load, refetch, mutation)
- Empty state behavior (no data)
- Error state behavior (fetch fail, mutation fail)
- Page header structure (title, subtitle, actions placement)
- Table/list layout (header style, row hover, spacing)
- Mobile breakpoint behavior (< 768px)
- Color/typography consistency with system

### Pages to audit

```
app/admin/page.tsx (dashboard)
app/admin/brands/page.tsx
app/admin/suppliers/page.tsx
app/admin/inventory/items/page.tsx
app/admin/inventory/purchase-orders/page.tsx
app/admin/inventory/stock-adjustments/page.tsx
app/admin/inventory/conversions/page.tsx
app/admin/inventory/sync/page.tsx
app/admin/inventory/units/page.tsx
app/admin/inventory/categories/page.tsx
app/admin/inventory/base-ingredients/page.tsx
app/admin/semi-products/page.tsx
app/admin/production/page.tsx
app/admin/products/page.tsx
app/admin/products/categories/page.tsx
app/admin/products/modifiers/page.tsx
app/admin/products/toppings/page.tsx
app/admin/products/cogs-estimate/page.tsx
app/admin/orders/page.tsx
app/admin/promotions/page.tsx
app/admin/reports/sales/page.tsx
app/admin/reports/pnl/page.tsx
app/admin/reports/stock/page.tsx
app/admin/users/page.tsx
app/admin/users/edit/[id]/page.tsx
app/admin/activity-log/page.tsx
app/admin/backup/page.tsx
app/admin/clear-cache/page.tsx
```

### Findings to look for

1. **Loading states**:
   - Some pages show blank during fetch (bad)
   - Some show spinner (OK)
   - Some show skeleton (best)
   - Document which pattern each page uses

2. **Empty states**:
   - "No data" / "Không có dữ liệu" / "Chưa có đơn hàng" / blank — which?
   - Is there a CTA to create first item?
   - Is the message friendly or technical?

3. **Error states**:
   - Inline error? Modal? Toast? Silent fail?
   - Error message tone (technical vs user-friendly)

4. **Page headers**:
   - Some pages: title + subtitle + action button in same row
   - Some: title alone, action button below
   - Some: title + filter bar
   - Standardize to ONE pattern

5. **Tables**:
   - Header background (gray-50 vs gray-100 vs white)
   - Header text size + weight
   - Row hover (bg-blue-50/40 vs bg-gray-50 vs none)
   - Row spacing (py-2 vs py-3 vs py-4)

6. **Form footers**:
   - Cancel + Save order
   - Save + Cancel order
   - Button position (right-aligned, centered, sticky bottom)

7. **Colors**:
   - Success: green-500 vs green-600 vs emerald-500
   - Error: red-500 vs red-600 vs rose-500
   - Warning: amber-500 vs yellow-500
   - Info: blue-500 vs indigo-500

8. **Mobile (< 768px)**:
   - Tables scroll horizontally? Cards stack?
   - Filter bars wrap or scroll?
   - Form modals full-screen?

## Phase B: Document findings

Write `docs/audits/2026-07-06-ui-consistency-audit.md` with:

```markdown
# UI Consistency Audit Findings

Date: 2026-07-06

## Summary

- Pages audited: 28
- Loading states: __ pages blank, __ spinner, __ skeleton
- Empty states: __ inconsistent patterns found
- ... etc.

## Per-pattern findings

### Loading states

| Page | Current | Recommended | Priority |
|---|---|---|---|
| /admin/dashboard | spinner | skeleton | Medium |
| /admin/orders | spinner | skeleton | Low |
| ... | | | |

### Empty states

...

## Top 10 priority fixes

1. ...
2. ...
```

Commit this audit doc:
`Antigravity docs: UI consistency audit findings (28 pages)`

Then PAUSE and let user review findings + decide which fixes to apply.

## Phase C: Apply fixes (after user sign-off)

User will pick which findings to fix. Apply each fix in separate commits:

1. `Antigravity ui: standardize loading states to skeleton (X pages)`
2. `Antigravity ui: standardize empty states pattern (X pages)`
3. `Antigravity ui: standardize page header layout (X pages)`
4. ... (one commit per pattern fixed)

## Suggested standards (for user review)

These are INITIAL proposals. User decides.

### Loading state standard

Use skeleton for initial page load (3-5 placeholder blocks). Use spinner only for button-submit + overlay.

### Empty state standard

```tsx
<div className="text-center py-12 px-4">
  <div className="text-5xl mb-3 opacity-30">{icon}</div>
  <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
  <p className="text-sm text-gray-500 mb-4">{description}</p>
  {action && <button className="...">{action}</button>}
</div>
```

Example: `{ icon: "📋", title: "Chưa có đơn hàng", description: "Đơn hàng sẽ xuất hiện ở đây khi có khách đặt.", action: "Mở POS" }`

### Page header standard

```tsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
  {action && <div>{action}</div>}
</div>
```

### Table standard

- Header: `bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider px-4 py-3`
- Row: `hover:bg-blue-50/40 transition-colors`
- Cell: `px-4 py-3 text-sm text-gray-700`

### Color standard

- Success: `bg-emerald-50 text-emerald-700 border-emerald-200`
- Error: `bg-red-50 text-red-700 border-red-200`
- Warning: `bg-amber-50 text-amber-700 border-amber-200`
- Info: `bg-blue-50 text-blue-700 border-blue-200`

## Out of scope

- Do NOT redesign the UI (this is consistency, not redesign)
- Do NOT add new dependencies
- Do NOT change information architecture
- Do NOT touch POS UI (separate scope, different patterns)

## Commit strategy

- Phase A (audit): 1 commit (just doc)
- Phase C (fixes): 1 commit per pattern fixed (5-10 commits)

## Verification

Per fix commit:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual: visit each affected page, verify visual diff is intentional improvement
4. Mobile spot-check (DevTools device toolbar)

## Coordination note

This is the LARGEST task. Consider splitting across multiple sessions:
- Session 1: Audit + findings doc
- Session 2: Apply user-approved fixes

Don't try to do everything in one session — fatigue leads to mistakes.
