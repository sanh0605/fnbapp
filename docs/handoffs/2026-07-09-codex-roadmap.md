# Codex Roadmap — Pending Engine Work

Date: 2026-07-09
Owner: Codex (Engine Lead)
Coordinator: Claude (review + prompts)
Token status: refreshed (2026-07-09)

## Goal

Inventory all pending engine work in Codex's scope. Each task has its own prompt file with detailed instructions. Codex picks up tasks in priority order, commits per task, Claude reviews each commit.

## Task List (priority order)

| # | Task | Impact | Effort | Prompt File | Status |
|---|---|---|---|---|---|
| 1 | Modifier recipe save hardening (Phase 1.5) | Data integrity | Medium | `2026-07-09-codex-modifier-recipe-hardening.md` | 🔄 Prompt ready |
| 2 | Migration RPC idempotency edge case | Robustness | Small | `2026-07-09-codex-idempotency-fix.md` | 🔄 Prompt ready |
| 3 | MAC drift baseline recovery | Financial accuracy | Medium-Large | `2026-07-09-codex-mac-drift-recovery.md` | 🔄 Prompt ready |
| 4 | Timezone display evaluation | UX polish | Small | `2026-07-09-codex-timezone-eval.md` | 🔄 Prompt ready |

## Recommended order

1. **Task 1** (modifier recipe) — same pattern as product recipe save. Self-contained, fast.
2. **Task 2** (idempotency edge case) — small fix, closes migration phase cleanly.
3. **Task 3** (MAC drift) — bigger investigation + recovery. Do after 1+2.
4. **Task 4** (timezone) — UX polish, lowest risk. Do last.

Tasks 1+2 are independent. Task 3 may benefit from Task 2's learnings (transaction patterns). Task 4 is pure UX read-only audit.

## Workflow per task

1. **Pick task** in priority order
2. **Read prompt file** completely
3. **Implement** following the prompt
4. **Verify** per the prompt's verification section (tsc + vitest baseline 308+)
5. **Commit** with suggested message
6. **Push** (or signal Claude to push)
7. **Claude reviews** the diff
8. **Move to next task** after Claude confirms

## Critical rules

- **One commit per task** — clean rollback
- **Surgical changes** — touch only files specified
- **Verify before commit** — tsc + vitest must pass
- **Pre-commit hook** — never use `--no-verify`
- **For migrations/financial changes** — dry-run + atomic transaction + idempotency required
- **Update DEVELOPMENT-TRACKING.md** at end of each task
- **No `any` types** — explicit typing required
- **Use existing helpers** — `lib/mac-cogs.ts`, `lib/supabase.ts`, `lib/recipe-selection.ts`, `lib/format.ts`, `lib/datetime.ts`

## Out of scope for Codex

These items belong to Antigravity (UI):
- Any `.tsx` UI changes (forms, pages, components)
- Tailwind classes / styling
- Form labels, aria-* attributes
- URL state sync
- DOM structure

If an engine fix requires UI change, stop and ask Claude to write an Antigravity prompt.

## Pending work (out of current scope)

- Negative stock recovery (ING-001, ING-021, NNL-003, NNL-006) — needs physical count decision
- These require user input first, then either Codex (recovery script) or manual entry
