# Phase 5 — Deletion: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remove the dead weight the reset was for — 215 one-off scripts, the audit archive, old plans/specs/handoffs, the development log, and the legacy stray docs — leaving the new doc set and keeper tools, with every gate still green.

**Architecture:** This is irreversible for the working tree (git history keeps everything, but the `docs/audits/*.json` data backups become history-only — spec §2.13, owner reaffirmed). So the order is fixed: **fix every reference and fold ARCHITECTURE.md FIRST, update the tooling that reads a to-be-deleted directory, THEN delete** — never delete a file while something in the surviving tree still points at it, or the paths-exist gate goes red mid-way. Executes against the reviewed inventory `docs/superpowers/plans/2026-09-03-phase-5-deletion-inventory.md`.

**Tech Stack:** git rm, small TypeScript edits to the doc-check tooling, Markdown edits. Verification is every gate plus `npm run build`.

**Spec:** `docs/superpowers/specs/2026-09-02-project-reset-design.md` §4 (what is deleted), §2.13 (audit backups deleted, reaffirmed), §2.19 (strip dead comment pointers), §7 (DEVELOPMENT-TRACKING not kept). Inventory: the Phase-5 inventory doc.

## Global Constraints

- **Irreversible — owner approves execution before Task 2 runs.** Tasks 1 (reference fixes) are safe and reversible; the deletions (Task 2 onward) need the explicit go.
- **Never delete a file the surviving tree still references.** Fix references first; verify paths-exist green before and after each deletion commit.
- **Keep every gate green.** After each task: `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, `npm run build`.
- **Delete only what the inventory lists.** Anything not on the reviewed list stays.
- **`scripts/` edits go through the implementer;** Claude reviews between tasks.

---

## Current-state description (mandatory, `CLAUDE.md` §1b)

1. **States:** files either exist or are deleted; the tree either passes all gates or not. Deletion is one-way for the working tree.
2. **Entry points:** none in the app.
3. **In scope:** the inventory's DELETE set + reference cleanups + ARCHITECTURE.md fold. Excludes anything on the KEEP list and any code under `app/`, `lib/`, `components/` (spec §2.4: no code moves this reset).
4. **Valid inputs / out-of-range:** a deletion is valid only if no surviving file references the path (checked in Task 1); an unreferenced deletion that still breaks a gate means a reference was missed — stop and fix.
5. **Deliberately NOT served:** no attempt to scrub git history (values were never committed; names are being removed from the tree, which is the owner's stated concern); no code deletion.

**Tooling coupling to handle (measured 2026-09-03):** `scripts/check-rules-current.ts` builds RULE_DOCS by `readdirSync("docs/operations")` — deleting `docs/operations/` makes that call throw. The reader must drop `docs/operations` (its content moved to `docs/04-operations/INCIDENT-RESPONSE.md` in Phase 2) in the same change that deletes the directory.

---

## Task 1: Reference cleanups and the ARCHITECTURE.md fold (safe, reversible — do before any deletion)

**Files:** `CLAUDE.md`, `README.md`, `docs/02-rules/business-rules/access.md`, `scripts/verify-revenue.ts`, `docs/01-system/SYSTEM-MAP.md`, `scripts/check-rules-current.ts`.

- [ ] **Step 1: Fold ARCHITECTURE.md into SYSTEM-MAP.md.** Read `ARCHITECTURE.md` (166 lines). Move any still-true content not already in `docs/01-system/SYSTEM-MAP.md` or `SYSTEM-OVERVIEW.md` into `SYSTEM-MAP.md` (keep it under the 200-line ceiling — if it would exceed, keep only what SYSTEM-MAP genuinely lacks; the map is the technical layer). Do not delete `ARCHITECTURE.md` yet (Task 3 deletes it, after references are gone).
- [ ] **Step 2: CLAUDE.md** — update §1 and §9 so they no longer point at `DEVELOPMENT-TRACKING.md` (the reset drops the who-did-what log; git history is the record — design §7) or the legacy `docs/OPEN-ITEMS.md` (open items now at `docs/04-operations/OPEN-ITEMS.md`, generated from `it.todo`; the "update it by hand" step becomes "mark the it.todo done"). Preserve every rule's meaning; only change the file references and the tracking/open-items mechanics to match the approved design.
- [ ] **Step 3: README.md** — remove the `ARCHITECTURE.md`, `CONTEXT.md`, and `docs/ACCESS-MODEL.md` links (all deleted in Task 3); repoint newcomers to `docs/01-system/SYSTEM-OVERVIEW.md` and the doc tree that survives.
- [ ] **Step 4: access.md** — `BR-ACCESS-001` links `docs/ACCESS-MODEL.md`. Fold the one-line intent it needs into the rule text and drop the link (ACCESS-MODEL is deleted in Task 3).
- [ ] **Step 5: verify-revenue.ts** — update the printed NOTE that cites `docs/BUSINESS-RULES.md` to `docs/02-rules/business-rules/` (cosmetic message).
- [ ] **Step 6: check-rules-current.ts** — change the `docs/operations` reader so it tolerates the directory being absent (guard the `readdirSync`), since Task 3 deletes `docs/operations/`. RULE_DOCS then covers only surviving docs.
- [ ] **Step 7: Verify + commit.** All gates green (files still exist, references now point at survivors). Commit: `git commit -m "docs: repoint references and fold ARCHITECTURE ahead of Phase 5 deletion"`.

---

## ORDER CORRECTION (found during execution 2026-09-03)

Task-2-then-Task-3 was wrong: a doc in `docs/operations/` (deleted in Task 3) cites scripts deleted in Task 2, so deleting scripts first reds `paths-exist`. Docs reference scripts, not the reverse — so **delete docs FIRST (Task 3), then scripts (Task 2)**. Also the inventory over-listed 6 live keepers; the corrected delete count is **209 scripts** and the KEEP set gains `check-result.ts`, `lan-address.ts` (+test), and the 3 lock/migrate scripts (see the inventory's corrections block). Execute Task 3 before Task 2. Task 3's doc-deletion step must also repoint `CLAUDE.md` §4's remaining `docs/OPEN-ITEMS.md` navigation row to `docs/04-operations/OPEN-ITEMS.md` before deleting the legacy file.

## Task 2: Delete the one-off scripts (209) — IRREVERSIBLE, owner go required

- [ ] **Step 1:** From the inventory's DELETE list, `git rm` the 207 one-off `.ts` scripts and the 8 legacy `.js`/`.json` (`init-*.js`, `migrate*.js` except none — migrate-to-sheets.js is KEEP-flagged, leave it; `reconcile-migrated-dates.js`, `recover-uck000002.json`). Do NOT remove any KEEP file (gates, `system-map/`, `doc-checks/`, `doc-map/`, backup/restore, `apps-script/`, `preview.ts`, `migrate-to-sheets.js`).
- [ ] **Step 2:** Verify: `npx tsc --noEmit` (0 errors — no living import breaks), `npx vitest run` (all green — the keeper tests remain), gates PASS. If tsc or a test fails, a deleted script WAS a dependency — restore it and re-check the inventory.
- [ ] **Step 3:** Commit: `git commit -m "chore(scripts): remove one-off historical scripts (Phase 5)"`.

---

## Task 3: Delete the dead docs — IRREVERSIBLE

- [ ] **Step 1:** `git rm -r` the doc deletions from the inventory §3: `docs/audits/`, `docs/handoffs/`, `docs/operations/`, `docs/reports/`, `docs/runbooks/`, `DEVELOPMENT-TRACKING.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `docs/ACCESS-MODEL.md`, `docs/COMPLETED.md`, `docs/domain-dictionary.md`, `docs/FEATURE-CATALOG.md`, `docs/FILE-ORGANIZATION.md`, `docs/OPEN-ITEMS.md` (legacy), `docs/TESTING.md`.
- [ ] **Step 2:** `git rm` the old plans/specs: everything in `docs/superpowers/plans/` EXCEPT the five reset plans (2026-09-02-phase-1, 2026-09-03-phase-2, -phase-3, -phase-4, -phase-5, and the two inventory/deletion docs), and everything in `docs/superpowers/specs/` EXCEPT `2026-09-02-project-reset-design.md`.
- [ ] **Step 3:** Verify: gates PASS (paths-exist especially — nothing surviving may cite a deleted path). `npm run build` succeeds. If paths-exist reports a dead citation, fix that reference (a missed Task-1 cleanup) in this commit.
- [ ] **Step 4:** Commit: `git commit -m "chore(docs): remove audits, old plans/specs, handoffs, legacy docs (Phase 5)"`.

---

## Task 4: Strip dead comment pointers in code (§2.19)

- [ ] **Step 1:** Find code comments that point at now-deleted plan/spec/doc paths: `grep -rn "docs/superpowers/plans/\|docs/audits/\|DEVELOPMENT-TRACKING" app lib components scripts` (surviving keepers only). For each, remove the dead address line, KEEP the reasoning sentence (design §2.19 — the comment's "why" stays, the pointer to a gone file goes).
- [ ] **Step 2:** Verify tsc + vitest green (comment-only edits). Commit: `git commit -m "chore: strip dead doc pointers from code comments (Phase 5)"`.

---

## Task 5: Final verification — the reset is done

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts && npm run build` — all green.
- [ ] **Step 2:** Confirm the surviving shape: `CLAUDE.md` + `README.md`; `docs/01-system/`, `docs/02-rules/` (GLOSSARY + business-rules/), `docs/03-workflows/` (10), `docs/04-operations/`, `docs/generated/`; `docs/superpowers/specs/` = 1 file; `docs/superpowers/plans/` = the reset plans only; `scripts/` = the ~38 keepers. No `docs/audits/`, no `DEVELOPMENT-TRACKING.md`.
- [ ] **Step 3:** Regenerate the machine docs (`npm run gen:docs`) and confirm no drift. Report to owner in Vietnamese: what was removed (counts), what survives, and that every gate is green — the reset is complete.

---

## Self-Review

**Spec coverage:** §4 deletions → Tasks 2-3; §2.13 audit backups → Task 3 Step 1; §2.19 comment pointers → Task 4; §7 DEVELOPMENT-TRACKING dropped → Tasks 1-2/3; ARCHITECTURE fold (owner 2026-09-03) → Task 1 Step 1 + Task 3.

**Ordering safety:** all references are repointed and the `docs/operations` reader guarded in Task 1 (reversible) BEFORE any `git rm`, so paths-exist never sees a dead citation. Deletions are split scripts / docs / comments so a failure isolates. Every deletion task re-runs the gates; a broken gate means a missed reference → fix in place, never force.

**Irreversibility:** Task 1 is safe and can land on its own; Tasks 2+ need the owner's explicit go, and the inventory they act on is already owner-reviewed.
