# AGENTS.md

This file applies to Codex CLI and Antigravity in repo `fnbapp`.

The authoritative coordination protocol is:

- `docs/COLLABORATION.md`

Read that file first every session. This file mirrors only the operational subset needed by Codex and Antigravity.

## Session Start Checklist

1. Read this file.
2. Read `docs/COLLABORATION.md`.
3. Read `DEVELOPMENT-TRACKING.md` 3 newest entries.
4. Read `docs/audits/codex-handoff-2026-06-25.md`.
5. Run `git status` and `git log -5`.
6. Pick a `[ ]` task and mark it `[~X]` for Codex or `[~A]` for Antigravity.
7. Work, verify, commit, update tracking and handoff.

## Risk-Boundary Ownership

### Codex Owns Engine/Data Correctness

Codex owns these. If Antigravity changes them, Codex review is required.

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

### Antigravity Owns UI/Frontend

Antigravity owns these. Claude review is required for user-facing UI changes.

- `app/**/page.tsx`
- `app/**/components/*.tsx`
- `components/*`
- Form UX, responsive layouts, modal behavior, mobile QA, visual polish.

If UI changes server actions, data flow, or report math, Codex review is required.

### Claude Owns Specs/Protocol

Claude owns these. Codex review is required for engine/data claims.

- `docs/COLLABORATION.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/superpowers/specs/*`
- `DEVELOPMENT-TRACKING.md`

## Seven Required Rules

1. No silent data writes.
   - Google Sheets write scripts must dry-run by default, print counts, and require `--apply`.

2. Commit per phase.
   - One commit equals one outcome plus verification.
   - Do not mix UI, engine, and data migration.

3. Cross-boundary review required.
   - UI changes server action/data flow: Codex review.
   - Engine changes visible report UI: Antigravity or Claude review.
   - Spec/protocol change: Claude approval first.

4. Handoff freshness.
   - Start with `git status`, `git log -5`, latest tracking, and handoff.

5. No edits in unknown dirty files.
   - Inspect diff before editing files already changed by another agent/user.

6. Audit scripts are first-class deliverables.
   - Engine/data fixes need a read-only audit script or an update to an existing one.

7. Model downgrade gate.
   - Mini/Flash only for low-risk mechanical work.
   - Do not use Mini/Flash for migrations, COGS/FIFO/MAC, auth/transactions, Sheets batch update, or historical reprocessing.

## Merge Gate

Before ending a phase:

- Tests pass: 191+ current baseline.
- TypeScript: 0 errors.
- MAC drift: 0 mismatch.
- P&L MAC consistency: 0 delta when report/COGS changed.
- Relevant ledger/stock audits clean.
- Commit prefix:
  - `Codex <type>:`
  - `Antigravity <type>:`
- Do not push unless the user explicitly asks.

## Repo Coding Rules

- Code/comments: English only.
- User-facing strings: Vietnamese.
- CamelCase.
- No new emojis in code/docs.
- Surgical changes, simplicity first.
- Transactions for critical flows.
- Follow `docs/domain-dictionary.md` for terminology.
