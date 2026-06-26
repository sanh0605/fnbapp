# Collaboration Protocol

This file is the single source of truth for coordinated work in repo `fnbapp`.
All agents read it at the start of every session.

Agents:

- Claude Code / GLM 5.1: coordination, specs, review, surgical fixes, tracking.
- Codex / GPT 5.5: engine, data correctness, migrations, audits, multi-file refactors.
- Antigravity / Gemini 3.1 stable: UI/frontend, responsive layouts, forms, visual QA.

Do not treat ownership as identity-based permission. Ownership follows risk boundary.

## A. File Map

Read before each session:

- `CLAUDE.md` section 0: Claude-specific project instructions.
- `AGENTS.md`: Codex and Antigravity project instructions.
- `docs/COLLABORATION.md`: this protocol.
- `DEVELOPMENT-TRACKING.md`: 3 newest entries.
- `docs/audits/codex-handoff-2026-06-25.md`: active task status.
- `docs/audits/2026-06-25-full-system-audit-roadmap.md`: phase status.
- `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`: MAC/COGS spec.
- `docs/domain-dictionary.md`: terminology when changing labels, sheets, reports, or domain code.

## B. Status Markers

- `[ ]` pending.
- `[~C]` in progress by Claude.
- `[~X]` in progress by Codex.
- `[~A]` in progress by Antigravity.
- `[x]` done and verified.
- `[!]` blocked or needs review.
- `[-]` deferred or wontfix.

Rules:

- Do not delete task items. Preserve audit trail.
- `[x]` needs a short note with who completed it and verification.
- `[!]` and `[-]` need a reason.
- Only one agent should own an in-progress task marker at a time.

## C. Risk-Boundary Ownership

### Engine Files

Codex owns these. If another agent touches them, Codex review is required.

- `lib/mac-cogs.ts`
- `lib/fifo-tracker.ts`
- `lib/inventory-consumption.ts`
- `lib/report-v2-allocators.ts`
- `lib/cogs-drift-audit.ts`
- `lib/mac-cogs-audit.ts`
- `lib/purchase-ledger-rebuild.ts`
- `scripts/*cogs*`
- `scripts/*ledger*`
- `scripts/audit-pnl-mac-consistency.ts`
- `app/admin/orders/actions.ts` transaction/order-mutation paths only.
- `app/pos/actions.ts` transaction paths only.

### UI Files

Antigravity owns these. Claude review is required before commit when the change is user-facing.

- `app/**/page.tsx`
- `app/**/components/*.tsx`
- `components/*`
- Form UX, responsive behavior, modal layout, visual QA.

If UI changes server actions or data flow, Codex review is also required.

### Spec And Protocol Files

Claude owns these. Codex review is required for engine/data claims.

- `docs/COLLABORATION.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/superpowers/specs/*`
- `DEVELOPMENT-TRACKING.md` is append-only unless cleanup is explicitly requested.

## D. Seven Coordination Rules

1. No silent data writes.
   - Any script that writes Google Sheets must support dry-run by default.
   - It must print exact counts and targets.
   - `--apply` is required for writes. No `--apply` means read-only.

2. Commit per phase.
   - One commit equals one outcome plus verification.
   - Do not mix UI, engine, and data migration in the same commit.

3. Cross-boundary review is required.
   - UI changing server action or data flow: Codex review.
   - Engine changing visible report UI: Antigravity or Claude review.
   - Spec/protocol change: Claude approval first, including Codex proposals.

4. Handoff freshness.
   - Start each session with `git status`, `git log -5`, latest tracking, and handoff.
   - Do not rely on stale prompt summaries when the repo has moved.

5. No edits in unknown dirty files.
   - If worktree is dirty, inspect diff before editing the same file.
   - Assume dirty changes belong to another agent or the user.

6. Audit scripts are first-class deliverables.
   - Each engine/data fix should include or update a read-only audit script that verifies the invariant.
   - Unit tests are not enough for Google Sheets data correctness.

7. Model downgrade gate.
   - Mini/Flash models are allowed for rename, pattern-based tests, docs/tracking, mechanical cleanup, and small UI that does not touch actions.
   - Mini/Flash models are not allowed for migration `--apply`, COGS/FIFO/MAC, auth/transactions, Sheets batch update, or historical reprocessing.

## E. Merge Gate

Before ending a work phase, regardless of agent:

- Tests pass: current baseline is 191+ tests.
- TypeScript: 0 errors.
- MAC drift audit: 0 mismatch.
- COGS drift audit: 0 mismatch or explicitly documented as informational.
- P&L MAC consistency audit: 0 delta when report/COGS changed.
- Current stock/order ledger/purchase ledger audits clean when related areas changed.
- Commit prefix:
  - `Claude <type>:`
  - `Codex <type>:`
  - `Antigravity <type>:`
- Do not push unless the user explicitly asks.

## F. Session Start Checklist

1. Read `CLAUDE.md` section 0 or `AGENTS.md`, depending on agent.
2. Read `DEVELOPMENT-TRACKING.md` 3 newest entries.
3. Read `docs/audits/codex-handoff-2026-06-25.md`.
4. Run `git status` and `git log -5`.
5. Pick a `[ ]` task and mark it in-progress with `[~C]`, `[~X]`, or `[~A]`.
6. Do the work.
7. Verify.
8. Commit.
9. Update tracking and handoff from `[~*]` to `[x]`, `[!]`, or `[-]`.

## Current Direction

- COGS valuation: MAC, pinned into `Order_Lines_V2.cost_at_sale`.
- Inventory quantity: `Stock_Ledger.quantity_change`.
- FIFO: audit/debug only, not the primary P&L contract.
- P&L MAC breakdown refactor: implemented by Codex in commits `a63f0b1` and `4bf795c`.
- P&L consistency audit: `scripts/audit-pnl-mac-consistency.ts`.

## Quick Links

- Active handoff: `docs/audits/codex-handoff-2026-06-25.md`
- Roadmap: `docs/audits/2026-06-25-full-system-audit-roadmap.md`
- Script cleanup plan: `docs/audits/script-cleanup-plan.md`
- Domain dictionary: `docs/domain-dictionary.md`
- Tracking: `DEVELOPMENT-TRACKING.md`

## Change Log

- 2026-06-26 Codex: rewrote protocol for 3-agent coordination and risk-boundary ownership.
