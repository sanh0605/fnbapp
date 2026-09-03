# Phase 7 — Empty lib/historical and remove the executed one-off scripts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Critique before coding (CLAUDE.md §1). This deletes code — impact analysis is already done below; re-verify it before each `git rm`.

**Goal:** Honor the owner's "no history-only code" principle (2026-09-04) by removing `lib/historical/` entirely and the three executed one-off scripts, leaving every gate green. The one genuinely-live module hiding in the graveyard (`backup-restore.ts`) is **moved to a normal `lib/` home**, not deleted — it is live restore-safety code, not history.

**Owner decision (2026-09-04):** "Xoá hết (cả script + lib/historical)." Impact analysis then showed `lib/historical` is not fully dead: `backup-restore.ts` is imported by the restore keeper and cited in the incident runbook. The faithful way to still empty the folder is to promote that one module out, then delete the rest — reported to the owner.

**Architecture:** Three moves. (1) Extract `backup-restore.ts` (+ test) to `lib/`, fixing its one importer and the one doc that names it. (2) Delete the 3 one-off scripts and the tests coupled to them. (3) `git rm -r lib/historical`. Then repoint the two tooling files that special-case `lib/historical` and strip comments in kept files that name now-deleted `lib/historical` paths.

**Tech Stack:** git mv / git rm, small TS edits, Markdown edits. Verification is all five gates + `npm run build`.

**Spec:** reset design `docs/superpowers/specs/2026-09-02-project-reset-design.md` (the reset's deletion intent) + the owner's 2026-09-04 principle recorded in memory `no-dead-points-everything-current`.

## Impact analysis (measured 2026-09-04, re-verify before deleting)

- **Only real external coupling INTO `lib/historical` from kept code:** `scripts/restore-backup-to-target.ts:13` → `await import("../lib/historical/backup-restore")` (`assertSafeRestoreTarget`, `restoreBundleToTarget`, `JSONB_NULL_LITERAL_SENTINEL`). `backup-restore.ts` imports nothing from `lib/historical` (self-contained; only `@supabase/supabase-js` and `@/supabase/functions/backup-to-drive/core`).
- **`history-ops/` (26 files)** is imported ONLY by the three to-be-deleted scripts (`lock-backdated-historical-gap-cohort.ts`, `lock-btp-recipe-replay-drift-cohort.ts`, `migrate-hong-tra-to-luc-tra.ts`). Dies with them.
- **False alarms (comments, not imports):** `app/admin/inventory/actions.ts:368` ("historical/production rows"), `scripts/verify-revenue-core.ts:348` (names `lib/historical/history-ops/` in a comment — becomes a dead comment after deletion → strip in Task 3).
- **Governed doc citing `lib/historical`:** only `docs/04-operations/INCIDENT-RESPONSE.md` (the `backup-restore.ts` location) → repoint in Task 1. Grep all governed docs again to be sure.
- **Tests coupled to the deleted scripts:** `lib/backdated-historical-gap-lock-script.test.ts`, `lib/btp-drift-lock-script.test.ts` (both `readFileSync` a lock script), and `lib/historical/history-ops/hong-luc-migration-transaction.test.ts` (inside the folder). Delete with them.
- **Map generator:** `scripts/system-map/generate.ts:27` currently skips `lib/historical` (and `sheets_db`, `lib/shared-actions`). `backup-restore.ts` does writes to a **scratch restore target** (`targetClient.from(table).insert(...)`), not a production flow — so after the move, `lib/backup-restore.ts` must be added to that skip list, or the map gains spurious writes. Current map has **0** `lib/historical` writes (confirmed), so deletion alone does not move the map.
- **docs-refs gate** skips `lib/historical/` in `run-blocking.ts:160`; after deletion that clause is moot — remove it.

## Global Constraints

- **`scripts/` edits go through the implementer; Opus reviews and runs gates independently.**
- **Keep every gate green after each task:** `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, `npm run build`.
- **Deletion is irreversible for the tree** (git history keeps it). Do Task 1 (the move, reversible) fully green BEFORE any `git rm`.
- **Do not touch production data, COGS/inventory logic, or any file outside the impact list.**

---

## Current-state description (mandatory, CLAUDE.md §1b)

1. **States:** each `lib/historical` file is *live* (only `backup-restore.ts` + its test), *script-coupled* (`history-ops/*`, dies with the 3 scripts), or *orphan* (the rest). This task moves live → `lib/`, deletes the other two classes.
2. **Entry points:** none. `restore-backup-to-target.ts` keeps working via the new import path; the incident runbook points at the new path.
3. **In scope / excluded:** IN — moving `backup-restore.ts`(+test); deleting the 3 scripts + 2 coupled `lib/` tests; `git rm -r lib/historical`; fixing `restore-backup-to-target.ts`, `INCIDENT-RESPONSE.md`, `system-map/generate.ts`, `run-blocking.ts`, and the `verify-revenue-core.ts` dead comment. OUT — any other `lib/` code, all app/components logic, production data, the Phase-5 keep decisions for non-historical keepers.
4. **Valid inputs / out-of-range:** a deletion is valid only if, after it, tsc + vitest + all gates stay green. A red gate means a missed importer — stop and restore.
5. **Deliberately NOT served:** no attempt to preserve the deleted audit scripts' output in-tree (git history is the record — the owner's principle); no history-scrubbing of git.

---

## Task 1: Promote backup-restore.ts out of the graveyard (reversible — do first, land green)

**Files:** move `lib/historical/backup-restore.ts` → `lib/backup-restore.ts`, `lib/historical/backup-restore.test.ts` → `lib/backup-restore.test.ts`; modify `scripts/restore-backup-to-target.ts`, `docs/04-operations/INCIDENT-RESPONSE.md`, `scripts/system-map/generate.ts`.

- [ ] **Step 1:** `git mv lib/historical/backup-restore.ts lib/backup-restore.ts && git mv lib/historical/backup-restore.test.ts lib/backup-restore.test.ts`. Check `backup-restore.test.ts`'s import of the module is relative (`./backup-restore`) and still resolves after the move; fix if it used `./historical/...`.
- [ ] **Step 2:** `scripts/restore-backup-to-target.ts:13` — change `"../lib/historical/backup-restore"` → `"../lib/backup-restore"`.
- [ ] **Step 3:** `docs/04-operations/INCIDENT-RESPONSE.md` — replace every `lib/historical/backup-restore.ts` with `lib/backup-restore.ts` (the `assertSafeRestoreTarget` location line).
- [ ] **Step 4:** `scripts/system-map/generate.ts:27` — add `lib/backup-restore.ts` to the skip predicate (keep the existing `sheets_db` / `lib/shared-actions` / `lib/historical` clauses for now; Task 3 removes the `lib/historical` one). Reason comment: writes only to a scratch restore target, not a production flow.
- [ ] **Step 5: Verify** — `npx tsc --noEmit` (0), `npx vitest run` (backup-restore.test.ts still green), regenerate map `npx vite-node scripts/system-map/generate.ts` then `npx vite-node scripts/doc-checks/run-blocking.ts` (map-drift PASS, no new writes), `npx vite-node scripts/check-rules-current.ts` (paths-exist PASS — INCIDENT-RESPONSE now points at the real new path).
- [ ] **Step 6: Commit** — `git commit -m "refactor(backup): move backup-restore out of lib/historical to lib/ (live restore-safety code, not history)"`.

## Task 2: Delete the three executed one-off scripts + their coupled tests (irreversible)

**Files:** delete `scripts/lock-backdated-historical-gap-cohort.ts`, `scripts/lock-btp-recipe-replay-drift-cohort.ts`, `scripts/migrate-hong-tra-to-luc-tra.ts`, `lib/backdated-historical-gap-lock-script.test.ts`, `lib/btp-drift-lock-script.test.ts`.

- [ ] **Step 1:** `git rm` the five files above. (The lock-script tests only `readFileSync` the scripts to assert they stay locked — obsolete once the scripts are gone.)
- [ ] **Step 2: Verify** — `npx tsc --noEmit` (0 — nothing kept imports these; `history-ops/*` they used is deleted in Task 3), `npx vitest run` (green — the two guard tests are gone, no other test depended on them). If tsc flags a broken import, a keeper still used one — stop and re-check.
- [ ] **Step 3: Commit** — `git commit -m "chore(scripts): remove executed one-off lock/migrate scripts and their guard tests (Phase 7)"`.

## Task 3: Delete the rest of lib/historical and repoint the two tooling special-cases (irreversible)

**Files:** `git rm -r lib/historical`; modify `scripts/system-map/generate.ts`, `scripts/doc-checks/run-blocking.ts`, `scripts/verify-revenue-core.ts`; grep-and-strip any remaining `lib/historical` mentions in kept files.

- [ ] **Step 1:** Re-verify nothing kept imports `lib/historical`: `grep -rnE "lib/historical" app lib components scripts supabase --include="*.ts" --include="*.tsx" | grep -v "^lib/historical/"` should return only COMMENT lines (no `from`/`import`/`readFileSync`). If any real import remains, stop.
- [ ] **Step 2:** `git rm -r lib/historical` (removes ~92 files: the audits, recompute, sheets adapters, `history-ops/`, `README.md`, and their tests).
- [ ] **Step 3:** `scripts/system-map/generate.ts:27` — remove the now-moot `lib/historical` clause from the skip predicate (keep `sheets_db`, `lib/shared-actions`, `lib/backup-restore.ts`).
- [ ] **Step 4:** `scripts/doc-checks/run-blocking.ts:160` — remove the `if (repoPath.includes("lib/historical/")) return;` skip (the folder is gone); update the nearby comment (line ~154) to drop the "skipping lib/historical" phrase.
- [ ] **Step 5:** Strip dead `lib/historical` comment pointers in kept files (surgical, comment-only): `scripts/verify-revenue-core.ts:348` (names `lib/historical/history-ops/`), and any other hits from Step 1's grep. Keep the reasoning, drop the dead path.
- [ ] **Step 6: Verify all five gates** — `npx tsc --noEmit` (0), `npx vitest run` (green; test count drops as the historical tests are gone — expected), regenerate map + `npx vite-node scripts/doc-checks/run-blocking.ts` (all 5 `[docs]` PASS, incl. `docs-refs` and `map-drift`), `npx vite-node scripts/check-rules-current.ts` (PASS — no doc cites a deleted path), `npm run build` (compiles). If `docs-refs` reds, a kept file names a deleted `docs/...` path — fix it; if `paths-exist` reds, a governed doc still cites `lib/historical` — fix it.
- [ ] **Step 7: Commit** — `git commit -m "chore: remove lib/historical entirely; repoint map/docs tooling (Phase 7)"`.

## Task 4: Final verification and report

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts && npm run build` — all green.
- [ ] **Step 2:** Confirm `lib/historical/` no longer exists and `lib/backup-restore.ts` does; `git status` clean.
- [ ] **Step 3:** Report to owner in Vietnamese: `lib/historical` emptied (N files removed), the one live module promoted to `lib/backup-restore.ts` (restore tool + incident runbook still work), the 3 one-off scripts gone, the new (lower) test count, and all gates green.

---

## Self-Review

**Spec coverage:** owner "delete lib/historical + one-off scripts" → Tasks 2-3; the live-module exception found in impact analysis → Task 1 (promote, not delete). Every reference the deletions break (import, doc, map skip, gate skip, dead comment) is repointed in the same task that deletes.

**Ordering safety:** Task 1 (reversible move) lands green first; deletions follow, each re-running all gates; a red gate isolates to the task that caused it. The map cannot drift because `lib/historical` contributed 0 writes and `lib/backup-restore.ts` is skip-listed.

**Irreversibility:** Tasks 2-3 are irreversible for the tree; git history retains everything (the owner's chosen recovery path). Impact analysis is measured, not assumed, and Step 1 of Task 3 re-verifies zero live importers immediately before `git rm -r`.

**Type consistency:** the moved module keeps its exact exports (`assertSafeRestoreTarget`, `restoreBundleToTarget`, `JSONB_NULL_LITERAL_SENTINEL`); only its path changes, matched by the one importer and the one doc.
