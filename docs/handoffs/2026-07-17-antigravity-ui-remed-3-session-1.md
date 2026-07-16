# Task: UI-REMED-3 Session 1 — Dialog Components + Imperative API

## Context

Phase 1 UI audit flagged 54 native `alert()` / `confirm()` calls across 19 source files (REPLACE-ALERT category). Native dialogs are jarring, non-styled, block main thread, and don't match Fresh Blue design system.

Existing `components/ui/DeleteConfirmModal.tsx` is component-based (`isOpen`/`onClose`/`onConfirm` props), tied to delete semantics. Doesn't fit imperative migration pattern.

UI-REMED-3 split into 2 sessions:
- **Session 1 (this task)**: create imperative Dialog API + components + tests. End with 1 proof-of-concept migration to validate API.
- **Session 2 (next handoff)**: bulk migrate 53 remaining call sites.

## Goal

Build an imperative Dialog API that lets call sites replace `alert()` / `confirm()` with minimal code change:

```tsx
// Before
if (confirm("Xóa?")) { delete(); }
alert("Vui lòng điền đủ thông tin");

// After
import { alert, confirm } from "@/lib/dialog";
if (await confirm({ title: "Xác nhận xóa", message: "Không thể hoàn tác." })) { delete(); }
await alert({ title: "Thiếu thông tin", message: "Vui lòng điền đủ các trường bắt buộc." });
```

The API returns Promises so `await` works naturally in async handlers.

## Components to create

### 1. `components/ui/Dialog.tsx` — presentational primitive

Generic dialog with:
- Backdrop: `bg-black/50 backdrop-blur-sm` (per UI-19 fix pattern)
- Container: card style with `bg-surface-card rounded-card border border-border shadow-lg`
- ESC key dismisses (configurable via prop)
- Click outside dismisses (configurable via prop)
- Focus trap inside dialog
- Mobile-first: full-width with bottom padding at 375px; centered at md+
- `aria-modal="true"`, `role="dialog"`, proper `aria-labelledby`

Props: `{ isOpen, onClose, children, title?, dismissible? }`

### 2. `components/DialogHost.tsx` — global mount

Mounted once in `app/layout.tsx` (root layout). Subscribes to dialog state from `lib/dialog.ts` and renders the current dialog (or null).

### 3. `lib/dialog.ts` — imperative API

```typescript
type AlertOptions = {
  title?: string;
  message: string;
  okText?: string;       // default "Đã hiểu"
  variant?: "info" | "warning" | "danger";  // controls icon + button color
};

type ConfirmOptions = {
  title?: string;
  message: string;
  okText?: string;       // default "Xác nhận"
  cancelText?: string;   // default "Huỷ"
  variant?: "info" | "warning" | "danger";  // controls icon + ok button color
};

export function alert(options: AlertOptions): Promise<void>;
export function confirm(options: ConfirmOptions): Promise<boolean>;
```

Internally: a tiny event-emitter / state holder. DialogHost subscribes via `useSyncExternalStore` or similar.

### 4. Tests

`lib/dialog.test.ts` covering:
- `alert()` returns Promise that resolves on OK click
- `confirm()` returns Promise<boolean>: true on OK, false on Cancel/ESC/click-outside
- Multiple sequential dialogs queue correctly (no overlap)
- Variant propagates to dialog rendering

`components/ui/Dialog.test.tsx` covering:
- ESC dismisses when dismissible=true
- ESC does NOT dismiss when dismissible=false
- Click outside dismisses when dismissible=true
- Focus trap keeps tab within dialog

## Scope

### In scope

1. Create `components/ui/Dialog.tsx` (presentational primitive).
2. Create `components/DialogHost.tsx` (global mount, subscribes to lib/dialog state).
3. Create `lib/dialog.ts` (imperative API + internal state).
4. Mount `DialogHost` in `app/layout.tsx`.
5. Tests for all 3 files.
6. **Proof-of-concept migration**: replace `alert()` calls in `app/admin/inventory/sync/page.tsx` (2 occurrences, simple validation messages) with the new API. Validates the migration pattern works before Session 2 bulk.

### Out of scope

- Do NOT migrate the other 52 call sites (Session 2).
- Do NOT remove existing `FormModal` / `DeleteConfirmModal` (they work for their use cases).
- Do NOT add Toast component (future enhancement, not required for this task).
- Do NOT push to remote.

## Constraints

- **Mobile-first**: must work at 375px viewport (per project memory).
- **Design system tokens only**: no hardcoded colors. Use `bg-surface-card`, `text-text-primary`, `text-text-secondary`, `border-border`, `bg-danger`, `bg-warning` tokens.
- **Promise-based API**: `alert()` and `confirm()` MUST return Promises for ergonomic `await` usage.
- **Queue semantics**: if `alert()` called twice rapidly, second must wait for first to dismiss.
- **Accessibility**: focus trap, ESC, ARIA roles per WAI-ARIA dialog pattern.
- **No new dependencies**: use React built-ins. If focus-trap library needed, flag for Claude approval before adding.
- **Atomic commit**: components + tests + 1 proof-of-concept migration in single commit.

## Reusable existing code

- `components/ui/Button.tsx` — variants: primary, secondary, danger, outline
- `components/ui/FormModal.tsx` — reference for existing modal pattern (backdrop, structure)
- `components/ui/DeleteConfirmModal.tsx` — reference for confirm semantics (do not extend, just reference)
- `tailwind.config.ts` — design tokens
- `app/globals.css` — CSS variable definitions

## Verification

1. `tsc --noEmit`: 0 errors.
2. `vitest run`: baseline 391/391 + new dialog tests (target ~5-10 new tests).
3. `npm run build`: success.
4. Manual smoke: load `/admin/inventory/sync`, trigger one of the migrated alert() paths, verify dialog appears with correct styling at both desktop (1280px) and mobile (375px).
5. ESC dismisses dialog.
6. Click outside dismisses dialog.
7. `git diff --check`: clean.

## Expected output

- `components/ui/Dialog.tsx` (new, presentational primitive).
- `components/DialogHost.tsx` (new, global mount).
- `lib/dialog.ts` (new, imperative API).
- `lib/dialog.test.ts` (new tests).
- `components/ui/Dialog.test.tsx` (new tests).
- `app/layout.tsx` (modify — add `<DialogHost />` mount).
- `app/admin/inventory/sync/page.tsx` (modify — proof-of-concept migration of 2 alert() calls).
- `DEVELOPMENT-TRACKING.md` entry.
- Commit: `Antigravity ui: imperative dialog API + components (UI-REMED-3 Session 1)`.
- No push.

## Priority

P1 — second task in UI-REMED saga. Antigravity pickup. ~1 session.

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.1 Pro (Low)` — new component creation with accessibility + Promise-based API requires deeper reasoning than mechanical refactor. Effort tier Low for Pro.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Existing modal pattern (FormModal/DeleteConfirmModal) conflicts with new Dialog API design — would indicate architectural decision needed.
- Focus trap requires new dependency — flag for approval.
- Promise queue semantics conflict with React 18 StrictMode double-mount behavior.
- Layout regression at 375px (dialog overflows viewport).
- Proof-of-concept migration reveals API ergonomics issue (e.g., too verbose, requires awkward wrapper).

## Questions before starting

- Should Dialog support a `size` prop (sm/md/lg) from start? Recommend YES — avoids future breaking change.
- Should `confirm()` default `variant` be "warning" (most common) or "info"? Recommend "warning" since confirms usually precede risky actions.
- Toast component (transient notifications): in scope as future Session 3? Recommend defer to separate task after REPLACE-ALERT migration proves stable.
