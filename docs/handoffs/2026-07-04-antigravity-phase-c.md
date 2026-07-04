# Antigravity Prompt — Phase C: Per-page UI fixes

Date: 2026-07-04
Owner: Antigravity (UI Lead)
Source spec: `docs/audits/2026-07-04-ui-audit.md` (Top-10 priority fixes #5, #6, #7, #9)

## Context

Phase A fixed shared components (FormModal, LoadingButton, DeleteConfirmModal, SearchableSelect). Phase B will add global CSS for focus-visible + reduced-motion. Phase C fixes per-page issues that shared-component fixes don't cover.

Total: ~50 issues across 3 priority files + 1 mechanical sweep.

## Sub-tasks

### C1: `app/login/page.tsx` (14 issues)

Issues (file:line from audit doc):

```text
app/login/page.tsx:63 - <label> missing htmlFor
app/login/page.tsx:78 - <label> missing htmlFor
app/login/page.tsx:56 - error <div> missing aria-live="polite"
app/login/page.tsx:69 - outline-none without focus-visible replacement
app/login/page.tsx:84 - outline-none without focus-visible replacement
app/login/page.tsx:67 - username input: add spellCheck={false}
app/login/page.tsx:73 - placeholder "Nhập tên đăng nhập" → "Tên đăng nhập…"
app/login/page.tsx:87 - placeholder "Nhập mật khẩu" → "Mật khẩu…"
app/login/page.tsx:26 - error not focused on submit
app/login/page.tsx:95 - submit button missing focus-visible:ring-*
app/login/page.tsx:98 - spinner animate-spin (Phase B handles via media query)
app/login/page.tsx:42 - generic error → include fix/next step
app/login/page.tsx:106 - "Powered by Next.js & Google Sheets" → outdated (Supabase now)
```

Suggested implementation:
- Add `htmlFor="username"` / `htmlFor="password"` to `<label>` + matching `id` on `<input>`
- Wrap error `<div>` with `aria-live="polite"` or add `role="alert"`
- Replace `outline-none` with `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none` (Phase B global rule may also catch this, but per-input fix is safer)
- Add `spellCheck={false}` to username
- Update placeholders: "Tên đăng nhập…", "Mật khẩu…"
- Update copy: "Powered by Next.js & Supabase" or remove line entirely
- Update generic error to "Đã xảy ra lỗi hệ thống. Vui lòng thử lại hoặc liên hệ quản lý."

### C2: `app/admin/layout.tsx` (22 issues)

```text
app/admin/layout.tsx:267 - hamburger button (svg-only) missing aria-label
app/admin/layout.tsx:291 - modal close button (svg-only) missing aria-label
app/admin/layout.tsx:287 - POS brand modal missing role="dialog" aria-modal + Escape + focus trap
app/admin/layout.tsx:287 - modal no overscroll-behavior: contain
app/admin/layout.tsx:152 - close button no focus-visible:ring-* (handled by Phase B global)
app/admin/layout.tsx:158 - POS button (handled by Phase B global)
app/admin/layout.tsx:175,198,222,254,267,291,308 - (handled by Phase B global)
app/admin/layout.tsx:177 - transition-all → transition-colors
app/admin/layout.tsx:203 - transition-all → transition-colors
app/admin/layout.tsx:227 - transition-all → transition-colors
app/admin/layout.tsx:311 - transition-all → transition-colors
app/admin/layout.tsx:287,288,305 - animate-* (handled by Phase B global)
app/admin/layout.tsx:305 - "Đang tải danh sách..." → "Đang tải danh sách…" (ellipsis char)
app/admin/layout.tsx:86,90 - expandedGroups + isPosModalOpen not URL-synced (DEFER to Phase D)
```

Suggested implementation:
- Add `aria-label="Mở menu"` to hamburger, `aria-label="Đóng"` to modal close
- POS brand modal: add `role="dialog" aria-modal="true"` + Escape handler + focus trap (mirror FormModal pattern from Phase A3 — copy the useEffect logic)
- Add `overscroll-behavior-contain` to backdrop
- Replace `transition-all` with `transition-colors` (or specific property per case)
- Fix "..." → "…" character
- DEFER URL state sync to Phase D

### C3: `components/POSScreen.tsx` (3+ issues)

```text
components/POSScreen.tsx:113-118 - manual date format → Intl.DateTimeFormat
components/POSScreen.tsx:74,77 - toast messages need aria-live region
components/POSScreen.tsx:51 - Math.random for ID (minor)
components/POSScreen.tsx — toasts container needs role="region" aria-live="polite"
```

Suggested implementation:
- Replace lines 113-118 with `Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(now)`
- Find toasts render block (search for `toasts.map`), wrap container with `role="region" aria-live="polite" aria-label="Thông báo"`
- Optionally use `crypto.randomUUID()` instead of `Math.random().toString(36)` for toast IDs

### C4: Mechanical `transition-all` sweep (39 files)

Run: `grep -rn "transition-all" app/admin components` to list all 85 occurrences.

For each occurrence, replace with the appropriate specific property:
- Color-only changes (background, text color, border): `transition-colors`
- Transform (scale, rotate, translate): `transition-transform`
- Shadow: `transition-shadow`
- If unsure: `transition-colors` is safest default

Files to update (top by count from audit):
- `app/admin/promotions/components/PromotionForm.tsx` (11)
- `app/admin/semi-products/components/SemiProductForm.tsx` (7)
- `app/admin/suppliers/components/SupplierForm.tsx` (5)
- `app/admin/products/modifiers/components/ModifierForm.tsx` (5)
- `app/admin/orders/OrderTable.tsx` (4)
- `app/admin/inventory/items/components/PurchasedItemForm.tsx` (3)
- `app/admin/brands/components/BrandForm.tsx` (3)
- `app/admin/users/components/EditUserForm.tsx` (3)
- `app/admin/users/components/UserForm.tsx` (3)
- `app/admin/orders/OrderEditModal.tsx` (3)
- ... + 29 more files

## Verification

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 278+ tests pass
3. Manual check:
   - `/login`: tab through username/password, see focus ring. Submit empty form → error announced.
   - `/admin` (mobile breakpoint): hamburger button has aria-label, opens sidebar. Tab through, focus stays inside.
   - `/admin` (mobile): open POS modal, press Escape → closes. Click backdrop → closes.
   - `/pos`: trigger error toast → screen reader announces.
   - `/pos`: verify draft name format unchanged visually (Intl outputs same dd/mm HH:MM).
4. Pre-commit hook passes.

## Out of scope

- DEFER URL state sync (useSearchParams / nuqs) — large refactor, separate plan
- DEFER full Intl.NumberFormat migration for currency — large refactor
- DEFER full Vietnamese diacritics sweep on OrderEditModal/OrderTable/CartPanel — content QA
- Do NOT touch Phase A files (FormModal, LoadingButton, DeleteConfirmModal, SearchableSelect) — already done

## Commit strategy

Suggested: one commit per sub-task (C1, C2, C3, C4) for traceable history.

Format: `Antigravity ui(a11y): <scope> (Phase C<N>)`

## Skills

Read `.agents/skills/web-design-guidelines/SKILL.md` for full rule list. Fetch fresh guidelines from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` if needed.
