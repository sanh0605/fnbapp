# Task: UI-REMED-5 — Button Warning Variant + Dialog Icons Polish

## Context

UI-REMED-3 verification surfaced 2 design gaps (non-blocking but worth fixing for visual polish):

1. **Button component** only has 4 variants: `primary`, `secondary`, `ghost`, `danger`. No `warning`. `DialogHost.tsx:40` currently maps `warning → danger` (red button for both warning and danger variants).

2. **DialogHost** doesn't render icons by variant. Handoff Session 1 said "variant controls icon + button color" but implementation only does button color.

Effect: warning and danger dialogs look identical (both red, no icon). Users can only distinguish via message text.

## Goal

1. Add `warning` variant to `components/ui/Button.tsx` (amber/orange per existing `--color-warning` token).
2. Update `components/DialogHost.tsx:40` mapping: `warning → warning` (not `→ danger`).
3. Add icon rendering by variant in DialogHost (3 variants: info, warning, danger).

## Implementation details

### 1. Button warning variant

`components/ui/Button.tsx`:

```typescript
// Add to variant union type
variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';

// Add to variants map
warning: "bg-warning text-white hover:bg-warning/90 active:bg-warning/80 shadow-sm",
```

Note: `--color-warning` exists (`#D97706`). No `--color-warning-hover` token. Use opacity variants (`bg-warning/90`) for hover/active. If proper hover/active tokens wanted later, add to `globals.css` separately.

### 2. DialogHost variant mapping fix

`components/DialogHost.tsx:40`:

```typescript
// Before
<Button variant={variant === "warning" || variant === "danger" ? "danger" : "primary"} onClick={handleOk}>

// After
<Button variant={variant === "warning" ? "warning" : variant === "danger" ? "danger" : "primary"} onClick={handleOk}>
```

### 3. Dialog icons by variant

Add icon block to DialogHost before message text. Use `lucide-react` icons (already in deps):

| Variant | Icon | Color class |
|---|---|---|
| `info` (success/default) | `CheckCircle2` | `text-success` |
| `warning` | `AlertTriangle` | `text-warning` |
| `danger` | `XCircle` | `text-danger` |

Layout: 12x12 circular soft-bg container centered above title/message, mirrors existing `DeleteConfirmModal` pattern:

```tsx
<div className="flex items-center justify-center w-12 h-12 mx-auto bg-warning/10 rounded-full mb-4">
  <AlertTriangle className="w-6 h-6 text-warning" />
</div>
```

Use variant-specific bg/icon class (info → `bg-success/10 text-success`, warning → `bg-warning/10 text-warning`, danger → `bg-danger/10 text-danger`).

## Scope

### In scope

1. Modify `components/ui/Button.tsx` (add warning variant to type + variants map).
2. Modify `components/DialogHost.tsx` (fix variant mapping + add icon block).
3. Tests update if any existing tests assert variant count or types.
4. Visual verify all 3 variants render correctly with icon + button color.

### Out of scope

- Do NOT add `--color-warning-hover` / `--color-warning-active` tokens to `globals.css` (deferred — opacity variants acceptable for now).
- Do NOT change Dialog primitive (`components/ui/Dialog.tsx`).
- Do NOT migrate any call sites (variant defaults remain in `lib/dialog.ts`).
- Do NOT touch other Button variants (primary, secondary, ghost, danger unchanged).
- Do NOT touch other UI-REMED tasks.
- Do NOT push to remote.

## Constraints

- **Backward compatible**: existing Button calls without `variant` prop default to `primary`. Existing Dialog calls without explicit `variant` get default per `lib/dialog.ts:60` (`confirm` defaults warning, `alert` defaults info).
- **Design system tokens**: use existing `bg-warning`, `text-warning`, `bg-success`, `text-success`, `bg-danger`, `text-danger`. No hardcoded hex.
- **Mobile-first**: icon + text layout must work at 375px (verify no horizontal scroll, icon centered).
- **Accessibility**: icon must have `aria-hidden="true"` (decorative, since variant is also conveyed by button color + message text).
- **Atomic commit**: Button + DialogHost changes in single commit.

## Reusable existing code

- `components/ui/Button.tsx` — base component (extend with warning variant)
- `components/ui/DeleteConfirmModal.tsx` — reference for icon-in-circle pattern (lines 40-43)
- `app/globals.css` — `--color-warning` token (#D97706), `--color-success`, `--color-danger`
- `lucide-react` — icon library (already in deps): `CheckCircle2`, `AlertTriangle`, `XCircle`

## Verification

1. `tsc --noEmit`: 0 errors (Button variant type update propagates correctly).
2. `vitest run`: 399/399 baseline pass (no test regressions).
3. `npm run build`: success.
4. **Manual visual verify** — trigger each variant:
   - `info`: trigger any success alert (e.g., PO save OK) → green CheckCircle2 icon + primary blue button "Đã hiểu"
   - `warning`: trigger any validation error (e.g., form submit missing required field) → amber AlertTriangle icon + warning orange button "Đã hiểu"
   - `danger`: trigger any critical error (e.g., sync fail) → red XCircle icon + danger red button "Đã hiểu"
5. Mobile 375px visual: icon centered, no layout break.
6. `git diff --check`: clean.

## Expected output

- `components/ui/Button.tsx` (modify — add warning variant).
- `components/DialogHost.tsx` (modify — fix mapping + add icon block).
- Tests (if needed).
- Commit: `Antigravity ui: Button warning variant + Dialog icons (UI-REMED-5 polish)`.
- Append `DEVELOPMENT-TRACKING.md` entry.
- No push.

## Priority

P2 → P1 promotion (user pickup). Optional polish. Antigravity. ~0.5 session.

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (Medium)` — small component extension with established pattern.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Adding warning variant breaks any existing Button usage (TS error indicates tight coupling).
- Icon layout conflicts with Dialog's existing title/close button area (would require layout refactor).
- Visual regression in primary/secondary/ghost/danger variants.
- Existing tests assert variant type as union and fail compilation.

## Questions before starting

- Opacity hover (`bg-warning/90`) vs new tokens (`--color-warning-hover`)? Recommend OPACITY for now (simpler, single-file change).
- Icon for `info` variant: `CheckCircle2` (success-like) or `Info` (neutral)? Recommend `CheckCircle2` since default info = success message.
- Should the icon container have variant-specific bg tint (`bg-warning/10`) or neutral (`bg-surface-secondary`)? Recommend VARIANT-SPECIFIC tint (matches DeleteConfirmModal pattern).
