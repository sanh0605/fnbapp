# Task: UI-REMED-1 — TOKEN-SWAP Migration (Async Overnight)

## Context

User Going to sleep. Antigravity authorized to run this task asynchronously overnight. **CRITICAL: NO PUSH ALLOWED.** Commits only. User will forward final report to Claude in morning for review.

Phase 1 UI audit (`docs/audits/ui-consistency-2026-07-16.md`) flagged 1105 raw Tailwind color occurrences across 39 source files. This task migrates them to Fresh Blue design tokens in 5 phases (color family order).

## HARD RULES (read first)

1. **NO `git push`** at any point. Local commits only. Verify with `git status` after each commit.
2. **NO `--force`** anything.
3. **NO migrations, NO database writes, NO Supabase deploys.** Pure UI code change.
4. **Commit per phase** (5 phases total). Don't bundle phases.
5. **If any phase fails visual smoke**: STOP, commit what's done with note in tracking, do NOT continue to next phase.
6. **If you hit ambiguity** (no clear token mapping): use closest semantic match, document in commit body.
7. **Final report required** (see section 11 below) — without report, morning review blocked.

## Color family breakdown (5 phases)

Phase order: largest first (mechanical patterns establish momentum).

| Phase | Family | Count | Files | Est. time |
|---|---|---:|---:|---|
| 1 | gray/slate/zinc/neutral/stone | ~466 | 37 | 2-3h |
| 2 | blue/indigo/sky/cyan | ~141 | 39 | 1h |
| 3 | red/rose/pink | ~64 | 30 | 30min |
| 4 | emerald/green/teal | ~33 | 16 | 15min |
| 5 | amber/yellow/orange + violet/purple/fuchsia + hex literals | ~400 | various | 1h |

Total: ~1105 occurrences, ~5h.

## Token mapping reference

Consult `tailwind.config.ts` + `app/globals.css` for authoritative token list. Key mappings:

### Gray family (Phase 1)

| Old | New token | Use case |
|---|---|---|
| `bg-white` | `bg-surface-card` | Card backgrounds |
| `bg-gray-50` | `bg-surface-secondary` OR `bg-page` | Light page background |
| `bg-gray-100` | `bg-surface-secondary` | Secondary surface |
| `bg-gray-200` | `bg-border` | Stronger surface (rare) |
| `border-gray-100` | `border-border` | Light border |
| `border-gray-200` | `border-border` | Default border |
| `border-gray-300` | `border-border` | Stronger border |
| `text-gray-400` | `text-text-muted` | Muted text |
| `text-gray-500` | `text-text-secondary` | Secondary text |
| `text-gray-600` | `text-text-secondary` | Slightly darker secondary |
| `text-gray-700` | `text-text-primary` | Dark text |
| `text-gray-800` | `text-text-primary` | Darker text |
| `text-gray-900` | `text-text-primary` | Darkest text |
| `ring-gray-*` | `ring-focus-ring` OR `ring-border` | Focus rings |
| `divide-gray-*` | `divide-border` | Dividers |
| `shadow-gray-*` | keep (no token equivalent) | Custom shadows |
| Hover/active variants (`hover:bg-gray-*`) | apply same mapping to hover/active | Hover states |

Slate/zinc/neutral/stone → map to same tokens (all "neutral grays").

### Blue family (Phase 2)

| Old | New token |
|---|---|
| `bg-blue-50` | `bg-primary-soft` |
| `bg-blue-100` | `bg-primary-soft` |
| `bg-blue-500` | `bg-primary` |
| `bg-blue-600` | `bg-primary` |
| `bg-blue-700` | `bg-primary-hover` |
| `bg-blue-800` | `bg-primary-active` |
| `text-blue-*` | `text-primary` |
| `border-blue-*` | `border-primary` |
| `ring-blue-*` | `ring-focus-ring` |

Indigo/sky/cyan → use `primary` family (closest semantic).

### Red/Rose/Pink family (Phase 3)

| Old | New token |
|---|---|
| `bg-red-50` | `bg-danger/10` |
| `bg-red-500` | `bg-danger` |
| `bg-red-600` | `bg-danger` |
| `bg-red-700` | `bg-danger` (no hover token, accept slight visual diff) |
| `text-red-*` | `text-danger` |
| `border-red-*` | `border-danger` (if no token, use `border-border`) |
| `ring-red-*` | `ring-danger` |

Rose/pink → map to danger.

### Emerald/Green/Teal family (Phase 4)

| Old | New token |
|---|---|
| `bg-emerald-50` | `bg-success/10` |
| `bg-emerald-500` | `bg-success` |
| `bg-emerald-600` | `bg-success` |
| `text-emerald-*` | `text-success` |
| `border-emerald-*` | `border-success` (fallback: `border-border`) |

Green/teal → map to success.

### Phase 5: amber/yellow/orange + violet/purple/fuchsia + hex literals

- amber/yellow/orange → `warning` family (use `bg-warning/10`, `text-warning`, `bg-warning`)
- violet/purple/fuchsia → `processing` family (use `bg-processing/10`, `text-processing`)
- Hex literals (`#2563EB`, etc.) → match to closest token via `globals.css` lookup

## Per-phase workflow

For EACH phase (1 through 5):

1. **Grep** for the color family pattern in `app/` + `components/` (exclude tests/stories).
2. **Filter** to relevant matches (exclude comments, strings, stories).
3. **Apply mappings** above. Use search-replace with regex.
4. **Per-file spot-check**: open 1-2 modified files, verify syntax correct.
5. **TypeScript check**: `npx tsc --noEmit` clean.
6. **Build check**: `npm run build` success.
7. **Visual smoke**: dev server `npm run dev`, visit 2-3 representative pages, verify no obvious visual breakage (colors look right, layout intact).
8. **Commit**: `Antigravity ui: TOKEN-SWAP phase N - <color family> → tokens (UI-REMED-1/<N>)`.
9. **Append to tracking**: note phase done + any deviations.

**Do NOT run tests** for this task — these are className string changes, no behavior changes. TS check + build is enough.

## Stop conditions (per phase)

STOP the entire task and write final report if:

- TypeScript errors that can't be resolved by reverting 1-2 changes.
- Build fails with non-color-related errors.
- Visual regression severe (layout breaks, components unrecognizable) on a route.
- You've worked > 6 hours (safety cutoff).
- You've completed all 5 phases (then write final report).

When stopping mid-phase: commit what's done, note in commit body where you stopped.

## Final report format

Create `docs/reports/ui-remed-1-overnight-report.md` with this structure:

```markdown
# UI-REMED-1 TOKEN-SWAP Overnight Report

Date: 2026-07-17 → 2026-07-18 (overnight)
Owner: Antigravity (async)
Reviewer: Claude (pending, morning)

## Summary

- Phases completed: N/5
- Total occurrences migrated: ~N / 1105
- Total commits: N
- Time spent: ~Nh

## Per-phase status

### Phase 1: gray/slate/zinc/neutral/stone
- Status: COMPLETE | PARTIAL | SKIPPED
- Occurrences migrated: N
- Files touched: N
- Commit: `<sha>`
- Notes: <any deviations, ambiguities, token gaps>

### Phase 2-5: (same structure)

## Token gaps discovered

- List any old colors with no clean token equivalent
- Suggest new tokens to add (for future task)

## Visual smoke test results

Per phase, list:
- Pages visited (URLs)
- Visual outcome: PASS | MINOR_DIFF | REGRESSION
- Screenshot paths if regression (save to scratch/ui-remed-1/)

## TypeScript + Build status

- Final `tsc --noEmit`: PASS | FAIL
- Final `npm run build`: PASS | FAIL

## Push status

- Confirm: NO `git push` executed at any point. Local commits only.

## Pending Claude review

- Token mapping decisions to verify
- Visual regressions to assess
- Token gaps to decide (add new tokens or accept)
```

## Priority

P2 → P1 promotion (user pickup, async). Antigravity solo. Multi-hour.

Model per `docs/COLLABORATION.md` Section G: `Gemini 3.5 Flash (High)` — bulk mechanical work + autonomous decisions on token mappings + self-verification.

## Questions (Claude pre-review, morning)

These will be reviewed by Claude in the morning:

1. Are token mappings semantically correct? (especially gray-600/700 boundary)
2. Did phases complete in order, or any skipped?
3. Any visual regression that warrants follow-up fix task?
4. Should new tokens be added to fill gaps? (separate task)

## Constraints recap

- **NO PUSH** (critical)
- Commit per phase
- Self-verify per phase before next
- Final report required for morning review
- Token gap documentation > silent wrong mapping
