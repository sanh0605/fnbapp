# Antigravity Roadmap — Remaining UI Work

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Coordinator: Claude (review + prompts)

## Goal

Inventory all remaining UI work in Antigravity's scope. Each task has its own prompt file with detailed instructions. Antigravity picks up tasks in priority order, commits per task, Claude reviews each commit.

## Task List (priority order)

| # | Task | Impact | Effort | Prompt File | Status |
|---|---|---|---|---|---|
| 1 | Intl.NumberFormat centralization | Consistency | Medium | `2026-07-06-antigravity-intl-currency.md` | 🔄 Prompt ready |
| 2 | aria-live regions for admin errors | a11y | Medium | `2026-07-06-antigravity-aria-live.md` | 🔄 Prompt ready |
| 3 | Snapshot-first lookup audit (POS cart, reports) | Data integrity | Medium | `2026-07-06-antigravity-snapshot-first-audit.md` | 🔄 Prompt ready |
| 4 | URL state sync scale (Stock, Items, Promotions) | UX | Medium | `2026-07-06-antigravity-url-sync-scale.md` | 🔄 Prompt ready |
| 5 | UI consistency audit (spacing, states) | Polish | Large | `2026-07-06-antigravity-ui-consistency.md` | 🔄 Prompt ready |

## Workflow per task

1. **Pick task** in priority order
2. **Read prompt file** completely before starting
3. **Implement** following the prompt
4. **Verify** per the prompt's verification section
5. **Commit** with the suggested commit message
6. **Push** (or signal Claude to push)
7. **Claude reviews** the diff, suggests fixes if needed
8. **Move to next task** after Claude confirms

## Critical rules

- **One commit per task** — clean history, easy rollback
- **Surgical changes** — touch only files specified in prompt
- **Verify before commit** — tsc + vitest must pass
- **Pre-commit hook** — never use `--no-verify`
- **If blocked** — stop and ask Claude (don't push broken code)
- **Update DEVELOPMENT-TRACKING.md** at end of each task (Antigravity's existing pattern)

## Out of scope for Antigravity

These items belong to Codex (engine):
- Modifier recipe save hardening (Phase 1.5)
- MAC drift baseline recovery
- Migration RPC idempotency edge case
- Timezone display evaluation
- Any `lib/**` non-UI logic
- Supabase migrations
- RPC functions

If a UI fix requires engine change, stop and ask Claude to write a Codex prompt.

## Dependency map

```
Task 1 (Intl) — independent
Task 2 (aria-live) — independent
Task 3 (Snapshot-first) — independent (but may overlap with Task 1 if formatNumber used)
Task 4 (URL sync scale) — depends on pattern from /admin/orders pilot (done)
Task 5 (UI consistency) — best done AFTER Tasks 1-4 (so changes don't conflict)
```

Recommended order: 1 → 2 → 3 → 4 → 5.

## After all tasks complete

UI audit officially CLOSED. Remaining work:
- Codex engine items (5 items listed in DEVELOPMENT-TRACKING.md)
- Mobile app / PWA improvements (out of current scope)
- Performance optimization (separate workstream)
- E2E tests (separate workstream)

## Notes for Antigravity

- Read each prompt fully before starting
- Verify imports exist before using (don't assume)
- Use existing helpers in `lib/datetime.ts` and `lib/format.ts` (after Task 1) as reference patterns
- Match existing code style — Tailwind classes, naming conventions
- If you find a related bug while doing a task, mention it in the commit body but don't fix it inline (separate commit)
