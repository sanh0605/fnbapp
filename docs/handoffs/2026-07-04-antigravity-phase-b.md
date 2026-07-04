# Antigravity Prompt — Phase B: Global CSS a11y

Date: 2026-07-04
Owner: Antigravity (UI Lead)
Source spec: `docs/audits/2026-07-04-ui-audit.md` (Phase B, fixes #3 + #8)

## Context

Claude ran a UI audit against Vercel Web Interface Guidelines and found 0 `focus-visible:` styles system-wide (85 buttons/links with no keyboard focus ring) and 1 `prefers-reduced-motion` guard vs 60 `animate-*` calls. Phase A (shared components) is done. Phase B adds 2 global CSS rules to fix both at once.

This is the highest-leverage fix in the audit: 1 file change resolves 60+ animation issues + every focus-visible gap.

## Files

- `app/globals.css` (verify exact path before edit)

## Changes

### 1. Focus-visible base style

Add to `:root` or top-level selector:

```css
/* Keyboard accessibility — visible focus for all interactive elements */
:focus-visible {
  outline: 2px solid #3b82f6; /* blue-500 */
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove default outline only when focus-visible replacement is active */
:focus:not(:focus-visible) {
  outline: none;
}
```

Why: keyboard users (Tab key) currently cannot see where focus is. With this base rule, every button/link/input shows a visible ring. Components that already set `focus-visible:ring-*` (e.g. FormModal after Phase A3) override this — no conflict.

### 2. Reduced-motion media query

Add:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Why: users with vestibular disorders / motion sensitivity need animations disabled. The audit found 60 `animate-*` calls (spin, pulse, fade, slide) with zero guards.

## Verification

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 278+ tests pass
3. Manual check:
   - Open Chrome DevTools → Rendering tab → "Emulate CSS media feature prefers-reduced-motion: reduce"
   - Visit `/admin`, `/login`, `/pos`
   - All animations should be near-instant
4. Manual check:
   - Visit `/admin/suppliers`, click "Thêm Nhà Cung Cấp" button
   - Press Tab repeatedly — every focusable element shows blue ring
   - Open browser DevTools, confirm `:focus-visible` style applies
5. No visual regression on hover/click states (only keyboard focus changes)

## Out of scope

- Do NOT modify any other file. Single file change only.
- Do NOT remove existing `focus:ring-*` rules — they coexist with `:focus-visible`.
- Do NOT touch `transition-all` — that's Phase C.

## Commit

Suggested format: `Antigravity ui(a11y): globals.css focus-visible + reduced-motion (Phase B)`

## Skills available

Skills installed at `.agents/skills/`:
- `web-design-guidelines` — Vercel rules (source for this audit)
- `ui-ux-pro-max` — design intelligence

Read `.agents/skills/web-design-guidelines/SKILL.md` if you want the full rule list.
