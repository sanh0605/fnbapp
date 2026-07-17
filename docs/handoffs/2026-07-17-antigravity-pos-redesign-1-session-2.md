# Task: POS-REDESIGN-1 Session 2 — Layout Overhaul (Mobile-First)

## Context

Session 1 done (commit `a3682db`): leaf components redesigned (ProductCard, CartItemRow, DiscountBadge) per Option A (Modern minimal soft) direction.

Session 2: layout overhaul. ProductGrid + CartPanel + category bar + search. **Mobile-first primary**.

User decision: continue Session 2 without visual smoke test of Session 1 (aggressive pace). Trust Session 1 work + verify Session 2 holistically at end.

## Goal

Redesign 4 layout components per Option A direction, mobile-first:

1. **ProductGrid**: responsive grid (mobile 2 cols → desktop 4-5 cols), generous spacing
2. **CartPanel**: mobile bottom-sheet (collapsible) + desktop side panel (right)
3. **Category bar**: mobile horizontal scroll + desktop centered tabs, larger touch targets
4. **Search input**: prominent top-of-page, mobile-friendly

Preserve all existing behavior (filter, search, add to cart, checkout flow).

## Components to redesign

### 1. `components/pos/ProductGrid.tsx`

**Mobile-first target:**
- Container: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4`
- Mobile default: 2 columns (cards fit well at 375px / 2 = ~180px each)
- Spacing: `gap-3` mobile, `gap-4` desktop
- Optional section headers per category: `text-base font-semibold text-text-primary mt-4 mb-2 first:mt-0` (category name as separator)
- Loading state: skeleton grid (use existing Skeleton component)
- Empty state: EmptyState component with friendly message

### 2. `components/pos/CartPanel.tsx`

**Mobile (375px) — bottom-sheet style:**
- Default: collapsed bar at bottom showing total + "Thanh toán" button
- Tap to expand → full bottom-sheet with items list
- Sheet styling: `fixed bottom-0 left-0 right-0 bg-surface-card rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] max-h-[80vh] overflow-y-auto`
- Drag handle bar at top: `w-12 h-1 bg-border rounded-full mx-auto mt-2 mb-3`
- Total prominent: `text-2xl font-bold text-text-primary`
- "Thanh toán" button: full width, `bg-primary text-white py-4 rounded-2xl font-bold text-base min-h-[52px]`
- Items list: CartItemRow components stacked vertically

**Desktop (md+) — side panel right:**
- Container: `md:sticky md:top-4 md:bg-surface-card md:rounded-2xl md:shadow-[0_2px_8px_rgba(0,0,0,0.04)] md:border md:border-border md:p-4`
- Width: `md:w-80 lg:w-96` (fixed right column)
- Header: "Giỏ hàng" + item count
- Items list: scrollable, `md:max-h-[60vh] overflow-y-auto`
- Total + checkout button at bottom

### 3. Category bar

**Mobile (375px) — horizontal scroll:**
- Container: `flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0` (full-bleed on mobile, normal desktop)
- Hide scrollbar: `[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`
- Each category pill: `shrink-0 px-4 py-2 rounded-full bg-surface-secondary text-text-secondary text-sm font-medium whitespace-nowrap active:bg-border`
- Active state: `bg-primary text-white`
- Touch targets: py-2 = ~36px height + padding → bump to `min-h-[40px]` for easier touch

**Desktop (md+):**
- Same pill style, but `flex-wrap` instead of horizontal scroll (wrap to multiple lines)
- OR: keep horizontal scroll if many categories
- Active state slightly larger: `md:text-base md:px-5 md:py-2.5`

### 4. Search input

**Mobile-first:**
- Container: `relative mb-3`
- Input: `w-full bg-surface-secondary border border-border rounded-2xl pl-12 pr-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent`
- Search icon (lucide-react `Search`): `absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted`
- Min height: `min-h-[48px]` (comfortable touch target)
- Clear button (X) when text: `absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-card text-text-muted active:bg-border flex items-center justify-center`

## Scope

### In scope

1. Redesign 4 layout components per specs above.
2. Verify `/pos` end-to-end at mobile 375px + desktop 1280px.
3. Preserve all behavior: search filter, category filter, add-to-cart, quantity change, remove, checkout.
4. CartPanel mobile bottom-sheet: needs `useState` for expand/collapse + tap outside to close + drag handle visual.

### Out of scope

- Do NOT touch Session 1 leaf components (ProductCard, CartItemRow, DiscountBadge) — already done.
- Do NOT change `POSScreen.tsx` main container (only update if layout structure requires).
- Do NOT change checkout flow logic.
- Do NOT migrate other pages.
- Do NOT push to remote.

## Constraints

- **⚠️ MOBILE-FIRST PRIMARY**: 375px design target. Use `md:` for desktop.
- **Touch targets ≥44px** all interactive elements.
- **Behavior preservation**: every onClick, onChange, prop signature MUST work identically.
- **Existing tokens only**: `bg-surface-card`, `text-text-primary`, `bg-primary`, `bg-surface-secondary`, `border-border`, `rounded-2xl`, etc.
- **Soft shadow**: `shadow-[0_2px_8px_rgba(0,0,0,0.04)]` default, `shadow-[0_8px_24px_rgba(0,0,0,0.08)]` hover.
- **Transitions**: `transition-all duration-200`.
- **CartPanel mobile**: ensure bottom-sheet doesn't break checkout button tap (z-index, viewport).
- **Sticky behavior desktop**: `md:sticky md:top-4` for cart panel.

## Reusable existing code

- `components/ui/Skeleton.tsx` — loading state
- `components/ui/EmptyState.tsx` — empty state
- `lucide-react` — Search icon
- Session 1 leaf components (already redesigned)

## Verification

1. `tsc --noEmit`: 0 errors.
2. `vitest run`: 403/403 baseline pass.
3. `npm run build`: success.
4. **Visual smoke `/pos`**:
   - Mobile 375px: 2-col product grid, horizontal scroll categories, prominent search, bottom-sheet cart
   - Desktop 1280px: 4-5 col grid, centered categories, search top, side cart panel right
   - Cart expand/collapse works on mobile (tap to expand, tap outside / drag handle to collapse)
   - All filter/search/add-to-cart/checkout flows work
5. **Touch targets**: verify all buttons ≥44px on mobile.
6. `git diff --check`: clean.

## Expected output

- `components/pos/ProductGrid.tsx` (modify).
- `components/pos/CartPanel.tsx` (modify — biggest change, mobile bottom-sheet).
- Category bar component (verify file — possibly in `POSScreen.tsx` or separate).
- Search input (verify file — possibly in `POSScreen.tsx` or separate).
- Commit: `Antigravity ui: POS redesign Session 2 - layout overhaul (mobile-first)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P2 → P1 promotion. Antigravity. ~2 sessions (~4-6h total).

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.1 Pro (Medium)` — design-heavy layout work with mobile bottom-sheet pattern (more complex than Session 1 leaf components).

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Category bar / search are NOT in `POSScreen.tsx` (would need to locate them first).
- Mobile bottom-sheet conflicts with existing state management (would need architecture decision).
- CartPanel layout requires changing parent (`POSScreen.tsx`) structure significantly.
- Mobile layout breaks at 375px (cards too narrow, bottom-sheet covers content).
- Behavior change would result from layout change.

## Questions before starting

- CartPanel mobile bottom-sheet: should it auto-open when item added (first time), or always require tap? Recommend auto-open on first item add, then user can collapse.
- Search clear (X) button: only show when text present? Recommend YES.
- Category bar wrap on desktop: switch to wrap, or keep horizontal scroll? Recommend WRAP on desktop (cleaner), scroll on mobile.
- CartPanel desktop sticky: top-4 offset OK, or align with content? Recommend top-4 (matches content padding).
