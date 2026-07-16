# Task: UI-REMED-2 — Redesign StickyFilterBar for Design System Consistency

## Context

Phase 1 UI audit (`docs/audits/ui-consistency-2026-07-16.md`) flagged 73 StickyFilterBar usages across 16 client components (REMOVE-STICKYBAR category). User decision 2026-07-16: **redesign** the StickyFilterBar component itself rather than remove the pattern. Rationale: keep sticky UX benefit (filter accessible when scrolling long pages), fix only the consistency issue (font, alignment, color tokens).

Single-file change → 16 clients automatically inherit new style via existing API.

## Goal

Redesign `components/StickyFilterBar.tsx` to align with Fresh Blue design system tokens. **Preserve API 100%** — 16 client components must work unchanged. **Preserve mobile-first responsive behavior** (mobile expand/collapse button).

## Current state

`components/StickyFilterBar.tsx` (76 lines):
- Hardcoded Tailwind colors: `bg-white/95`, `text-gray-900`, `text-gray-500`, `text-gray-700`, `bg-gray-100`, `bg-gray-200`, `border-gray-100`, `border-gray-200`
- Mobile expand/collapse logic with `isMobileExpanded` state
- Sticky positioning: `sticky -top-4 md:-top-8 z-40`
- API: `{ children, rightContent?, title?, subtitle? }`

## Design system tokens to apply

Reference: `tailwind.config.ts` + `app/globals.css` + `components/ui/PageHeader.tsx`.

| Current hardcoded | Token replacement |
|---|---|
| `bg-white/95 backdrop-blur-md` | `bg-surface-card/95 backdrop-blur-md` |
| `border-gray-100` | `border-border` |
| `text-gray-900` (title) | `text-text-primary` |
| `text-gray-500` (subtitle) | `text-text-secondary` |
| `text-gray-700` (mobile button text) | `text-text-primary` |
| `bg-gray-100` (mobile button bg) | `bg-surface-secondary` |
| `hover:bg-gray-200` (mobile button hover) | `hover:bg-surface-secondary/80` (or appropriate hover token if defined; check existing Button component for pattern) |
| `border-gray-200` (mobile button border) | `border-border` |
| `shadow-sm` | keep (already neutral) |

**Typography alignment:** match `components/ui/PageHeader.tsx` title/subtitle sizing + weight for consistency across page headers.

**Spacing:** preserve existing `px-4 md:px-8`, `pt-4 md:pt-8`, `gap-3`, etc. — only color/font tokens change.

## Scope

### In scope

1. Edit `components/StickyFilterBar.tsx`:
   - Replace all hardcoded color/typography classes with design system tokens per table above.
   - Verify mobile expand button uses Button component tokens (or matches Button visual style).
   - Preserve API: `children`, `rightContent`, `title`, `subtitle` props unchanged.
   - Preserve sticky positioning: `-top-4 md:-top-8 z-40`.
   - Preserve mobile-first responsive behavior.

2. Visual verification on 3 representative clients:
   - `app/admin/orders/OrderTable.tsx` (filter-heavy, mobile-critical)
   - `app/admin/products/ProductsClient.tsx` (typical filter usage)
   - `app/admin/inventory/items/ItemsClient.tsx` (mobile expand test)

3. Mobile-first verification: test at 375px viewport (per project memory mobile-first rule). Expand button must work, layout must not break.

### Out of scope

- Do NOT edit any of the 16 client components (API preserved, automatic inheritance).
- Do NOT change mobile expand logic (state, button position, "Lọc thêm/Thu gọn" labels).
- Do NOT add new props.
- Do NOT touch other UI-REMED tasks (TOKEN-SWAP, REPLACE-ALERT, ADD-BOUNDARY).
- Do NOT touch other files in `components/` or `app/`.
- Do NOT push to remote.

## Constraints

- **API preservation**: any change that breaks prop signature or behavior = abort.
- **Mobile-first**: per `memory/mobile-first-ui.md`, all changes must work at 375px viewport.
- **Token-only**: no new hardcoded colors. If a needed shade is missing from tokens, flag for follow-up rather than hardcode.
- **No new dependencies**: use existing Tailwind tokens, no new libraries.
- **Atomic commit**: single-file change + verification screenshots/notes.

## Verification

1. `tsc --noEmit`: 0 errors (TypeScript compile check).
2. `npm run build`: success.
3. Visual smoke test on 3 representative clients at desktop (1280px) AND mobile (375px):
   - Filter bar visible at top
   - Scroll → filter bar stays sticky
   - Mobile expand button works (375px)
   - Colors match design system (no `gray-*`, `white/` literals)
4. No visual regression vs current state (layout, spacing, alignment unchanged).
5. `git diff --check`: clean.

## Expected output

- Updated `components/StickyFilterBar.tsx` (single file).
- Commit: `Antigravity ui: redesign StickyFilterBar with design system tokens (UI-REMED-2)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P1 — first task in UI-REMED sequence (user-impact-first ordering). Antigravity pickup. ~0.5 session.

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (Medium)` — single component redesign with established design system.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Any of 3 representative clients breaks visually after change (would suggest token mismatch or layout regression).
- Mobile expand button no longer works (state/JS issue).
- Design system lacks a needed token (e.g., no `surface-secondary/80` hover variant) → flag instead of hardcode.
- Visual diff at 375px reveals new overflow / horizontal scroll / layout collapse.

## Questions before starting

- Should the mobile expand button use the canonical `<Button>` component from `components/ui/Button.tsx`? (Currently it's a custom `<button>` with hardcoded styles.) Recommend YES for full consistency, but it's a small additional change.
- Should subtitle typography exactly match `PageHeader` subtitle, or keep current size? (PageHeader uses `text-sm text-text-secondary` — StickyFilterBar already matches that pattern.)
