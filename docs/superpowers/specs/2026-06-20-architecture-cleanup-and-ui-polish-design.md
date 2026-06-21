# Architecture Cleanup + UI/UX Polish Design Spec

**Date:** 2026-06-20
**Status:** Draft — awaiting user approval
**Approach:** Level 2 (Big spec → user review → local execution → user approves commit)

---

## Executive Summary

After 2 days rebuilding Orders & Reports (WS-1 through WS-11), the codebase accumulated:
- 7 V1 files in `_legacy/` no longer used by production code
- 79 one-off audit scripts in `scratch/`
- 98 total scripts (many one-off)
- 1 orphan duplicate component (`app/admin/promotions/components/PromotionForm.tsx`)
- 16 `app/actions/*` files inconsistent with new `app/admin/*/actions.ts` pattern
- 3 files >500 lines (POSScreen 1017, OrderEditModal 628, InventoryForms 604)
- 0 responsive classes in admin pages (mobile broken)

This spec proposes 5 workstreams executed sequentially, all local-only until user approves commit.

---

## Architecture Decisions (apply to all WS)

### Decision 1: Keep Next.js App Router conventions
- Server actions live co-located with their feature (`app/admin/<feature>/actions.ts`)
- Shared actions without feature affinity stay in `app/actions/` (auth, reports-v2)
- Pages are server components, forms/tables are client components

### Decision 2: Mobile-first responsive strategy
- Start with mobile layout, layer desktop via `md:`/`lg:` prefixes
- Tables → card list on mobile (`block md:table` pattern)
- Forms → single column mobile, 2-col desktop
- POS → already partially responsive, will verify and complete

### Decision 3: Component size cap
- Soft cap: 300 lines per `.tsx` file
- Above 500 lines → must split before adding features
- Pure business logic extracted to `lib/` (testable, no JSX)

### Decision 4: Modal rendering via React Portals
- All modals use `createPortal(modalContent, document.body)`
- Wrap in shared `<ModalPortal>` component for consistency
- Eliminates the `backdrop-filter` containing-block bug permanently

---

## WS-1: File Cleanup

### Goal
Remove dead code + scratch files + generated output. Reduce noise for subsequent WS.

### Files to DELETE (verified safe)

#### 1.1 `_legacy/` folder (7 files)
- `_legacy/app-actions/index.ts`
- `_legacy/app-actions/order-edit.ts`
- `_legacy/app-actions/orders.ts`
- `_legacy/app-actions/pos.ts`
- `_legacy/app-actions/reports.ts`
- `_legacy/lib/report-utils.ts`
- `_legacy/README.md`

**Safety check:** No production code imports from `_legacy/`. Only 2 audit scripts use `_legacy/lib/report-utils.ts` — those scripts also get deleted (see 1.4).

#### 1.2 `scratch/` folder (79 files, 436KB)
All standalone one-off audit scripts. No imports from main app code. Sample:
- `audit-cogs.js`, `audit-db.ts`, `audit-order.ts`, `audit-sua-dau.ts`...
- `calculate-historical-non-inventory-cogs.js`
- `check-btp4.js`, `check-conversions.js`
- ... 79 total

**Safety check:** `grep -r "from '@/..." scratch/` returns empty.

#### 1.3 `scripts/output/` folder (11 generated files)
- `classification.json`, `classification-summary.json`
- `combo-audit.md`, `combo-root-cause.md`
- `knowledge-graph.json`
- `phase3-briefing.md`, `phase-e-final-report.md`
- `promo-id-drift.json`
- `reaudit-report.md`
- `subtotal-root-cause.md`
- `viewer.html`

These are script outputs. Add `scripts/output/` to `.gitignore` so future script runs don't dirty git.

#### 1.4 2 scripts that reference `_legacy/`
- `scripts/audit-line-and-order-discount-combo.ts` → uses `_legacy/lib/report-utils`
- `scripts/audit-revenue-summary.ts` → uses `_legacy/lib/report-utils`

**Decision:** Delete both. They were one-off audits during WS-7. Their function is replaced by `lib/report-v2-allocators.ts` + `lib/report-utils.ts` (V2 version) which are still in `lib/`.

#### 1.5 Orphan duplicate component
- `app/admin/promotions/components/PromotionForm.tsx` (479 lines, UNUSED)

**Verified:** `grep -rE "promotions/components/PromotionForm"` returns empty. Production uses `@/components/PromotionForm` instead.

#### 1.6 Root-level scratch JSON files
- `audit-anomalies.json`
- `audit-summary.json`
- `fix-report.json`
- `migration-report.json`

All one-off migration outputs from WS-5/WS-7. Safe to delete.

#### 1.7 `.playwright-mcp/` folder
Test cache from Playwright MCP browser sessions. Add to `.gitignore`.

### .gitignore additions
```
# Diagnostic/test scratch (WS-1 cleanup)
scripts/output/
scratch/
.playwright-mcp/
*.migration-report.json
*.audit-report.json
```

### Stop conditions for WS-1
- If any deleted file is imported by something we missed → stop, restore from git
- Build fails after deletion → stop, investigate
- Tests fail → stop

### Verification
- `npm run build` succeeds
- `npm test` passes (121 tests)
- App runs on dev server, all major pages load

### Expected outcome
- ~90 files deleted
- Repo size reduced ~500KB+
- Cleaner foundation for WS-2 through WS-5

---

## WS-2: Finish `app/actions/*` Migration

### Goal
Move remaining 16 action files to per-feature folders for consistency with Antigravity's refactoring pattern.

### Current state (16 files in `app/actions/`)
| File | Used by | Decision |
|---|---|---|
| `auth.ts` | Change password flow | KEEP in `app/actions/` (cross-feature) |
| `inventory.ts` | 3 callers | MOVE to `app/admin/inventory/actions.ts` |
| `modifiers.ts` | 1 caller | MOVE to `app/admin/products/modifiers/actions.ts` |
| `order-edit-v2.ts` | 1 caller (orders edit) | MOVE to `app/admin/orders/actions/edit.ts` |
| `orders-v2.ts` | 5 callers | MOVE to `app/admin/orders/actions/queries.ts` |
| `pos-v2.ts` | 1 caller (POSScreen) | MOVE to `app/pos/actions.ts` (new file location) |
| `production.ts` | 1 caller | MOVE to `app/admin/production/actions.ts` (already exists, may merge) |
| `products.ts` | 2 callers | MOVE to `app/admin/products/actions.ts` (new) |
| `promotions.ts` | 2 callers | MOVE to `app/admin/promotions/actions.ts` (already exists, may merge) |
| `purchase-orders.ts` | 1 caller | MOVE to `app/admin/inventory/purchase-orders/actions.ts` (already exists, may merge) |
| `recipes.ts` | 1 caller | MOVE to `app/admin/inventory/recipes/actions.ts` OR `lib/recipes.ts` |
| `reports-v2.ts` | 2 callers | KEEP in `app/actions/` (cross-feature) |
| `reports-v2.test.ts` | Test | KEEP with `reports-v2.ts` |
| `stock.ts` | 2 callers | MOVE to `app/admin/inventory/actions.ts` (merge with inventory) |
| `suppliers.ts` | 1 caller | MOVE to `app/admin/suppliers/actions.ts` (already exists, may merge) |
| `users.ts` | 2 callers | MOVE to `app/admin/users/actions.ts` (already exists, may merge) |

### Migration pattern (per file)
1. Read existing `app/admin/<feature>/actions.ts` if exists
2. Merge contents (no duplicate exports)
3. Update all import paths
4. Delete original from `app/actions/`
5. Run tests + build

### Stop conditions
- Import cycle detected → stop
- Duplicate export name conflict → stop, ask user
- Test fails → stop

### Verification
- All 121 tests pass
- `npx tsc --noEmit` clean
- `npm run build` succeeds

---

## WS-3: Split Big Files

### Goal
Reduce cognitive load per file. Each file ≤300 lines (soft cap).

### Files to split

#### 3.1 `components/POSScreen.tsx` (1017 lines)
Split into:
- `components/pos/POSScreen.tsx` (orchestrator, <200 lines)
- `components/pos/ProductGrid.tsx` (product cards + category tabs)
- `components/pos/CartPanel.tsx` (cart items, discount display)
- `components/pos/CartSummary.tsx` (totals, payment button)
- `components/pos/DiscountBadges.tsx` (3-color discount badges, reusable)
- `components/pos/CheckoutModal.tsx` (already separate? check)

#### 3.2 `app/admin/orders/OrderEditModal.tsx` (628 lines)
Split into:
- `app/admin/orders/edit/OrderEditModal.tsx` (orchestrator)
- `app/admin/orders/edit/LineItemEditor.tsx` (per-line edit)
- `app/admin/orders/edit/DiscountEditor.tsx` (3 discount types editor)
- `app/admin/orders/edit/ReasonInput.tsx` (reason field)

#### 3.3 `components/InventoryForms.tsx` (604 lines)
Already a multi-form aggregator. Split per form:
- `components/inventory/BaseIngredientForm.tsx`
- `components/inventory/PurchasedItemForm.tsx`
- `components/inventory/ConversionForm.tsx`
- `components/inventory/UnitForm.tsx`
- `components/inventory/CategoryForm.tsx`
- `components/inventory/index.ts` (re-export for backward compat)

### Stop conditions
- Component prop interface changes break callers → stop, fix
- Hooks state sharing requires refactor → stop, ask user
- Test fails → stop

### Verification
- All tests pass
- Build succeeds
- UI smoke test on dev server (admin orders edit, inventory forms, POS)

---

## WS-4: UI/UX Polish (Antigravity's plan, audited)

### Audit of Antigravity's plan

#### 4.1 Modal Overlay Fix (Section 1 of plan)
**Verdict: APPROVE as-is.**

Root cause correct: `StickyFilterBar` uses `backdrop-filter` which creates a containing block, trapping `position: fixed` modals.

Solution: React Portals (`createPortal`) renders modals to `document.body`, escaping any ancestor containing block.

**Implementation refinement:**
Create `components/ui/ModalPortal.tsx`:
```tsx
"use client";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // SSR safety
  return createPortal(children, document.body);
}
```

Apply to: `SupplierForm`, `BaseIngredientForm`, `ItemForm`, `PromotionForm`, `UserForm`, `BrandForm`, any component rendering a modal.

#### 4.2 POS Dark Mode Redesign (Section 2 of plan)
**Verdict: APPROVE with modifications.**

The mockup is visually strong but has issues:

**Issue 1: Fixed width `w-[450px]` for cart breaks mobile.**
- Fix: `w-full md:w-[450px]` + slide-in drawer on mobile
- Mobile cart becomes toggleable (matches existing `isCartOpen` state)

**Issue 2: No keyboard nav for product grid.**
- Add: arrow keys navigate, Enter adds to cart
- Add: search bar for product name

**Issue 3: Discount color tokens not in shared file.**
- Create `lib/discount-tokens.ts` exporting color classes
- Import in `DiscountBadges.tsx` and `CartSummary.tsx`

**Data model alignment check:**
| UI Element | Data Field (OrderLineV2) | OK? |
|---|---|---|
| Cyan badge "Hệ thống: -10.000đ" | `promo_discount` | ✅ |
| Orange badge "Thu ngân: -5.000đ" | `manual_item_discount` | ✅ |
| Rose row "Giảm giá toàn bill" | `order_discount_allocation` (per-line) / `manual_order_discount` (order total) | ✅ |
| Total | `net_line_total` sum = `net_total` | ✅ |
| Product name | `product_snapshot_json.name` | ✅ |
| Variant size | `variant_snapshot_json.size_name` | ✅ |
| Modifier display | `modifiers_snapshot_json` | ✅ |

All V2 data model fields match UI mockup. No data model changes needed.

#### 4.3 Implementation order for WS-4
1. Create `components/ui/ModalPortal.tsx`
2. Apply ModalPortal to all form modals (8-10 files)
3. Verify modal overlay bug is gone (test on Suppliers/Inventory)
4. Create `lib/discount-tokens.ts`
5. Split POSScreen (depends on WS-3 completion)
6. Redesign POS per mockup with responsive modifications
7. Smoke test POS on mobile + desktop

### Stop conditions
- SSR hydration errors from `createPortal` → use dynamic import with `ssr: false`
- Discount color contrast fails WCAG AA → adjust opacity
- POS refactor breaks cart state → stop, revert

### Verification
- Manual test all modal forms open/close correctly
- POS UI matches mockup on desktop
- POS works on mobile viewport (375px width)
- All tests pass
- Build succeeds

---

## WS-5: Responsive Design

### Goal
All admin pages work smoothly on mobile (375px+) AND desktop (1280px+).

### Strategy: Mobile-first retrofit

**Tier 1 (Critical — staff uses these on mobile):**
- `/admin/orders` + OrderTable
- `/admin/orders` edit modal
- `/admin/reports/pnl`, `/sales`, `/stock`
- `/pos` (already partially responsive, complete it)
- Admin layout (sidebar already mobile-aware)

**Tier 2 (Important — manager uses occasionally):**
- `/admin/products` + categories + modifiers
- `/admin/inventory/items` + base-ingredients + conversions + units
- `/admin/promotions`
- `/admin/users`

**Tier 3 (Low — owner uses on desktop mostly):**
- `/admin/brands`
- `/admin/suppliers`
- `/admin/semi-products`
- `/admin/production`
- `/admin/inventory/purchase-orders`

### Patterns to apply

#### Pattern 1: Tables → Cards on mobile
```tsx
{/* Mobile: cards */}
<div className="md:hidden space-y-3">
  {items.map(item => <MobileCard key={item.id} item={item} />)}
</div>

{/* Desktop: table */}
<div className="hidden md:block">
  <table>...</table>
</div>
```

#### Pattern 2: Filter bar horizontal scroll on mobile
StickyFilterBar already exists; add `overflow-x-auto` + `flex-nowrap` for mobile.

#### Pattern 3: Forms single-column mobile, 2-col desktop
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Field label="Tên" />
  <Field label="Giá" />
</div>
```

#### Pattern 4: Modal full-screen mobile, centered desktop
```tsx
<div className="fixed inset-0 md:inset-auto md:relative
                bg-white md:rounded-2xl md:max-w-lg
                w-full h-full md:h-auto">
```

### Per-page action list

| Page | Action |
|---|---|
| Admin layout | Already mobile-aware, minor polish |
| `/admin/orders` OrderTable | Add mobile card view, keep desktop table |
| OrderEditModal | Mobile: full-screen modal, stacked fields |
| `/admin/reports/*` | Cards stack vertically on mobile, charts resize |
| `/admin/products` | Grid cols 1→2→3→4 responsive |
| `/admin/inventory/*` | Tables get card variant on mobile |
| `/admin/promotions` | Table + form responsive |
| `/admin/users` | Table + form responsive |
| `/pos` | Already drawer-based on mobile, verify and polish |
| All Form modals | Mobile full-screen, desktop centered |

### Stop conditions
- Layout shifts horizontally on mobile → use `overflow-x-hidden`
- Touch target too small (<44px) → increase
- Text overflow → use `truncate` or `whitespace-normal`

### Verification
- Chrome DevTools mobile viewports: 375px (iPhone), 768px (tablet)
- Test POS, orders, reports on actual mobile device if possible
- All tests pass
- Build succeeds

---

## Safety Rails (apply to all WS)

### Hard stops (always stop and ask user)
1. Any test fails that I cannot fix in <5 minutes
2. Build fails (TypeScript or webpack error)
3. Assumption in this spec is invalidated by code reality
4. Discover a feature that's broken which user didn't mention
5. Cumulative diff exceeds 200 files (sanity check)

### Soft stops (note in summary, continue)
1. A file's pattern is unique (no other file does it this way) → note for review
2. A test is flaky → note but don't block
3. A naming convention is inconsistent → note in summary

### Per-WS checklist
- [ ] Code changes complete
- [ ] `npm test` passes (all 121+ tests)
- [ ] `npx tsc --noEmit` clean for changed files
- [ ] `npm run build` succeeds
- [ ] Dev server smoke test (page loads)
- [ ] Summary written (files changed, lines +/-, any issues)

---

## Out of Scope (explicit non-goals)

These will NOT be touched:

1. **Business logic changes** — no changes to order math, COGS FIFO, discount allocation
2. **Data model changes** — V2 schema stays as-is
3. **Migration scripts** — already done, leave alone
4. **Google Sheets schema** — no new columns/sheets
5. **Authentication** — auth.ts stays
6. **POS cart logic** — only UI/UX, not the math
7. **Reports calculation** — only responsive UI, not formulas
8. **Adding new features** — pure refactoring + polish only

---

## Final Deliverables

After all 5 WS complete:

1. **Cleaner codebase:** ~90 fewer files, consistent structure
2. **Mobile-friendly:** all admin pages work on 375px+
3. **Modern POS UI:** Premium dark mode, 3-color discount display, responsive
4. **No modal bugs:** React Portals everywhere
5. **No big files:** all <500 lines (mostly <300)
6. **Tests still pass:** 121+ tests green
7. **Build still works:** Vercel deploy will succeed (when user pushes)

---

## Open Questions (need user input before execution)

### Q1: WS-1 — Delete `scripts/output/` files or gitignore only?
**Recommendation:** Delete existing files + gitignore folder. Scripts regenerate when run.

### Q2: WS-2 — Keep `auth.ts` and `reports-v2.ts` in `app/actions/` or move?
**Recommendation:** Keep `auth.ts` (cross-feature auth utility). Move `reports-v2.ts` to `app/admin/reports/actions.ts` (feature-specific).

### Q3: WS-3 — When splitting POSScreen, what naming convention?
**Recommendation:** `components/pos/` subfolder with PascalCase filenames.

### Q4: WS-4 — Apply ModalPortal to ALL modals or just the broken ones?
**Recommendation:** All modals (consistency, prevent future bugs).

### Q5: WS-5 — Mobile priority is iPhone 375px or smaller Android 360px?
**Recommendation:** Target 360px minimum (covers 99% of staff phones).

---

## Execution Plan Summary

```
Day 1 (WS-1 + WS-2):
  - Delete ~90 files
  - Migrate 14 action files
  - Tests + build verify
  - Report to user

Day 2 (WS-3):
  - Split 3 big files into ~15 smaller files
  - Tests + build verify
  - UI smoke test
  - Report to user

Day 3-4 (WS-4):
  - ModalPortal utility
  - Apply to ~10 form modals
  - POS dark mode redesign
  - Smoke test mobile + desktop
  - Report to user

Day 5 (WS-5):
  - Responsive retrofit per page
  - Mobile viewport testing
  - Final report

After all WS:
  - User reviews entire diff
  - User runs `npm run dev` and tests
  - User says "commit and push" → Claude commits per WS + pushes
  - Vercel auto-deploys
```

---

## Awaiting User Approval

User, please review this spec. Specifically:

1. **Architecture decisions 1-4** — agree?
2. **WS-1 file deletions** — anything to keep?
3. **WS-2 migration table** — any file should stay where it is?
4. **WS-3 split strategy** — naming convention OK?
5. **WS-4 POS mockup modifications** — approve responsive additions?
6. **WS-5 page priority tiers** — staff uses which pages on mobile most?
7. **Open questions Q1-Q5** — answer each?

Once approved, I will execute WS-1 → WS-5 sequentially in LOCAL ONLY mode, stopping at any hard-stop condition. No commits until you say "commit and push".
