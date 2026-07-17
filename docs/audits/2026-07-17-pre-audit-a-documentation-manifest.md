# Pre-Audit A Documentation Manifest

Date: 2026-07-17  
Mode: read-only discovery and classification  
Baseline commit: `d1db0c1`

## Executive summary

The inventory covers all 189 in-scope records: 7 root Markdown files, 138 Markdown files under `docs/`, and 44 structured JSON audit artifacts. Preservation-first classification found 14 current authorities and no deletion candidate that met the strict unreferenced + obsolete + no-evidence test. Most volume is intentional history: completed handoffs, implementation plans, audit narratives, migration receipts, and generated evidence. Pre-Audit B should consolidate canonical entry points and archive navigation without deleting recovery, migration, rollback, security, or frozen-baseline evidence.

## Classification breakdown

| Classification | Count |
|---|---:|
| CURRENT | 14 |
| HISTORICAL_EVIDENCE | 115 |
| SUPERSEDED | 8 |
| DUPLICATE | 1 |
| GENERATED_ARTIFACT | 51 |
| DELETE_CANDIDATE | 0 |

All counts reconcile to **189**. Each individual record, its Git update, consumers, claim check, successor, risk, and preservation rule is stored in the companion JSON manifest.

## Method and scope

- Enumerated root `*.md` plus every `*.md` and `*.json` under `docs/**`.
- Excluded dependency/build/temp/output/gitignored paths and the two manifests being generated.
- Applied the approved bulk rules: all 47 completed handoffs are historical evidence; all 44 JSON files are generated artifacts kept as evidence.
- For remaining documents, inspected title/intro, Git last update, exact-path consumers, concrete repository paths named in backticks, current canonical docs, and targeted code anchors.
- No application, database, migration, or production operation was executed.

## Highlighted contradictions

- **README.md vs current code (package.json, app/, Vercel configuration):** README claims vanilla HTML/CSS/JS, GitHub Pages, and localStorage auth; current application is Next.js/TypeScript on Vercel with server-side Supabase-backed authentication.
- **TASK.md vs docs/ROADMAP.md:** April foundation tasks remain unchecked although the Next.js/Supabase/V2 system is implemented; ROADMAP is the current task authority.
- **ARCHITECTURE.md vs current lib/, app/, and scripts/ trees:** Generated architecture map predates the Supabase, MAC drift, backup, dialog, and later UI remediation modules.
- **docs/audits/system-optimization-roadmap.md vs docs/ROADMAP.md:** Old roadmap still presents Supabase migration and other completed work as pending; ROADMAP/COMPLETED hold current status.
- **docs/superpowers/plans/2026-07-16-stabilization-phase.md vs docs/COMPLETED.md:** Plan header says pending approval while stabilization Phase 1-3 is completed and pushed.
- **docs/audits/2026-07-16-task-3.8-backdated-events-surface.md vs docs/audits/2026-07-16-task-3.9-lock-result.md:** Task 3.8 narrative says awaiting review/operator decision; Task 3.9 records the approved follow-up lock as complete.
- **docs/operations/apps-script-drive-backup.md vs docs/audits/2026-07-16-drive-backup-policy.md:** Runbook still warns not to deploy before approval, but the policy/tracking record shows Phase 2 deployed, verified, and closed.
- **docs/superpowers/specs/2026-07-17-full-system-audit-program.md vs docs/handoffs/2026-07-17-codex-pre-audit-a-documentation.md:** Program header says pending owner trigger while Pre-Audit A is now explicitly triggered and in progress.

## P0 exposure findings

| File/check | Status | Business impact |
|---|---|---|
| `app/api/diagnose-order/route.ts` | CONTAINED | The formerly public production read/write surface is no longer deployable from current HEAD. |
| `app/admin/audit/backdated-ledger/actions.ts` | CONTAINED | The action is route-protected for normal application access; the missing action-local authorization is a hardening gap, not an unauthenticated public route in the reviewed deployment model. |
| `app/pos/actions.ts` | CONTAINED | Normal POS navigation is authenticated by middleware; actor attribution can degrade to system if the server action executes without a resolved session. |
| `app/admin/users/actions.ts` | EXPOSED | Authenticated admin browser payloads may contain password hashes even though the UI does not render them. This expands credential exposure to browser tooling, extensions, and any admin-scope XSS; remove password_hash before crossing the server/client boundary in Phase 0/3 security hardening. |

Evidence and exact file-line snippets are in the JSON manifest. No fix is included in Pre-Audit A.

## Recommended actions for Pre-Audit B

1. Rewrite `README.md` for the current Next.js/Vercel/Supabase architecture and link the canonical roadmap, protocol, domain dictionary, testing commands, backup runbook, and audit entry point.
2. Retire `TASK.md` as an active checklist and preserve it as early product history; use only `docs/ROADMAP.md` for pending work.
3. Refresh agent entry documents so they no longer point to the 2026-06-25 roadmap/handoff as active sources.
4. Add an archive index for completed handoffs, plans, specs, audit narratives, and generated artifacts; do not move files until references are migrated and owner approval is recorded.
5. Update stale status banners in the stabilization plan, Task 3.8 report, backup runbook, and full-audit program without changing their historical evidence sections.
6. Define a regeneration/immutability registry for generated artifacts, especially frozen MAC baselines and production-write receipts.

## Suggested archive set

- `CONTEXT.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `README.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `TASK.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/TESTING.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-06-25-full-system-audit-roadmap.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-06-26-folder-cleanup-proposal.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-01-recovery-snapshot-receipt.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-02-pos-checkout-performance-review.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-02-purchase-cost-recovery-result.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-02-purchase-order-safety-deployment.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-04-hong-tra-chanh-migration-audit.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-04-ui-audit.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-06-snapshot-first-audit.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-06-ui-consistency-audit.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-09-backdated-ledger-pattern.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-09-prod-028-btp-shortfall-investigation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-09-timezone-display-eval.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-11-design-system-pre-audit.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-12-fresh-blue-admin-final-report.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-13-task-3-recovery-result.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-13-task-3.3-drift-investigation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-15-task-3.4-outside-cohort-investigation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-15-task-3.6-forward-drift-investigation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-16-task-3.7-lock-result.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-16-task-3.8-backdated-events-surface.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/2026-07-16-task-3.9-lock-result.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/antigravity-handoff-2026-07-01.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/codex-handoff-2026-06-25.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/system-optimization-roadmap.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/audits/web-interface-guidelines.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-04-antigravity-phase-bc-combined.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-04-codex-recipe-cleanup-migration.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-a11y-forms-touch.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-aria-live.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-diacritics-sweep.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-intl-currency.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-orders-snapshot-fallback.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-orders-url-sync.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-snapshot-first-audit.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-ui-consistency.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-06-antigravity-url-sync-scale.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-antigravity-phase-b-fixes.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-codex-backdated-receipt-pipeline.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-codex-idempotency-fix.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-codex-idempotency-precision-fix.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-codex-mac-drift-recovery.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-codex-modifier-recipe-hardening.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-codex-prod-028-btp-shortfall-investigation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-codex-timezone-eval.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-09-codex-timezone-implementation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-10-antigravity-backdated-ledger-ui.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-10-antigravity-sidebar-reorg.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-10-antigravity-ui-sweep.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-10-codex-task-3-2-phase-e.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-12-antigravity-u5-modifiers-migration.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-12-codex-p1-cursor-pagination.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-13-codex-task-3-recovery.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-13-codex-task-3.3-drift-investigation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-15-codex-task-3.4-outside-cohort-investigation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-15-codex-task-3.6-forward-drift-investigation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-16-antigravity-ui-remed-2-sticky-filter-bar.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-16-codex-task-3.10-audit-display.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-16-codex-task-3.5-cohort-aware-audit.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-16-codex-task-3.7-btp-drift-lock.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-16-codex-task-3.8-backdated-events-surface.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-16-codex-task-3.9-historical-gap-lock.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-pos-redesign-1-session-1.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-pos-redesign-1-session-2.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-pos-redesign-1-session-3.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-ui-remed-1-token-swap-overnight.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-ui-remed-3-session-1.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-ui-remed-3-session-2.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-ui-remed-3-verify-checklist.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-ui-remed-4-boundaries.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-ui-remed-5-polish.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-antigravity-ui-remed-6-remove-stickybar.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/handoffs/2026-07-17-codex-pre-audit-a-documentation.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/reports/ui-remed-1-overnight-report.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/reports/ui-remed-3-verification.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/runbooks/orders-v2-cutover.md`: 1 files; retain as evidence or archive only after canonical links are preserved.
- `docs/superpowers/plans`: 23 files; retain as evidence or archive only after canonical links are preserved.
- `docs/superpowers/specs`: 21 files; retain as evidence or archive only after canonical links are preserved.

Archive means navigation consolidation or a future approved move, not deletion. Migration/recovery receipts, rollback instructions, frozen baselines, historical decisions, and compliance/security evidence must remain retrievable.

## Suggested deletion set

No document qualifies for deletion in this baseline. `docs/audits/web-interface-guidelines.md` is a low-risk duplicate, but archive/consolidation is safer until Pre-Audit B migrates any implicit workflow reference.

## Verification

- Source inventory expected: 189.
- Classification sum: 189.
- JSON schema keys and per-document required fields are populated.
- Production writes: none.
