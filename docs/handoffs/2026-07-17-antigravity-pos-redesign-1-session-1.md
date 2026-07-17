# Task: POS-REDESIGN-1 Session 1 — Product Cards + Cart Items + Discount Badges (Modern Minimal Soft)

## Context

User complaint: POS "không bắt mắt, typography + spacing 'cheap', components cứng cần bo tròn, nhìn không hiện đại". After UI-REMED-1 color swap, POS structure unchanged → feels same.

User chose **Option A (Modern minimal soft)** direction:
- Nền trắng, spacing rộng, rounded-2xl (16px) cho cards
- Typography lớn + đọc dễ
- Soft shadow (subtle, không nặng)
- Micro-transitions khi hover/click
- Ít màu (primary chỉ cho CTA checkout)
- Premium + sạch + mềm (Square POS / Linear aesthetic)

**⚠️ MOBILE-FIRST IS PRIMARY DESIGN TARGET** (user explicit reminder 2026-07-17).

POS sẽ dùng chủ yếu trên mobile/tablet (nhân viên cầm máy khi phục vụ). Mobile (375px) là design target chính. Desktop (1280px+) là "stretch version" của mobile — không phải ngược lại.

Architecture: giữ route `/pos` hiện tại (không tách subdomain). POS-ARCH-1 (role-based redirect) deferred to P3.

POS-REDESIGN-1 chia 3 sessions:
- **Session 1 (this task)**: leaf components (ProductCard, CartItemRow, DiscountBadge)
- Session 2 (next): layout overhaul (ProductGrid, CartPanel, category bar, search)
- Session 3 (later): polish + transitions + mobile verify

## Goal

Redesign 3 leaf components theo Option A direction, **mobile-first**. Keep all behavior, only visual changes.

## Mobile-first design rules (apply to ALL components)

1. **Default styles = mobile (375px)**. Use `md:` prefix for desktop enhancements.
2. **Touch targets**: ALL interactive elements ≥ 44px height/width.
3. **Typography mobile-readable**: product name `text-sm` minimum, price `text-base` minimum.
4. **Grid**: mobile `grid-cols-2` (cards fit 2 per row), `sm:grid-cols-3`, `md:grid-cols-4`, `lg:grid-cols-5`.
5. **Spacing**: generous padding (`p-3` minimum), avoid cramped layouts.
6. **Cart item row on mobile**: 2-line layout (photo + name + price on row 1, quantity controls + remove on row 2). Stack vertically if needed.
7. **Test 375px FIRST**, then 1280px. Don't reverse.

## Components to redesign

### 1. `components/pos/ProductCard.tsx`

**Before** (current): compact card, small photo, hard corners, default typography.

**After** (Option A, mobile-first):
- Container: `bg-surface-card rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow duration-200 cursor-pointer overflow-hidden`
- Photo area: `aspect-square bg-surface-secondary` (large on mobile, prominent). Photo fills area (`object-cover`).
- Text content padding: `p-3 space-y-1` (generous on mobile, `md:p-4` on desktop).
- Product name: `text-sm md:text-base font-semibold text-text-primary line-clamp-2` (mobile readable, desktop slightly larger).
- Price: `text-base md:text-lg font-bold text-text-primary` (mobile legible, desktop prominent).
- Touch target: ENTIRE card clickable (min 44px height total — easily satisfied).
- Hover (desktop only, `md:hover:scale-[1.02]`): subtle scale + shadow grow.
- Active state mobile (`active:scale-[0.98]`): tap feedback.
- Grid: mobile `grid-cols-2` (default), `sm:grid-cols-3`, `md:grid-cols-4`, `lg:grid-cols-5`.

### 2. `components/pos/CartItemRow.tsx`

**Before**: dense row, small text, tight spacing.

**After** (Option A, mobile-first):
- **Mobile (375px) layout** — 2-line stack:
  - Line 1: photo thumbnail + name + price
  - Line 2: quantity controls (− qty +) + remove button
- **Desktop (md+)**: single-line layout (photo + name + qty + price + remove horizontally)
- Container: `p-3 rounded-xl hover:bg-surface-secondary active:bg-surface-secondary transition-colors` (mobile active state for tap feedback)
- Photo thumbnail: `w-12 h-12 rounded-lg bg-surface-secondary object-cover shrink-0`
- Name: `text-sm font-medium text-text-primary flex-1 line-clamp-1`
- Quantity buttons (−/+): `w-9 h-9 md:w-8 md:h-8 rounded-lg bg-surface-secondary active:bg-border md:hover:bg-border flex items-center justify-center text-text-primary font-bold` (mobile bigger for touch, desktop smaller)
- Quantity number: `text-sm font-semibold tabular-nums min-w-[2ch] text-center`
- Price: `text-sm font-semibold text-text-primary tabular-nums`
- Remove (x): `w-9 h-9 md:w-8 md:h-8 rounded-lg text-text-muted active:text-danger md:hover:text-danger transition-colors flex items-center justify-center` (touch-friendly)

### 3. `components/pos/DiscountBadge.tsx`

**Before**: harsh colored badge.

**After** (Option A, mobile-first):
- Container: `inline-flex items-center px-2.5 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold whitespace-nowrap`
- Subtle, soft (no harsh red/green). Primary color for all discounts (uniform).
- Touch-friendly size (height ~24px acceptable since it's display-only, not interactive).
- If multiple discount types, can vary background opacity but keep primary color.

## Scope

### In scope

1. Redesign 3 leaf components per Option A direction.
2. Verify each component renders correctly in `/pos`.
3. Verify all existing behavior preserved: click to add, quantity controls, remove, discount display.
4. Mobile 375px + desktop 1280px visual check.

### Out of scope

- Do NOT change `ProductGrid.tsx` layout (Session 2).
- Do NOT change `CartPanel.tsx` layout (Session 2).
- Do NOT change category bar / search input (Session 2).
- Do NOT change `POSScreen.tsx` structure (Session 2).
- Do NOT add new design tokens to globals.css (use Tailwind built-ins: `rounded-2xl`, `shadow-md`).
- Do NOT migrate any other components.
- Do NOT push to remote.

## Constraints

- **Behavior preservation**: every onClick, onChange, prop signature MUST work identically. Only className + structure changes.
- **Design system tokens**: use existing (`bg-surface-card`, `text-text-primary`, `bg-primary-soft`, `text-primary`). For larger radius use Tailwind built-ins (`rounded-2xl`, `rounded-xl`).
- **⚠️ MOBILE-FIRST PRIMARY**: Design for 375px FIRST. Use `md:` prefix to enhance for desktop. Test 375px FIRST in dev tools. Don't reverse.
- **Touch targets ≥ 44px** for ALL interactive elements on mobile (buttons, cards, remove icons).
- **Soft shadows**: use custom shadow `shadow-[0_2px_8px_rgba(0,0,0,0.04)]` for default, `shadow-[0_8px_24px_rgba(0,0,0,0.08)]` for hover. Subtle, not heavy.
- **Transitions**: `transition-all duration-200` for smooth feel. Not jarring.
- **No new dependencies**: existing Tailwind only.

## Reusable existing code

- `tailwind.config.ts` — design tokens
- `app/globals.css` — CSS variables
- `components/ui/Button.tsx` — for any in-component buttons
- Existing POS components: `POSScreen.tsx`, `pos/ProductGrid.tsx` (do NOT modify)

## Verification

1. `tsc --noEmit`: 0 errors.
2. `vitest run`: 403/403 baseline pass.
3. `npm run build`: success.
4. **Visual smoke** `/pos`:
   - Product cards: rounded-2xl, soft shadow, hover grows shadow
   - Cart items: clean rows, quantity controls work, remove works
   - Discount badges: subtle primary-soft bg
5. **Mobile 375px**: cards grid-cols-2, cart row stacks if needed, all touch targets ≥44px.
6. **Behavior parity**: add to cart, change quantity, remove, apply discount — all work identically.
7. `git diff --check`: clean.

## Expected output

- `components/pos/ProductCard.tsx` (modify).
- `components/pos/CartItemRow.tsx` (modify).
- `components/pos/DiscountBadge.tsx` (modify).
- Commit: `Antigravity ui: POS redesign Session 1 - leaf components (Modern minimal soft)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P2 → P1 promotion (user pickup). Antigravity. ~1 session (~2-3h).

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.1 Pro (Low)` — design-focused component work with specific aesthetic direction. Low effort tier for Pro.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Existing behavior would change (e.g., adding click handler removed by accident).
- Token needed but doesn't exist (e.g., specific shade not available).
- Mobile layout breaks (cards too narrow, touch targets too small).
- Component structure significantly different from current (would indicate scope creep).

## Questions before starting

- ProductCard photo: products in DB have photo URL? If not, fallback to placeholder or initial letter? Recommend checking `Product.images` field or use placeholder with product initial.
- Discount badge: if discount is 0% or negative, should it still render? Recommend checking current behavior and preserve.
- Cart item row: if quantity controls take too much horizontal space on mobile, can wrap to 2 lines? Recommend: on mobile (375px), put controls on second row below name+price.
