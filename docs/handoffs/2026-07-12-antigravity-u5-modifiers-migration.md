# Antigravity Prompt — Modifiers Page Design System Migration (Task U5)

Date: 2026-07-12
Owner: Antigravity (UI Lead)
Status: Prompt ready — final cleanup of Fresh Blue Admin Design System.

## Background

U4 "Fresh Blue Admin Design System" complete (17 commits, ~143 files migrated). Final report at `docs/audits/2026-07-12-fresh-blue-admin-final-report.md` flagged **36 hardcoded colors remaining** in `/admin/products/modifiers/` — the only directory skipped during U4 because Codex E1 (commit `b6ffd73`) touched `actions.ts` (logic file) there.

U4 → U5 was deferred to "avoid conflict". Now Codex E1 is done and U4 is complete, the modifiers page can be safely migrated.

**Important:** The migration is **className-only**. It does NOT touch `actions.ts` (Codex's logic). No real conflict possible.

## Goal

Migrate `/admin/products/modifiers/*` to Fresh Blue Admin tokens. Bring hardcoded color count from 36 → 0.

## Scope

| File | Hardcoded colors | Notes |
|---|---|---|
| `app/admin/products/modifiers/components/ModifiersClient.tsx` | 16 | List page client |
| `app/admin/products/modifiers/components/ModifierForm.tsx` | 20 | Form component |
| `app/admin/products/modifiers/loading.tsx` | TBD | May have `bg-white` skeleton |
| `app/admin/products/modifiers/page.tsx` | TBD | Server component, may have wrapper styles |

**Do NOT touch:**
- `app/admin/products/modifiers/actions.ts` (Codex logic — `planRecipeSave` etc.)
- `app/admin/products/modifiers/actions.test.ts` (Codex tests)
- Any other `lib/`, `supabase/`, `scripts/` files

## Implementation

### Standard migrations (same as U4 Phase 4-5)

Use the same Node script auto-replace pattern from U4. Apply mappings:

| Hardcoded | Token |
|---|---|
| `bg-blue-600`, `hover:bg-blue-700` | `bg-primary`, `hover:bg-primary-hover` |
| `text-blue-600`, `text-blue-700` | `text-primary` |
| `bg-blue-50`, `bg-blue-100` | `bg-primary-soft` |
| `border-blue-200` | `border-primary/20` |
| `text-gray-900/800/700` | `text-text-primary` |
| `text-gray-600/500` | `text-text-secondary` |
| `text-gray-400` | `text-text-muted` |
| `bg-gray-50/100` | `bg-page`, `bg-surface-secondary` |
| `bg-white` | `bg-surface-card` |
| `border-gray-100/200/300` | `border-border` |
| `text-emerald-*`, `bg-emerald-*` | `text-success`, `bg-success/10` |
| `text-red-*`, `bg-red-*` | `text-danger`, `bg-danger/10` |
| `text-rose-*`, `bg-rose-*` | `text-danger`, `bg-danger/10` |
| `text-amber-*`, `bg-amber-*` | `text-warning`, `bg-warning/10` |
| `text-orange-*`, `bg-orange-*` | `text-warning`, `bg-warning/10` (per U4 precedent) |
| `text-indigo-*` | `text-primary` |
| `focus:ring-blue-*`, `focus:ring-orange-*` | `focus:ring-focus-ring` |
| `ring-gray-*` | `ring-border` |
| `bg-gray-400` | `bg-border` |

### Component migrations

Replace inline button className with `<Button>` component where appropriate:
- Primary actions (Save, Add): `<Button variant="primary">`
- Edit/View: `<Button variant="ghost" size="sm">`
- Delete: `<Button variant="danger">` or use `<DeleteConfirmModal>` for confirm flow

Replace status spans with `<Badge>`:
- ACTIVE → `<Badge variant="success">`
- INACTIVE → `<Badge variant="warning">`
- DELETED → `<Badge variant="neutral">`

Replace emoji with Lucide icons (similar mapping as U4 Phase 2/4):
- `☕` → `<Coffee />`
- `+` → `<Plus />`
- `✏️` → `<Pencil />`
- `🗑` → `<Trash2 />`

### Mobile-first

Modifiers page should already have mobile-first pattern (per U2 Batch 1R). Verify:
- Mobile card layout exists (`md:hidden flex flex-col`)
- Desktop table hidden on mobile (`hidden md:block`)
- Touch targets `min-h-[44px]`

If mobile-first missing, add per U4 spec.

## Verification

Before commit:
- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 335/335 pass
- Grep verify **0 hardcoded colors** in `/admin/products/modifiers/` (excluding `actions.ts` + `actions.test.ts` which Codex owns)
- Manual mobile check on 375px viewport

## Commit

Single commit:
```
Antigravity feat: migrate modifiers page to Fresh Blue Admin (Task U5)
```

Commit body should document:
- 36 → 0 hardcoded colors
- Files migrated (ModifiersClient, ModifierForm)
- Codex logic files (actions.ts, actions.test.ts) NOT touched
- Tests still pass

## Out of scope

- Do NOT modify `actions.ts` (Codex owns modifier save logic)
- Do NOT modify `actions.test.ts` (Codex tests)
- Do NOT change modifier save behavior (recipe planning, validation)
- Do NOT touch any `lib/`, `supabase/`, `scripts/` files
- Do NOT introduce new dependencies (lucide-react already installed)

## Coordination

After U5 commit:
- Claude verifies 0 hardcoded colors in modifiers dir
- Claude updates ROADMAP (U5 → COMPLETED)
- Fresh Blue Admin Design System **fully complete** — 0 hardcoded colors across all admin pages
- Next P1 candidate: E2 (Task 3.3 investigate remaining 97.6% drift) for Codex
