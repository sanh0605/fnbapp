# Post-Audit Repository Reorganization — Proposal

Per `docs/ROADMAP.md`'s "Future direction" item 2 and `docs/FILE-ORGANIZATION.md`'s
"reorganization pass" section: a proposed pass over existing files. Per the
D8 decision, **nothing here executes until the owner approves** — this is
the proposal, not the action.

## 1. `scripts/` DELETE_ONE_OFF batch

Fresh classification: `docs/audits/script-cleanup-plan.md` (2026-07-20,
regenerated after fixing a classifier bug — see section 4). Fresh reference
check: `docs/audits/2026-07-20-script-deletion-verification.md`.

Of the 62 DELETE_ONE_OFF-classified scripts, cross-referenced each one
against every other script/lib file (not just docs) to separate "nothing
depends on this" from "something would break if deleted":

### 1a. Propose deleting now (56 scripts — zero real code dependents)

35 with zero references anywhere, plus 21 more referenced only by
historical `docs/audits/`/`docs/handoffs/` files (deleting the script
doesn't corrupt those records — they stay as "here's what this script
found," same as any historical audit trail entry referencing a
since-superseded tool):

`benchmark-pos-checkout-reads.ts`, `canonicalize-dau-say-modifier-snapshots.ts`,
`debug-mac.ts`, `debug-nnl002-mac.ts`, `delete-test-recipe.ts`,
`diagnose-backup-sheet.ts`, `diagnose-mac-drift-root-cause.ts`,
`diagnose-purchase-cost-rounding.ts`, `diagnose-sales-pnl-date-range.ts`,
`dump-macs.ts`, `find-high-cost.ts`, `fix-pos-47.ts`, `fix-pos.ts`,
`hash-user-passwords.ts`, `inspect-broken-pos.ts`, `inspect-mac-drift-line.ts`,
`inspect-new-pos.ts`, `inspect-phin-di-variants.ts`, `inspect-toppings.ts`,
`print-all-costs.ts`, `search-caramel.ts`, `search-product-caramel.ts`,
`test-discount-types.ts`, `test-discount-types2.ts`, `test-insert-recipe.ts`,
`test-recipe-parse.ts`, `truncate-backup-sheet.ts`, `u5-components.js`,
`u5.js`, `verify-june-2026-import.ts`, `verify-pos-checkout-idempotency.ts`,
`verify-purchase-order-atomic-rollback.ts`, `verify-sheet-supabase-parity.ts`,
`verify-shim-pagination.ts`, `verify-topping-pos-catalog.ts`
(the 35 zero-reference set), plus:
`benchmark-shim.ts`, `capture-recovery-snapshot.ts`,
`capture-task-3-recovery-snapshot.ts`, `debug-prod-028-btp-shortfall.ts`,
`diagnose-negative-stock.ts`, `import-june-2026-sales.ts`,
`investigate-gate4-mac-drift-12-lines.ts`, `investigate-task-3-3-drift.ts`,
`investigate-task-3.4-outside-cohort.ts`, `investigate-task-3.6-forward-drift.ts`,
`investigate-task-3.8-backdated-events-surface.ts`, `plan-purchase-cost-recovery.ts`,
`probe-pos-order-rollback.ts`, `recompute-backdated-event.ts`,
`resolve-negative-stock.ts`, `setup-topping-standalone.ts`, `supabase-ping.ts`,
`test-supabase-cap.ts`, `verify-backdated-detection-end-to-end.ts`,
`verify-recovery-snapshot.ts`, `verify-task-3-recovery.ts`.

Plus one untracked, gitignored file with zero code references at all:
`print-recipe-json.ts` (never committed to git — `.gitignore:98` excludes
it — safe to delete along with that now-unnecessary `.gitignore` line).

### 1b. Do NOT delete (5 scripts — real code dependencies)

- `batch-sheets-orders.ts` — imported by 4 `ARCHIVE_DOC_ONLY` scripts
  (`backfill-inferred-high-promo-id.ts`, `backfill-orders-subtotal.ts`,
  `clear-combo-order-discount.ts`, `remigrate-per-audit.ts`). Those 4 are
  themselves being kept (see section 2), so this one must stay too.
- `verify-pnl-patterns.ts` — imported by `re-migrate-v1-to-v2.ts`
  (`KEEP_MIGRATION_HISTORY`).
- `verify-v2-schema.ts` — imported by `create-v2-sheets.ts` (`KEEP_RUNBOOK`).
- `verify-delete-candidates.ts` — this is the tool that generated the
  verification report this whole proposal is based on. Its own
  classifier miscategorized it as `DELETE_ONE_OFF` (only referenced by
  docs, by the heuristic) — but it's an active, reusable process tool
  (referenced in `docs/COLLABORATION.md` as the established Phase 6.2
  process). Recommend manually keeping it; not fixing the classifier a
  third time tonight for one entry — flagging here is simpler and safer.
- (Implicitly kept: all 20 `KEEP_MIGRATION_HISTORY`, 20 `KEEP_RUNBOOK`,
  85 `KEEP_AUDIT` scripts — untouched by this proposal.)

**Action if approved**: delete the 56 scripts (section 1a) in one commit,
citing this plan and the verification report as evidence.

## 2. `scripts/` ARCHIVE_DOC_ONLY batch (33 scripts)

Recommend: **do nothing this pass.** The cleanup plan's own suggestion
("move to `docs/audits/archive-scripts.md`, listing only") would require
writing a meaningful doc entry per script (not just a filename dump) and
would also let `batch-sheets-orders.ts` (section 1b) become deletable —
that's a second, separate piece of work, not a quick file move. Propose
deferring it to a later, explicitly-scoped pass rather than bundling it
into tonight's cleanup. These scripts cost nothing sitting in `scripts/`
as-is.

## 3. Misplaced docs

- `docs/audits/antigravity-handoff-2026-07-01.md` and
  `docs/audits/codex-handoff-2026-06-25.md` are genuinely handoff briefs
  (task instructions for another agent), not audit/evidence reports —
  they belong in `docs/handoffs/` per `docs/FILE-ORGANIZATION.md`'s
  directory map. **Caveat**: `codex-handoff-2026-06-25.md` is named
  explicitly in `CLAUDE.md`'s "Collaboration files (READ FIRST)" list
  (item 3, "active task tracking với status") — if moved, that reference
  in `CLAUDE.md` must be updated in the same commit, or the session-start
  instructions will point at a path that no longer exists.
- `docs/runbooks/orders-v2-cutover.md` — `docs/runbooks/` isn't in
  `FILE-ORGANIZATION.md`'s directory map at all; `docs/operations/` is
  the documented "living runbook" location. Propose either (a) moving
  this file into `docs/operations/` and deleting the now-empty
  `docs/runbooks/` directory, or (b) adding `docs/runbooks/` to
  `FILE-ORGANIZATION.md`'s directory map as a recognized alias. Recommend
  (a) for a single canonical location, but this is a judgment call, not
  a clear-cut fix.
- `TASK.md` (repo root) — already self-marked `SUPERSEDED` at the top,
  pointing to `docs/ROADMAP.md` as current. Not in `FILE-ORGANIZATION.md`'s
  canonical root set. Options: delete outright (git history preserves it
  if ever needed), or move to a `docs/` historical location. Recommend
  deletion since it's fully superseded and adds no new information beyond
  what git history already has, but this is the owner's call, not an
  obvious one.
- Several `docs/audits/` files predate date-prefix naming and/or are
  living reference docs disguised as audit output (`sheet-cleanup-plan.md`,
  `system-optimization-roadmap.md` — already self-marked `SUPERSEDED`,
  `web-interface-guidelines.md` — already self-marked `DUPLICATE/HISTORICAL`,
  `ui-consistency-2026-07-16.md` — date suffix not prefix). These already
  self-declare their status in-file, so they're not actively causing
  confusion — recommend leaving them as-is rather than renaming
  retroactively (renaming loses the original filename in any external
  references, for cosmetic benefit only).
- `docs/reports/ui-remed-1-overnight-report.md` and
  `ui-remed-3-verification.md` aren't date-prefixed per the
  `docs/reports/` convention. Low-value fix (rename only) — propose
  leaving as-is unless the owner wants strict retroactive compliance.

## 4. Found along the way: 2 real bugs in scripts/ tooling (already fixed)

Not part of the reorganization itself, but surfaced while preparing this
proposal, and already fixed under the owner's standing temporary
authorization (Claude covering Codex's work until 2026-07-25):

- `scripts/generate-script-cleanup-plan.ts`'s classifier had `recover-` in
  its `DELETE_ONE_OFF` keyword list and no `lock-` recognition at all,
  contradicting `docs/FILE-ORGANIZATION.md`'s own documented rule
  ("lock-*/recover-* ... same disposition as migrations"). This
  misclassified `lock-backdated-historical-gap-cohort.ts`,
  `lock-btp-recipe-replay-drift-cohort.ts`, `recover-mac-drift.ts`, and
  `recover-task-3.ts` as one-off deletion candidates — 2 of which have
  real `lib/*.test.ts` dependents that would have broken if deleted per
  the old (wrong) classification. Fixed, tested, regenerated the plan.
  Commit `829fbe3`.

## Verification (once approved and executed)

1. `npx tsc --noEmit`: 0 errors (confirms no remaining script imports a
   deleted file).
2. `npx vitest run`: full suite passes.
3. `npx next build`: succeeds.
4. `git status`: only the intended deletions/moves staged.
5. Single commit (or a small number of clearly-scoped commits) referencing
   this plan and the verification report as evidence.
