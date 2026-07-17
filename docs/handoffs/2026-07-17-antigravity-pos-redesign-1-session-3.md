# Task: POS-REDESIGN-1 Session 3 — Polish + Transitions + Final Mobile Verify

## Context

Session 1 (commit `a3682db`) + Session 2 (commit `c61f5a1`) done. POS leaf components + layout overhaul migrated to Option A (Modern minimal soft) direction, mobile-first.

Session 3: final polish pass. Micro-transitions, edge cases, final mobile verify. **No new features.**

User pace: aggressive (continuing without visual smoke between sessions). Trust accumulated work + verify holistically at end of Session 3.

## Goal

Polish POS UX per Option A direction. Add micro-transitions, verify edge cases, final mobile-first audit.

## Polish items

### 1. Micro-transitions

Add smooth transitions where missing:

- **ProductCard hover/click**: verify `transition-all duration-200` works. Hover scales 1.02, active scales 0.98. Add `will-change: transform` if janky.
- **CartItemRow add/remove**: when item added to cart, animate in (`animate-in fade-in slide-in-from-bottom-1 duration-200`). When removed, animate out (`animate-out fade-out duration-150`).
- **CartPanel bottom-sheet expand/collapse**: smooth slide up/down. Use `transition-transform duration-300 ease-out`. Verify backdrop fades in/out.
- **Category pill active state**: smooth color transition (`transition-colors duration-150`).
- **Search clear (X) button**: fade in/out when text present/empty.
- **Quantity change**: brief scale pulse on number (`active:scale-95`) when +/- tapped.

### 2. Mobile verify (375px)

Verify ALL of the following at 375px viewport:

- [ ] Product grid: 2 cols, no horizontal scroll
- [ ] Category bar: horizontal scroll smooth, no horizontal page scroll
- [ ] Search input: full width, ≥48px height, clear button tappable
- [ ] Cart bottom-sheet collapsed bar: visible at bottom, "Thanh toán" button ≥52px height
- [ ] Cart expanded: drag handle visible, items list scrollable, doesn't cover checkout button
- [ ] All touch targets ≥44px (verify with dev tools)
- [ ] No text overflow / truncation issues
- [ ] Tap response <100ms perceived

### 3. Desktop verify (1280px)

- [ ] Product grid: 4-5 cols, generous spacing
- [ ] Category bar: wraps or scrolls, no overflow
- [ ] Search: prominent top
- [ ] Cart side panel: sticky right column, doesn't overlap content
- [ ] Hover states subtle (not jarring)
- [ ] No layout shift on hover

### 4. Edge cases

- [ ] **Empty cart**: friendly empty state (`EmptyState` component with "Giỏ hàng trống" + hint)
- [ ] **Many items (10+)**: cart list scrolls smoothly, no perf issues
- [ ] **Search empty results**: "Không tìm thấy sản phẩm" message
- [ ] **All categories filter**: works identically to specific category
- [ ] **Promo applied**: visible state in cart (DiscountBadge shows)
- [ ] **Network offline indicator**: visible if `isOnline` prop exists
- [ ] **Checkout processing state**: button shows loading, disabled
- [ ] **Error state**: clear error message via Dialog API

### 5. Final cleanup

- Remove any dead code from old layout (unused imports, leftover classes)
- Verify no console warnings/errors in dev tools
- Verify no React key warnings
- Check accessibility: focus visible on all interactive elements (`focus-visible:ring-2 focus-visible:ring-focus-ring`)

## Scope

### In scope

1. Polish items 1-5 above.
2. Verify all touch targets, transitions, edge cases.
3. Minor cleanup (dead code, unused imports).
4. Final visual smoke at 375px + 1280px.

### Out of scope

- Do NOT redesign components structurally (Sessions 1+2 done).
- Do NOT change business logic.
- Do NOT add new features (offline mode, loyalty, etc.).
- Do NOT migrate other pages.
- Do NOT push to remote.

## Constraints

- **⚠️ MOBILE-FIRST PRIMARY**: 375px verified first.
- **Touch targets ≥44px** ALL interactive elements.
- **No new design tokens**: use existing.
- **No new dependencies**: existing Tailwind only.
- **Behavior 100% preserved**: only visual polish.
- **Atomic commit**: single commit for Session 3.

## Verification

1. `tsc --noEmit`: 0 errors.
2. `vitest run`: 403/403 baseline pass.
3. `npm run build`: success.
4. **Visual smoke `/pos`** at 375px AND 1280px:
   - All checklist items above pass
   - No layout regression vs Session 2
   - Transitions smooth (no jank)
5. **DevTools Console**: no warnings, no errors.
6. **DevTools Performance tab**: tap response <100ms.
7. `git diff --check`: clean.

## Expected output

- Modified files (whichever need polish — possibly all of POS components).
- Commit: `Antigravity ui: POS redesign Session 3 - polish + transitions (mobile-first final)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P2 → P1 promotion. Antigravity. ~1 session (~2h).

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (High)` — polish + verify work, mechanical + thorough.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Major regression found (something Session 2 did broke).
- Touch target violation can't be fixed without redesign.
- Performance issue (animations cause jank).
- Edge case reveals Session 1 or 2 missed scope significantly.

## Questions before starting

- Animation library: use Tailwind built-ins (`transition-*`, `duration-*`) OR add `tailwindcss-animate` plugin? Recommend Tailwind built-ins first (no new dep). Plugin only if complex keyframes needed.
- Empty cart state: friendly message OK, or illustration? Recommend text-only (EmptyState component already supports).
- Performance budget: if animations cause jank on low-end mobile, reduce duration? Recommend measure first, optimize only if needed.
