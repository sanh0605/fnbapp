# Antigravity Prompt — Combined Phase B + C (UI a11y)

Date: 2026-07-04
Owner: Antigravity (UI Lead)
Source spec: `docs/audits/2026-07-04-ui-audit.md`

## Context

Claude ran a UI audit against Vercel Web Interface Guidelines. Found 15 systemic issues. Phase A (shared components) was committed by Claude (protocol violation acknowledged) — `FormModal`, `LoadingButton`, `DeleteConfirmModal`, `SearchableSelect`.

Independent code review on 2026-07-04 found **3 Critical + 3 High + 3 Medium regressions** in Phase A commits `f378d02` (FormModal) and `f389bd8` (SearchableSelect). Reviewer verdict: "Block PR."

**Order of work:**
1. **Phase A5 (URGENT)** — fix 7 regressions in FormModal + SearchableSelect FIRST. Do not start Phase B until A5 is committed.
2. Phase B — globals.css (1 file, highest leverage)
3. Phase C1-C4 — per-page fixes + transition-all sweep

Commit per sub-task. Total expected: 6 commits.

**Important constraint:** Follow `docs/COLLABORATION.md` protocol — these are UI files in your scope. Use the installed skills at `.agents/skills/web-design-guidelines/SKILL.md` if you want the full Vercel rule list. Do not touch engine files (`lib/**`, `supabase/**`, `scripts/**`).

## Skills available

- `.agents/skills/web-design-guidelines/SKILL.md` — Vercel Web Interface Guidelines (source for the audit)
- `.agents/skills/ui-ux-pro-max/SKILL.md` — design intelligence (50+ styles, palettes, patterns)

Both are agent-agnostic — read SKILL.md and apply.

## Sub-tasks (do in order)

### A5: URGENT — Phase A regression patch

**Files:** `components/ui/FormModal.tsx`, `components/SearchableSelect.tsx`

**C1 fix — FormModal focus race with child autofocus** (`FormModal.tsx` line ~58)

Current: `containerRef.current?.focus()` unconditionally on open. This overrides any `<input autoFocus>` in child forms and races with `SearchableSelect`'s search input autofocus.

Fix: defer focus to next frame, and only focus the container if nothing else grabbed focus:

```ts
const previouslyFocused = document.activeElement as HTMLElement | null;
queueMicrotask(() => {
  if (
    containerRef.current &&
    !containerRef.current.contains(document.activeElement)
  ) {
    containerRef.current.focus();
  }
});
```

**C2 fix — Click-and-drag from input to backdrop closes modal** (`FormModal.tsx` line ~72-74)

Current: `if (e.target === e.currentTarget) onClose()` triggers on mouseup even if mousedown started inside.

Fix: track mousedown target, only close if both mousedown and mouseup were on backdrop:

```tsx
const mouseDownTarget = useRef<EventTarget | null>(null);

// on backdrop div:
onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
onClick={(e) => {
  if (
    e.target === e.currentTarget &&
    mouseDownTarget.current === e.currentTarget
  ) {
    onClose();
  }
  mouseDownTarget.current = null;
}}
```

**C3 fix — Escape bubbles from SearchableSelect to FormModal** (`SearchableSelect.tsx` line ~45-48)

Current: SearchableSelect's `handleTriggerKey` handles Escape to close dropdown but doesn't stop propagation. Keyup bubbles to document, FormModal also closes — user loses entire form.

Fix: call `e.stopPropagation()` (and `e.stopImmediatePropagation()` if needed for nested cases) in all branches of `handleTriggerKey`:

```ts
const handleTriggerKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
  if (e.key === "Escape" && isOpen) {
    e.stopPropagation();
    setIsOpen(false);
    return;
  }
  if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  }
};
```

**H1 fix — Focus trap selector catches hidden inputs** (`FormModal.tsx` line ~39-41)

Current selector matches `<input type="hidden">` (from SearchableSelect), which is not focusable — calling `.focus()` on it is a no-op and Tab order breaks.

Fix: filter out `[type="hidden"]` and `[aria-hidden="true"]`:

```ts
const focusables = container.querySelectorAll<HTMLElement>(
  'button:not([disabled]):not([aria-hidden="true"]), ' +
  '[href]:not([aria-hidden="true"]), ' +
  'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"]), ' +
  'select:not([disabled]):not([aria-hidden="true"]), ' +
  'textarea:not([disabled]):not([aria-hidden="true"]), ' +
  '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])'
);
```

**H2 fix — Focus restore fires on detached element** (`FormModal.tsx` line ~57-62)

Current: `previouslyFocused?.focus?.()` may target an element removed from DOM (common in lists that re-render).

Fix: check `isConnected` before focusing:

```ts
return () => {
  document.removeEventListener("keydown", handleKey);
  if (previouslyFocused?.isConnected) {
    previouslyFocused.focus();
  }
};
```

**H3 fix — SearchableSelect missing arrow key navigation** (`SearchableSelect.tsx`)

This is the biggest fix (~40 lines). The audit required `aria-activedescendant` and arrow key nav (audit doc L86), but Phase A4 didn't implement it. Without this, sighted keyboard users cannot pick an option without Tab-mapping through every item.

Implementation:

1. Add state for active option index:
   ```ts
   const [activeIndex, setActiveIndex] = useState(-1);
   const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
   ```

2. Reset activeIndex when opening or when filter changes:
   ```ts
   useEffect(() => {
     if (isOpen) setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
   }, [isOpen, filteredOptions.length]);
   ```

3. Extend `handleTriggerKey` to handle ArrowUp/ArrowDown/Enter when open. Note: also handle keys when the input is focused (not just trigger div). Add a separate `handleInputKey` or attach the same handler to both.

4. Add `aria-activedescendant` to the trigger div:
   ```tsx
   aria-activedescendant={
     isOpen && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
   }
   ```

5. Add `id` and `ref` to each option, plus visual highlight for active state:
   ```tsx
   <li
     key={opt.id}
     id={`${listboxId}-opt-${idx}`}
     ref={(el) => { optionRefs.current[idx] = el; }}
     role="option"
     aria-selected={isSelected}
     className={`px-4 py-2 text-sm cursor-pointer truncate ${
       isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
     } ${idx === activeIndex ? 'ring-2 ring-inset ring-blue-300 bg-blue-50' : 'hover:bg-blue-50'}`}
     onClick={() => { onChange(opt.id); setIsOpen(false); triggerRef.current?.focus(); }}
   >
   ```

6. Scroll active option into view:
   ```ts
   useEffect(() => {
     optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
   }, [activeIndex]);
   ```

**M1 fix — Two Tab stops inside one combobox** (`SearchableSelect.tsx` line ~65 + ~91)

Currently both trigger div (`tabIndex={0}`) and search input are Tab-focusable. WAI-ARIA APG requires a single Tab stop.

Fix: when `isOpen`, set trigger `tabIndex={-1}` so the search input becomes the only Tab stop:

```tsx
<div
  ref={triggerRef}
  role="combobox"
  tabIndex={isOpen ? -1 : 0}
  // ...
>
```

And attach the keydown handler to the search input as well (or move focus to the input when opening).

**M3 fix — Nested FormModal double-binds Escape** (`FormModal.tsx` line ~31-35)

When a FormModal opens another FormModal (e.g., DeleteConfirmModal inside a form), both register `document.addEventListener("keydown", ...)`. On Escape, both fire — closing both modals.

Fix: in the Escape branch of FormModal's `handleKey`, call `e.stopImmediatePropagation()` to prevent outer modal's listener from also firing:

```ts
if (e.key === "Escape") {
  e.stopImmediatePropagation();
  onClose();
  return;
}
```

Note: child effects run before parent effects in React, so child's listener is registered first in the document listener list. `stopImmediatePropagation()` in the child handler prevents the parent handler from firing on the same event.

**Commit:** `Antigravity fix(a11y): Phase A regressions from review (Phase A5)`

**Verify before committing A5:**
- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 278+ tests pass
- Manual: open SupplierForm modal, tab through — focus lands on first input, not the dialog container
- Manual: open a form with SearchableSelect (e.g. ConversionForm), click SearchableSelect trigger, press ArrowDown — highlight moves to first option, Enter selects it
- Manual: open SearchableSelect dropdown, press Escape — only the dropdown closes (not the form modal)
- Manual: open a form, click-and-drag from a text input to outside the modal — modal does NOT close
- Manual: open a form with DeleteConfirmModal trigger, click delete → DeleteConfirmModal opens, press Escape → only DeleteConfirmModal closes (parent form stays open)

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
