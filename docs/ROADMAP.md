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
| [x] **E3. Task 3 selective recovery** | Codex | Engine/data recovery | 2026-07-13 | Complete: 170 locks retained, exact 40-line recovery applied atomically, -933 VND COGS correction, six cohort gates passed. Awaiting final Claude review only. |

### P1 — Next up (high impact, unblocked)

| Task | Owner | Scope | Prompt | Blocked by |
|---|---|---|---|---|
| [ ] **Task 3.4. Investigate 224 outside-cohort MAC mismatches** | Codex | Read-only engine/data investigation | Split 153 historical and 71 post-cutoff lines; classify provenance and determine whether any recovery is justified. | Claude prioritization and a read-only handoff |

### P2 — Backlog (medium impact)

| Task | Owner | Scope | Notes |
|---|---|---|---|
| **H1. Push local commits** | Claude | git | 16+ commits this session, all local. Push when user confirms batch is stable. |

### P3 — Depends on verification

| Task | Owner | Notes |
|---|---|---|
| **V1. First real operator backdate verify** | Claude | Wait for operator to backdate PO (frequency: weekly per user interview). Walk through UI: list → detail → approve → verify drift = 0. |
| [ ] **Task 3.5. Make MAC baseline audit cohort-aware** | Codex | Fix `scripts/audit-mac-drift-baseline.ts` to verify an explicit locked/source-hash cohort and avoid overwriting the reviewed baseline artifact; decide separately whether a new baseline extension is needed. |

### Blocked — needs decision or unblock

| Task | Blocker | Resolution path |
|---|---|---|
| (none) | — | — |

## Out of scope (do not start without explicit approval)

- **Negative stock recovery** (ING-001, ING-021, NNL-003, NNL-006) — needs physical count decision from user
- **Franchise system** — separate phase, needs design + business rules (multi-tenant RLS, franchisee role, outlet management)
- **Historical data rewrite** — any rewrite of pre-2026-07 data requires explicit user approval + dry-run + atomic transaction
- **Auth system overhaul** — placeholder "admin" reviewer in backdate UI is a known gap, but full auth is separate scope

## Pending prompts in `docs/handoffs/`

These prompts are ready for agents to pick up. Prompts for completed tasks remain as historical record.

- `2026-07-09-codex-modifier-recipe-hardening.md` → E1 (Task 1)
- All other prompts in `docs/handoffs/` reference completed work — see `COMPLETED.md` for outcomes

## Quick links

- Completed work archive: `docs/COMPLETED.md`
- Detailed chronicle log: `DEVELOPMENT-TRACKING.md`
- Protocol: `docs/COLLABORATION.md`
- UI audit reference: `docs/audits/2026-07-06-ui-consistency-audit.md`
- MAC drift baseline: `docs/audits/2026-07-09-mac-drift-baseline-audit.md`
- Backdated ledger investigation: `docs/audits/2026-07-09-prod-028-btp-shortfall-investigation.md`

## Change log

- 2026-07-13 Codex: closed E3 after atomic 40-line recovery and added Task 3.4/3.5 follow-ups.
- 2026-07-10 Claude: created as single source of truth. Superseded `docs/handoffs/2026-07-09-codex-roadmap.md` and `docs/handoffs/2026-07-06-antigravity-roadmap.md` (both deleted).
