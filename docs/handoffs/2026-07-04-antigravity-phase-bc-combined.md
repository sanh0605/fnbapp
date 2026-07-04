# Antigravity Prompt — Combined Phase B + C (UI a11y)

Date: 2026-07-04
Owner: Antigravity (UI Lead)
Source spec: `docs/audits/2026-07-04-ui-audit.md`

## Context

Claude ran a UI audit against Vercel Web Interface Guidelines. Found 15 systemic issues. Phase A (shared components) is done — `FormModal`, `LoadingButton`, `DeleteConfirmModal`, `SearchableSelect` are fixed and committed.

Phase B + C remain. Do both in this session, commit per sub-task (5 commits expected).

**Important constraint:** Follow `docs/COLLABORATION.md` protocol — these are UI files in your scope. Use the installed skills at `.agents/skills/web-design-guidelines/SKILL.md` if you want the full Vercel rule list. Do not touch engine files (`lib/**`, `supabase/**`, `scripts/**`).

## Skills available

- `.agents/skills/web-design-guidelines/SKILL.md` — Vercel Web Interface Guidelines (source for the audit)
- `.agents/skills/ui-ux-pro-max/SKILL.md` — design intelligence (50+ styles, palettes, patterns)

Both are agent-agnostic — read SKILL.md and apply.

## Sub-tasks (do in order)

### B: `app/globals.css` — focus-visible + reduced-motion

Add 2 blocks to existing globals.css:

```css
/* Keyboard focus visibility — system-wide */
:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 4px;
}
:focus:not(:focus-visible) {
  outline: none;
}

/* Honor reduced-motion preference */
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

Why: 0 `focus-visible:` system-wide (85 buttons/links). 1 `prefers-reduced-motion` vs 60 `animate-*` calls. One file change resolves both at scale.

Verify: tab through `/admin/suppliers` — every button/link shows blue ring. DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` → animations near-instant.

Commit: `Antigravity ui(a11y): globals.css focus-visible + reduced-motion (Phase B)`

### C1: `app/login/page.tsx` (14 issues)

Apply:

```text
app/login/page.tsx:63 - <label> missing htmlFor → add htmlFor="username" + id="username" on input
app/login/page.tsx:78 - <label> missing htmlFor → add htmlFor="password" + id="password" on input
app/login/page.tsx:56 - error <div> missing aria-live="polite"
app/login/page.tsx:69 - outline-none → focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none
app/login/page.tsx:84 - same
app/login/page.tsx:67 - add spellCheck={false} on username input
app/login/page.tsx:73 - placeholder "Nhập tên đăng nhập" → "Tên đăng nhập…"
app/login/page.tsx:87 - placeholder "Nhập mật khẩu" → "Mật khẩu…"
app/login/page.tsx:26 - on submit error, focus the first invalid field (useRef + focus())
app/login/page.tsx:95 - submit button missing focus-visible:ring-* (Phase B global may catch, but explicit is safer)
app/login/page.tsx:42 - generic error → "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau."
app/login/page.tsx:106 - "Powered by Next.js & Google Sheets" → "Powered by Next.js & Supabase" (or remove line)
```

Spinner `animate-spin` (L98) is handled by Phase B global rule. No local change needed.

Commit: `Antigravity ui(a11y): login page a11y + Supabase copy (Phase C1)`

### C2: `app/admin/layout.tsx` (22 issues)

Apply (Phase B global handles most focus-visible gaps — only need per-element fixes for non-focus issues):

```text
app/admin/layout.tsx:267 - hamburger button add aria-label="Mở menu"
app/admin/layout.tsx:291 - modal close button add aria-label="Đóng"
app/admin/layout.tsx:287 - POS brand modal: add role="dialog" aria-modal="true" aria-labelledby + Escape handler + focus trap (mirror FormModal pattern from commit f378d02)
app/admin/layout.tsx:287 - backdrop add overscroll-behavior-contain + onClick close-on-backdrop
app/admin/layout.tsx:177 - transition-all → transition-colors
app/admin/layout.tsx:203 - transition-all → transition-colors
app/admin/layout.tsx:227 - transition-all → transition-colors
app/admin/layout.tsx:311 - transition-all → transition-colors
app/admin/layout.tsx:305 - "Đang tải danh sách..." → "Đang tải danh sách…"
```

DEFER to Phase D: `expandedGroups` + `isPosModalOpen` URL sync (large refactor).

Commit: `Antigravity ui(a11y): layout modal + aria-labels + transition (Phase C2)`

### C3: `components/POSScreen.tsx` (3+ issues)

Apply:

```text
components/POSScreen.tsx:113-118 - replace manual date format with Intl.DateTimeFormat
components/POSScreen.tsx — wrap toasts container with role="region" aria-live="polite" aria-label="Thông báo"
```

For date format, replace:
```ts
const dd = String(now.getDate()).padStart(2, '0');
const mm = String(now.getMonth() + 1).padStart(2, '0');
const HH = String(now.getHours()).padStart(2, '0');
const MM = String(now.getMinutes()).padStart(2, '0');
// ... used as `${dd}/${mm} ${HH}:${MM}`
```

With:
```ts
const formatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
});
// use formatter.format(now)
```

Find the toasts render block (search for `toasts.map`), wrap container with `aria-live`. If toasts container doesn't exist as a discrete element, add one.

Optional: replace `Math.random().toString(36).substring(2, 9)` (line 51) with `crypto.randomUUID()` for proper unique IDs.

Commit: `Antigravity ui(a11y): POSScreen Intl date + toast aria-live (Phase C3)`

### C4: Mechanical `transition-all` sweep

Run: `grep -rn "transition-all" app/admin components` to find all 85 occurrences across 39 files.

For each, replace with the appropriate specific transition:
- Background/text/border color changes → `transition-colors`
- Scale/rotate/translate → `transition-transform`
- Shadow only → `transition-shadow`
- If unsure → `transition-colors` (safe default)

Top files by count:
1. `app/admin/promotions/components/PromotionForm.tsx` (11)
2. `app/admin/semi-products/components/SemiProductForm.tsx` (7)
3. `app/admin/suppliers/components/SupplierForm.tsx` (5)
4. `app/admin/products/modifiers/components/ModifierForm.tsx` (5)
5. `app/admin/orders/OrderTable.tsx` (4)
6. `app/admin/inventory/items/components/PurchasedItemForm.tsx` (3)
7. `app/admin/brands/components/BrandForm.tsx` (3)
8. `app/admin/users/components/EditUserForm.tsx` (3)
9. `app/admin/users/components/UserForm.tsx` (3)
10. `app/admin/orders/OrderEditModal.tsx` (3)
11. ... + 29 more files (1-2 occurrences each)

Use `mcp__ide__getDiagnostics` or `tsc --noEmit` after batch sed to verify no Tailwind class typos.

Commit: `Antigravity ui(a11y): replace transition-all with specific properties (Phase C4)`

## Verification gates (per commit)

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 278+ tests pass (baseline maintained)
3. Pre-commit hook passes (husky tsc check)
4. For B: tab-through test on `/admin/suppliers`, `/login`
5. For C1: form submission flow test, error announcement
6. For C2: mobile breakpoint hamburger + POS modal Escape + click-backdrop
7. For C3: open a draft, verify draft name format unchanged visually
8. For C4: visual diff — hover states still animate correctly (color transitions)

## Out of scope (DEFER)

- URL state sync via `useSearchParams` / `nuqs` — Phase D, large refactor
- Full `Intl.NumberFormat` migration for currency — Phase D
- Full Vietnamese diacritics sweep on remaining files (OrderEditModal `"Tien mat"`, OrderTable, CartPanel) — Phase D, content QA
- Modifier recipe save hardening — Codex scope (Phase 1.5 of recipe work)
- Do NOT touch Phase A files (already committed)

## Coordination

- Claude reviews each commit when you push (do NOT push yourself unless asked)
- If you find a bug in Phase A code (FormModal, LoadingButton, DeleteConfirmModal, SearchableSelect), flag it in the commit message body or add a TODO — don't silently fix
- Update `DEVELOPMENT-TRACKING.md` at session end (append new entry below Claude's 2026-07-04 entry)
