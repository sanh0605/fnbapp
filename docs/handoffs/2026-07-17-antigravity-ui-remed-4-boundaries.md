# Task: UI-REMED-4 — Add Root Error + Loading Boundaries (Minimal Scope)

## Context

Phase 1 UI audit flagged missing `error.tsx` + `loading.tsx` boundaries. Investigation reveals:
- **0 `error.tsx` files** exist anywhere in `app/` — every route lacks error boundary
- **27 `loading.tsx` files** exist — only ~3-5 route segments still missing

User chose **Option A (Minimal)**: root-level files + fill missing loading.tsx. No per-route error.tsx unless critical route (deferred).

Next.js App Router semantics: `app/error.tsx` at root catches ALL unhandled errors in any route segment. Single file sufficient for "app doesn't crash to white screen" goal.

## Goal

1. Create `app/error.tsx` — global error boundary.
2. Create `app/loading.tsx` — global loading fallback (covers routes without own loading.tsx).
3. Fill missing `loading.tsx` in ~3-5 route segments that have `page.tsx` but no `loading.tsx`.

Total: ~5-7 new files. Additive only — no existing file modified.

## Files to create

### 1. `app/error.tsx` (new)

```tsx
"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react"; // or appropriate icon

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border rounded-card shadow-lg p-6 max-w-md w-full text-center">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-warning/10 rounded-full mb-4">
          <AlertTriangle className="w-6 h-6 text-warning" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Đã xảy ra lỗi</h2>
        <p className="text-sm text-text-secondary mb-4">
          Ứng dụng gặp sự cố không mong muốn. Vui lòng thử lại.
        </p>
        {error.digest && (
          <p className="text-xs text-text-muted mb-4 font-mono">Mã lỗi: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center bg-primary text-white font-medium px-4 py-2 rounded-button hover:bg-primary-hover transition-colors min-h-[44px]"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
```

### 2. `app/loading.tsx` (new)

Simple full-page skeleton. Use existing `Skeleton` component from `components/ui/Skeleton.tsx` if it fits, otherwise inline shimmer.

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
```

### 3. Fill missing `loading.tsx` in route segments

Identify and create `loading.tsx` for each route segment that has `page.tsx` but no `loading.tsx`. Likely candidates (verify during implementation):
- `app/admin/inventory/purchase-orders/[id]/loading.tsx`
- `app/admin/inventory/purchase-orders/new/loading.tsx`
- `app/admin/users/edit/[id]/loading.tsx`
- `app/admin/audit/backdated-ledger/[eventId]/loading.tsx`
- `app/admin/products/toppings/loading.tsx` (if exists)

Use same pattern as existing `loading.tsx` files (reference `app/admin/loading.tsx`).

## Scope

### In scope

1. Create `app/error.tsx` (1 file).
2. Create `app/loading.tsx` (1 file).
3. Enumerate route segments with `page.tsx` but no `loading.tsx`. Create `loading.tsx` for each (estimate ~3-5 files).
4. Verify boundaries actually trigger (test by intentionally throwing error in a route, refreshing page during slow load).

### Out of scope

- Do NOT modify existing `loading.tsx` files (they work).
- Do NOT add per-route `error.tsx` (deferred — root covers all).
- Do NOT add `not-found.tsx` (separate concern, not in this task).
- Do NOT add `global-error.tsx` (different from `error.tsx`, only for root layout errors — not needed here).
- Do NOT touch other UI-REMED tasks.
- Do NOT push to remote.

## Constraints

- **Additive only**: zero modifications to existing files.
- **Design system tokens**: use `bg-surface-card`, `text-text-primary`, `text-text-secondary`, `border-border`, `bg-primary`, `rounded-card`, `rounded-button`, `text-warning`, etc. No hardcoded colors.
- **Mobile-first**: error/loading UI must look good at 375px (centered card, generous padding, touch-friendly button 44px min height).
- **Accessibility**: error boundary has `role="alert"` semantics implicit in `<h2>` + button. Loading uses `aria-busy="true"` pattern.
- **Vietnamese labels**: per project convention, user-facing text in Vietnamese ("Đã xảy ra lỗi", "Thử lại").

## Reusable existing code

- `components/ui/Skeleton.tsx` — existing skeleton primitive
- `components/ui/Button.tsx` — reference for button token pattern
- `app/admin/loading.tsx` — reference for existing loading pattern (mirror style)
- `tailwind.config.ts` — design tokens
- `app/globals.css` — CSS variable definitions

## Verification

1. **File existence**: confirm `app/error.tsx` + `app/loading.tsx` + N new `loading.tsx` files created.
2. **TypeScript**: `tsc --noEmit` 0 errors.
3. **Build**: `npm run build` success.
4. **Tests**: `vitest run` baseline 399/399 (no test files added — boundaries are presentational).
5. **Manual trigger test**:
   - Temporarily add `throw new Error("test")` to a route's page.tsx, load page, verify error UI shows with "Thử lại" button.
   - Remove test code after verify.
6. **Loading trigger test**: visit a slow route (e.g., reports), verify loading skeleton shows briefly.
7. **Mobile visual**: 375px viewport, error + loading look correct.
8. **`git diff --check`**: clean.

## Expected output

- `app/error.tsx` (new).
- `app/loading.tsx` (new).
- ~3-5 new `loading.tsx` files in route segments that were missing them.
- Commit: `Antigravity ui: add root error/loading boundaries (UI-REMED-4 minimal)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P1 — fourth task in UI-REMED saga. Antigravity pickup. ~0.5 session.

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (Medium)` — bulk additive work (create new files following established pattern).

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- A route segment has unusual structure where loading.tsx pattern doesn't fit (e.g., highly custom layout).
- Error boundary test reveals existing routes throw errors in normal use (would indicate bug to fix, not just catch).
- Existing `loading.tsx` files use inconsistent patterns (would suggest standardization needed first).
- More than 8 route segments missing `loading.tsx` (would suggest scope expansion decision).

## Questions before starting

- Use `lucide-react` `AlertTriangle` icon for error, or different icon? Recommend `AlertTriangle` (warning semantics).
- Include error.digest display in production, or hide? Recommend SHOW (helps debugging when user reports).
- Loading skeleton style: simple block skeletons or branded spinner? Recommend simple skeletons (matches existing pattern).
