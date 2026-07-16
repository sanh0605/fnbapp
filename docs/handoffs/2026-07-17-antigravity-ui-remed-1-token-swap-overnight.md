# Task: UI-REMED-1 — TOKEN-SWAP Migration (AUTONOMOUS OVERNIGHT)

## ⚠️ AUTONOMOUS MODE — READ FIRST

**User is sleeping. You CANNOT ask questions. Use defaults from this brief.**

If you encounter ambiguity: **pick the closest semantic match, apply it, document the decision in commit body + final report. NEVER STOP to ask.**

If you encounter a hard error (TypeScript fail, build fail): **revert the last 1-2 changes, retry with conservative mapping, document in report. NEVER STOP to ask.**

If you complete all 5 phases: **write final report and stop.**

If you hit the 6-hour mark: **commit whatever phase is in progress, write final report, stop.**

**THERE IS NO SCENARIO WHERE YOU ASK A QUESTION.** Everything is decided upfront below.

## HARD RULES

1. **NEVER `git push`.** Local commits only. Verify with `git status` after each commit shows "ahead of origin/main by N".
2. **NEVER `--force` anything.**
3. **NEVER ask user/Claude questions.** Use defaults below.
4. **NEVER run database writes, migrations, or Supabase deploys.**
5. **NEVER touch test files** (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `__tests__/`).
6. **ALWAYS commit per phase** (5 phases total, 5 commits).
7. **ALWAYS use the token mapping tables below verbatim.** Don't invent mappings.
8. **ALWAYS document deviations** in commit body AND final report.

## Color family breakdown (5 phases)

Phase order: largest first.

| Phase | Family | Count | Est. time |
|---|---|---:|---|
| 1 | gray/slate/zinc/neutral/stone | ~466 | 2-3h |
| 2 | blue/indigo/sky/cyan | ~141 | 1h |
| 3 | red/rose/pink | ~64 | 30min |
| 4 | emerald/green/teal | ~33 | 15min |
| 5 | amber/yellow/orange + violet/purple/fuchsia + hex literals | ~400 | 1h |

## Token mapping (USE VERBATIM)

### Phase 1: Gray family

| Old | New token |
|---|---|
| `bg-white` | `bg-surface-card` |
| `bg-gray-50` | `bg-surface-secondary` |
| `bg-gray-100` | `bg-surface-secondary` |
| `bg-gray-200` | `bg-border` |
| `bg-gray-300` | `bg-border` |
| `bg-gray-400` | `bg-border` |
| `border-gray-100` | `border-border` |
| `border-gray-200` | `border-border` |
| `border-gray-300` | `border-border` |
| `divide-gray-100` | `divide-border` |
| `divide-gray-200` | `divide-border` |
| `ring-gray-100` | `ring-border` |
| `ring-gray-200` | `ring-border` |
| `ring-gray-300` | `ring-border` |
| `ring-gray-400` | `ring-border` |
| `text-gray-400` | `text-text-muted` |
| `text-gray-500` | `text-text-secondary` |
| `text-gray-600` | `text-text-secondary` |
| `text-gray-700` | `text-text-primary` |
| `text-gray-800` | `text-text-primary` |
| `text-gray-900` | `text-text-primary` |
| `shadow-gray-*` | KEEP (no token) |
| `from-gray-*`, `to-gray-*`, `via-gray-*` (gradients) | KEEP (no token) |

**Slate/zinc/neutral/stone**: apply SAME mappings as gray.

**Hover/active/focus variants** (`hover:bg-gray-*`, `active:bg-gray-*`, `focus:bg-gray-*`, etc.): apply SAME mapping to the base color. Example: `hover:bg-gray-100` → `hover:bg-surface-secondary`.

### Phase 2: Blue family

| Old | New token |
|---|---|
| `bg-blue-50` | `bg-primary-soft` |
| `bg-blue-100` | `bg-primary-soft` |
| `bg-blue-200` | `bg-primary-soft` |
| `bg-blue-300` | `bg-primary` |
| `bg-blue-400` | `bg-primary` |
| `bg-blue-500` | `bg-primary` |
| `bg-blue-600` | `bg-primary` |
| `bg-blue-700` | `bg-primary-hover` |
| `bg-blue-800` | `bg-primary-active` |
| `bg-blue-900` | `bg-primary-active` |
| `text-blue-*` (any shade) | `text-primary` |
| `border-blue-*` (any shade) | `border-primary` |
| `ring-blue-*` (any shade) | `ring-focus-ring` |

**Indigo/sky/cyan**: apply SAME mappings as blue.

### Phase 3: Red/Rose/Pink family

| Old | New token |
|---|---|
| `bg-red-50` | `bg-danger/10` |
| `bg-red-100` | `bg-danger/10` |
| `bg-red-200` | `bg-danger/20` |
| `bg-red-500` | `bg-danger` |
| `bg-red-600` | `bg-danger` |
| `bg-red-700` | `bg-danger` |
| `bg-red-800` | `bg-danger` |
| `text-red-400` | `text-danger` |
| `text-red-500` | `text-danger` |
| `text-red-600` | `text-danger` |
| `text-red-700` | `text-danger` |
| `border-red-200` | `border-border` (fallback) |
| `border-red-300` | `border-border` (fallback) |
| `border-red-400` | `border-danger` |
| `border-red-500` | `border-danger` |
| `ring-red-*` | `ring-danger` |

**Rose/pink**: apply SAME mappings as red.

### Phase 4: Emerald/Green/Teal family

| Old | New token |
|---|---|
| `bg-emerald-50` | `bg-success/10` |
| `bg-emerald-100` | `bg-success/10` |
| `bg-emerald-500` | `bg-success` |
| `bg-emerald-600` | `bg-success` |
| `bg-emerald-700` | `bg-success` |
| `text-emerald-400` | `text-success` |
| `text-emerald-500` | `text-success` |
| `text-emerald-600` | `text-success` |
| `text-emerald-700` | `text-success` |
| `border-emerald-*` | `border-success` (if 400+) else `border-border` |
| `ring-emerald-*` | `ring-success` fallback `ring-border` |

**Green/teal**: apply SAME mappings as emerald.

### Phase 5: Other families + hex literals

**Amber/yellow/orange:**
- `*-amber-50/100` → `*-warning/10`
- `*-amber-500/600` → `*-warning`
- `*-yellow-*` → apply SAME as amber
- `*-orange-*` → apply SAME as amber

**Violet/purple/fuchsia:**
- `*-violet-50/100` → `*-processing/10`
- `*-violet-500/600` → `*-processing`
- `*-purple-*` → apply SAME as violet
- `*-fuchsia-*` → apply SAME as violet

**Hex literals** (`#2563EB`, `#dc2626`, etc.):
- Look up in `app/globals.css` for matching token value
- If exact match: replace with token
- If close match (within color family): replace with token, note in report
- If no match: KEEP literal, note in report

## DEFAULTS for ambiguous situations

| Situation | Default action |
|---|---|
| Token mapping unclear | Pick closest semantic match from table. Document in commit body. |
| File has mix of mapped + unmapped colors | Migrate what's mappable, leave rest, document count in commit. |
| TypeScript error after change | Revert last 1-2 file changes, retry with conservative mapping (`border-border` for any gray). |
| Build error | Same as TS error — revert last 1-2 changes, retry conservatively. |
| Visual smoke reveals regression on 1 route | Note in report, continue to next phase. Smoke test other routes next phase. |
| Visual smoke reveals severe regression (page unusable) on multiple routes | Stop. Commit current phase. Skip remaining phases. Write final report. |
| Grep returns unexpected file (test, story, generated) | Skip file. Document count in report. |
| Color shade not in mapping table | Use closest shade in same family. |
| Conditional className (e.g., `${cond ? 'bg-red' : 'bg-green'}`) | Apply same mapping to both branches. |
| Template literal with color in string | Apply mapping if pattern matches. Skip otherwise. |
| CSS file with raw color | Skip (only `.ts`/`.tsx` in scope). |
| Hit 6-hour mark mid-phase | Commit current progress. Skip remaining phases. Write final report. |

## Per-phase workflow (FOLLOW EXACTLY)

For EACH phase (1 through 5):

1. **Grep** for the color family pattern in `app/**/*.tsx` + `components/**/*.tsx` (NOT tests, NOT stories, NOT `.css` files).
2. **Apply mappings** per tables above. Use search-replace with regex if confident, or manual per-file if not.
3. **TypeScript check**: `npx tsc --noEmit` MUST pass.
   - If fails: revert 1-2 recent changes until passes. Document.
4. **Build check**: `npm run build` MUST succeed.
   - If fails: revert 1-2 recent changes until passes. Document.
5. **Visual smoke**: start dev server `npm run dev` (background), visit 2 routes from list below, verify page loads (not crash). Visual perfection NOT required — just "no white screen, layout intact".
   - Recommended routes per phase:
     - Phase 1 (gray): `/admin/orders`, `/admin/products`
     - Phase 2 (blue): `/admin/inventory/items`, `/admin/production`
     - Phase 3 (red): `/admin/inventory/stock-adjustments`, `/admin/users`
     - Phase 4 (emerald): `/admin/reports/sales`, `/admin/audit/backdated-ledger`
     - Phase 5 (mixed): `/pos`, `/admin/inventory/purchase-orders`
6. **Commit** (one per phase):
   ```
   Antigravity ui: TOKEN-SWAP phase N - <family> → tokens (UI-REMED-1/N)
   
   <N> occurrences migrated across <M> files.
   Deviations: <list any, or "none">
   Smoke routes visited: <list>
   ```
7. **Append to tracking**: note phase done.

**Do NOT run tests.** TS + build is enough for className string changes.

## Stop conditions (HARD)

STOP ALL WORK and write final report if ANY of:

- TypeScript errors can't be resolved by reverting ≤5 file changes.
- Build fails with errors that can't be resolved by reverting ≤5 file changes.
- Visual regression severe on 3+ routes (page unusable, not just color slightly off).
- 6 hours elapsed since phase 1 start.
- All 5 phases complete.

**NEVER STOP for**: questions, ambiguities, "should I do X", token mapping doubts. Use defaults.

## Final report (REQUIRED)

Create `docs/reports/ui-remed-1-overnight-report.md`:

```markdown
# UI-REMED-1 TOKEN-SWAP Overnight Report

Date: 2026-07-17 → 2026-07-18
Owner: Antigravity (autonomous)
Reviewer: Claude (pending morning)

## Summary

- Phases completed: N/5
- Total occurrences migrated: ~N / 1105
- Total commits: N
- Elapsed time: ~Nh
- Push executed: NO (verified via `git log origin/main..HEAD`)

## Per-phase status

### Phase 1: gray family
- Status: COMPLETE | PARTIAL | SKIPPED
- Occurrences migrated: N
- Files touched: N
- Commit: <sha>
- Smoke routes: <list>
- Smoke result: PASS | MINOR_DIFF | REGRESSION
- Deviations: <list, or "none">

### Phase 2-5: (same structure)

## Token gaps discovered

(List any old colors with no clean token equivalent. Suggest new tokens to add.)

- gray-XXX → text-text-secondary (closest, slight darkness diff)
- ...

## TypeScript + Build status (final)

- `tsc --noEmit`: PASS | FAIL
- `npm run build`: PASS | FAIL

## Deviations from brief

(Anything you decided differently from the brief. Use this section liberally — Claude will review.)

## Pending Claude morning review

(Leave blank — Claude fills in morning)
```

## Final commit (after report)

Commit the report:
```
Antigravity ui: UI-REMED-1 overnight report (autonomous, no push)

5 phases attempted, N completed. Report at docs/reports/ui-remed-1-overnight-report.md.
No git push executed. Local only.
```

## Priority

P1 — autonomous async. ~5 hours max. Gemini 3.5 Flash High.

## Recap of critical rules

1. NO PUSH
2. NO QUESTIONS — use defaults
3. Commit per phase
4. Self-verify (tsc + build) per phase
5. Final report required
6. Stop only on hard errors or 6h limit or all-phases-done
