# Roadmap — Pending Work

Single source of truth for pending tasks, priorities, and scope boundaries. Updated when tasks are added, started, completed (move to `COMPLETED.md`), or blocked.

## How to use this file

- **Start of session:** read this file to know what to work on
- **Add new task:** append to appropriate priority queue with owner + scope
- **Start task:** mark status, mention in commit body
- **Complete task:** move entry to `COMPLETED.md`, remove from here
- **Block task:** move to "Blocked" section with reason

## Active agents & scope

| Agent | Role | Owns | Reviews |
|---|---|---|---|
| Claude (GLM 5.1) | Coordinator | `docs/**/*.md`, root `*.md`, deploy, tracking | All cross-scope changes |
| Codex (GPT 5.5) | Engine | `lib/*.ts`, `supabase/migrations/*.sql`, `scripts/*.ts` | Engine/data correctness |
| Antigravity (Gemini 3.1) | UI | `app/**/*.tsx`, `components/**/*.tsx` | UX, accessibility, visual QA |

Detailed scope rules: `docs/COLLABORATION.md` section C (Risk-Boundary Ownership).

## Commit protocol for parallel work

**When 2+ agents active simultaneously, Claude serializes commits:**

1. Agent A works → commits → signals Claude
2. Claude reviews diff → approves or requests changes
3. Claude signals Agent B to start
4. Repeat

**Never run concurrent commits.** Past incidents: bundled commits required `git reset --hard` + cherry-pick to split.

**Cross-scope exception (small fixes):** <10 lines, 1 file, explicit Claude approval. Document in commit body.

## Priority queue

### P0 — In progress now

| Task | Owner | Scope | Started | Notes |
|---|---|---|---|---|
| (none) | — | — | — | See `COMPLETED.md` for recent closures. |

### P1 — Next up (high impact, unblocked)

| Task | Owner | Scope | Prompt | Blocked by |
|---|---|---|---|---|
| (none) | — | — | — | — |

### P1 — Next up (high impact, unblocked)

| Task | Owner | Scope | Prompt | Blocked by |
|---|---|---|---|---|
| [~A] **POS-REDESIGN-1 Session 3. Polish + transitions + final mobile verify** | Antigravity | UI: micro-transitions, edge cases, final mobile audit | `docs/handoffs/2026-07-17-antigravity-pos-redesign-1-session-3.md` (Claude authored 2026-07-17). Session 1+2 done. Polish pass: smooth transitions, edge cases (empty/error/many-items), final 375px verify. ~1 session. | (unblocked) |

### P2 — Backlog (medium impact, post-push remediation from Phase 1 audit)

| Task | Owner | Scope | Notes |
|---|---|---|---|
| **H1. Push local commits** | Claude | git | After POS-REDESIGN-1 Session 3 visual smoke. 35+ commits local pending. |

### P3 — Depends on verification

| Task | Owner | Notes |
|---|---|---|
| **V1. First real operator backdate verify** | Claude | Wait for operator to backdate PO (frequency: weekly per user interview). Walk through UI: list → detail → approve → verify drift = 0. |

### Blocked — needs decision or unblock

| Task | Blocker | Resolution path |
|---|---|---|
| (none) | — | — |

## Out of scope (do not start without explicit approval)

- **Negative stock recovery** (ING-001, ING-021, NNL-003, NNL-006) — needs physical count decision from user
- **Franchise system** — separate phase, needs design + business rules (multi-tenant RLS, franchisee role, outlet management)
- **Historical data rewrite** — any rewrite of pre-2026-07 data requires explicit user approval + dry-run + atomic transaction
- **Auth system overhaul** — placeholder "admin" reviewer in backdate UI is a known gap, but full auth is separate scope
- **Full system audit program** (Pre-Audit A/B/C + 8 gates + 4 phases) — comprehensive multi-month audit per `docs/superpowers/specs/2026-07-17-full-system-audit-program.md`. **Owner trigger required.** Not active until owner confirms scope/priority/production-data access.

## Pending prompts in `docs/handoffs/`

These prompts are ready for agents to pick up. Prompts for completed tasks remain as historical record.

- `2026-07-17-antigravity-pos-redesign-1-session-3.md` → POS-REDESIGN-1 Session 3 (P1, ready for Antigravity)
- `2026-07-17-antigravity-pos-redesign-1-session-2.md` → POS-REDESIGN-1 Session 2 — historical reference, work complete (commit `c61f5a1`)
- `2026-07-17-antigravity-pos-redesign-1-session-1.md` → POS-REDESIGN-1 Session 1 — historical reference, work complete (commit `a3682db`)
- `2026-07-17-antigravity-ui-remed-6-remove-stickybar.md` → UI-REMED-6 — historical reference, work complete (commit `7eecf7e`)
- `2026-07-17-antigravity-ui-remed-1-token-swap-overnight.md` → UI-REMED-1 — historical reference, work complete (5 phases: `c33033f` + `8f93742` + `d239cbb` + `55ef69d` + `ee33450`)
- `2026-07-17-antigravity-ui-remed-5-polish.md` → UI-REMED-5 — historical reference, work complete (commit `11c566b`))
- `2026-07-17-antigravity-ui-remed-4-boundaries.md` → UI-REMED-4 — historical reference, work complete (commit `c923086`)
- `2026-07-17-antigravity-ui-remed-3-session-2.md` → UI-REMED-3 Session 2 — historical reference, work complete (commit `2f91b3f`)
- `2026-07-17-antigravity-ui-remed-3-session-1.md` → UI-REMED-3 Session 1 — historical reference, work complete (commit `dd51dae`)
- `2026-07-16-antigravity-ui-remed-2-sticky-filter-bar.md` → UI-REMED-2 — historical reference, work complete (commit `6b65aba`)
- `2026-07-16-codex-task-3.10-audit-display.md` → Task 3.10 — historical reference, work complete (commit `6a5bdec`)
- `2026-07-16-codex-task-3.5-cohort-aware-audit.md` → Task 3.5 — historical reference, work complete (commit `c28319d`)
- `2026-07-16-codex-task-3.9-historical-gap-lock.md` → Task 3.9 — historical reference, work complete (commit `09bf26a`)
- `2026-07-16-codex-task-3.8-backdated-events-surface.md` → Task 3.8 — historical reference, work complete (commit `ad7f7ba`)
- `2026-07-16-codex-task-3.7-btp-drift-lock.md` → Task 3.7 — historical reference, work complete (commit `d2177ca`)
- `2026-07-15-codex-task-3.6-forward-drift-investigation.md` → Task 3.6 — historical reference, work complete (commit `d32d4d4`)
- `2026-07-15-codex-task-3.4-outside-cohort-investigation.md` → Task 3.4 — historical reference, work complete (commit `fea097d`)
- `2026-07-09-codex-modifier-recipe-hardening.md` → E1 (Task 1) — historical reference, work complete
- All other prompts in `docs/handoffs/` reference completed work — see `COMPLETED.md` for outcomes

## Quick links

- Completed work archive: `docs/COMPLETED.md`
- Detailed chronicle log: `DEVELOPMENT-TRACKING.md`
- Protocol: `docs/COLLABORATION.md`
- UI audit reference: `docs/audits/2026-07-06-ui-consistency-audit.md`
- MAC drift baseline: `docs/audits/2026-07-09-mac-drift-baseline-audit.md`
- Backdated ledger investigation: `docs/audits/2026-07-09-prod-028-btp-shortfall-investigation.md`
- **Full system audit program** (future, owner-triggered): `docs/superpowers/specs/2026-07-17-full-system-audit-program.md`

## Change log

- 2026-07-17 Claude: UI-REMED-1 saga closed. All 5 phases done (commits `c33033f` + `8f93742` + `d239cbb` + `55ef69d` + `ee33450`). ~94% color migration coverage (145 raw occurrences remain — ui/* primitives + gradient stops + complex utility classes). TS clean, build clean, 403/403 tests pass. Visual smoke test pending. UI-REMED saga 5/5 + 1 polish complete. ROADMAP cleaned up duplicate P1 sections.
- 2026-07-17 Claude: UI-REMED-1 async overnight brief authored. User sleeping, Antigravity authorized to run 5-phase TOKEN-SWAP migration overnight. NO PUSH rule. Final report to `docs/reports/ui-remed-1-overnight-report.md` for morning Claude review.
- 2026-07-17 Claude: UI-REMED-5 closed (commit `11c566b`, reviewed). Button warning variant + Dialog icons by variant. UI-REMED saga 4/5 + 1 polish complete. ROADMAP cleaned up duplicate P1 sections. Only UI-REMED-1 TOKEN-SWAP remaining (P2, largest, multi-session).
- 2026-07-17 Claude: UI-REMED-4 closed (commit `c923086`, reviewed). Root error/loading boundaries + 5 missing loading.tsx. UI-REMED saga 4/5 done. P1 cleared. Last: UI-REMED-1 TOKEN-SWAP.
- 2026-07-17 Claude: UI-REMED-3 Session 2 closed (commit `2f91b3f`, reviewed). All 52 native alert/confirm migrated to Dialog API. Independent grep confirms 0 remaining. UI-REMED-3 saga complete (Sessions 1+2). P1 cleared.
- 2026-07-17 Claude: UI-REMED-3 Session 1 closed (commit `dd51dae`, reviewed). Dialog API + components + proof-of-concept migration done. Opened Session 2 (bulk migrate 53 call sites across 18 files) as new P1.
- 2026-07-17 Claude: UI-REMED-3 split into 2 sessions. Authored Session 1 handoff (Dialog primitive + lib/dialog imperative API + DialogHost + proof-of-concept migration). Session 2 (bulk migration 53 call sites) deferred to next handoff.
- 2026-07-16 Claude: UI-REMED-2 closed (commit `6b65aba`, reviewed). StickyFilterBar redesigned with design tokens, API + sticky + mobile expand preserved. 16 clients auto-inherit. P1 cleared → next UI-REMED-3 REPLACE-ALERT.
- 2026-07-16 Claude: Task 3.10 closed (commit `6a5bdec`, reviewed). Audit OPERATIONALLY CLEAN exit 0. MAC drift saga complete (E3 → Task 3.10). P1 cleared.
- 2026-07-16 Claude: User + Codex chose Task 3.10 Option B (accept informational, no DB write) + improve audit display. Authored handoff brief. Small scope ~30 min Codex.
- 2026-07-16 Claude: Task 3.5 closed (commit `c28319d`, reviewed). 4-bucket classifier + sub-classification for LOCKED_VIOLATION. 16 LOCKED_VIOLATION_REPLAY surfaced = E3 baseline lines also affected by BTP drift. Opened Task 3.10 (P1, user decision required: re-classify vs accept).
- 2026-07-16 Claude: User picked up Task 3.5 (cohort-aware MAC drift baseline audit) after Phase 3 push. Authored handoff brief. Promoted from P3 to P1. Other Task 3.5 P3 items remain deprioritized (V1 wait-for-event, UI-CONSISTENCY-1).
- 2026-07-16 Claude: Stabilization Phase 3 closed. Build gate passed, 2 close-out commits (`86f2b89` + `3a55939`), fast-forward push to `origin/main` (HEAD now `3a55939`). 50+ commits live on GitHub. Vercel auto-deploys. Stabilization saga complete.
- 2026-07-16 Claude: Stabilization Phase 2 closed (commits `98557ed` + `0fb8f9d` + `9dddc4a`, reviewed). Production verified: Apps Script pull-model, 32 tables, daily+monthly retention, file xuất hiện trong Drive. Backup ownership added to COLLABORATION.md Section C (Codex owns backup architecture). P1 cleared → opened Stabilization Phase 3 (push 70+ commits) as new P1.
- 2026-07-16 Claude: Task 3.9 closed (commit `09bf26a`, reviewed). MAC drift audit fully clean (436 locks). Phase 1 UI audit closed (commit `cdc8d56`, reviewed). 1279 issues → 4 post-push remediation backlog items (UI-REMED-1 to 4). P1 cleared → opened Stabilization Phase 2 (Drive backup) as new P1.
- 2026-07-16 Claude: Task 3.8 closed (commit `ad7f7ba`, reviewed). 41 lines map to 5 historical ledger rows, 0 durable events (migration 0014 gap). User chose Option A (accept as drift). Authored Task 3.9 handoff brief for lock cohort.
- 2026-07-16 Claude: User chose walk-through approach A (Codex surface first). Authored Task 3.8 handoff brief for read-only investigation: map 41 BACKDATED_LEDGER_LIKE line IDs to `backdated_ledger_events` + status breakdown. Old P2 "Task 3.2 review path" row removed (subsumed by Task 3.8 in P1).
- 2026-07-16 Claude: Task 3.7 final review approved (commit `d2177ca`). 170 → 395 locks, 225/225 cost unchanged, idempotent rerun `ALREADY_APPLIED`. Moved to `COMPLETED.md`; P1 cleared. MAC drift audit clean except 41 BACKDATED_LEDGER_LIKE (Task 3.2 path).
- 2026-07-16 Claude: User chose Option B (accept + lock). Authored policy doc `docs/audits/2026-07-16-btp-recipe-replay-drift-policy.md` and handoff brief `docs/handoffs/2026-07-16-codex-task-3.7-btp-drift-lock.md`. Task 3.7 marked `[~X]`, ready for Codex pickup.
- 2026-07-15 Claude: Task 3.6 closed (commit `d32d4d4`, Claude reviewed). Root cause: nested BTP recipe snapshot not pinned in audit replay; stored COGS correct at sale time. Opened Task 3.7 as P1 decision task (user picks remediation path A/B/C).
- 2026-07-15 Claude: Task 3.4 closed (commit `fea097d`, Claude reviewed). Moved to `COMPLETED.md`. Opened Task 3.6 forward-drift investigation as new P1. Added 2 backlog items: 41 BACKDATED_LEDGER_LIKE review path, 112 historical drift acceptance decision.
- 2026-07-15 Claude: authored Task 3.4 read-only handoff brief (`docs/handoffs/2026-07-15-codex-task-3.4-outside-cohort-investigation.md`). P1 ready for Codex pickup. Marked `[~X]` in priority queue.
- 2026-07-15 Claude: E3 final review complete. Six cohort gates pass, audit trail intact (snapshot/source/run IDs), rollback procedure documented. E3 moved to `COMPLETED.md`; P0 cleared.
- 2026-07-13 Codex: closed E3 after atomic 40-line recovery and added Task 3.4/3.5 follow-ups.
- 2026-07-10 Claude: created as single source of truth. Superseded `docs/handoffs/2026-07-09-codex-roadmap.md` and `docs/handoffs/2026-07-06-antigravity-roadmap.md` (both deleted).
