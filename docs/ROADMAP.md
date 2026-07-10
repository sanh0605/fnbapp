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
| (none) | — | — | — | All current work moved to P1 |

### P1 — Next up (high impact, unblocked)

| Task | Owner | Scope | Prompt | Blocked by |
|---|---|---|---|---|
| **U1. Sidebar reorg plan** | Claude (audit) + Antigravity (implement) | `app/admin/layout.tsx` | TBD (Claude writes after this cleanup) | This cleanup commit |
| **E1. Task 1 — Modifier recipe save hardening** | Codex | `lib/`, possibly `app/admin/products/modifiers/` | `docs/handoffs/2026-07-09-codex-modifier-recipe-hardening.md` | None |
| **U2. UI consistency sweep** | Antigravity | 28+ admin pages per `docs/audits/2026-07-06-ui-consistency-audit.md` | TBD | U1 (sidebar reorg informs page hierarchy) |

### P2 — Backlog (medium impact)

| Task | Owner | Scope | Notes |
|---|---|---|---|
| **U3. Backdate page label/group fix** | Antigravity | `app/admin/layout.tsx` | Paused pending U1 reorg decision. Current label "Backdate Cần Duyệt" unclear, current group "Hệ thống" debatable. |
| **E2. Task 3.3 — Investigate remaining 97.6% drift** | Codex | Audit scripts | Backdating explains only 2,906 / 119,782 VND of historical drift. Other ~116k VND source unknown (likely historical backfill). Need read-only investigation before recovery meaningful. |
| **H1. Push local commits** | Claude | git | 14+ commits this session, all local. Push when user confirms batch is stable. |

### P3 — Depends on verification

| Task | Owner | Notes |
|---|---|---|
| **V1. First real operator backdate verify** | Claude | Wait for operator to backdate PO (frequency: weekly per user interview). Walk through UI: list → detail → approve → verify drift = 0. |

### Blocked — needs decision or unblock

| Task | Blocker | Resolution path |
|---|---|---|
| **E3. Task 3 recovery** — Option A lock + Option B recompute 170 baseline | Needs E2 (root cause of 97.6% non-backdating drift) first | Run E2 investigation, then decide recovery scope |

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

- 2026-07-10 Claude: created as single source of truth. Superseded `docs/handoffs/2026-07-09-codex-roadmap.md` and `docs/handoffs/2026-07-06-antigravity-roadmap.md` (both deleted).
