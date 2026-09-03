# Phase 3 — Rewrite CLAUDE.md, README, and split BUSINESS-RULES: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reduce `CLAUDE.md` to rules + navigation (move system description into the Phase-2 docs), refresh `README.md`, and split the 478-line `docs/BUSINESS-RULES.md` into domain files under `docs/02-rules/business-rules/` — every existing gate still green and every `BR-*` code still resolvable.

**Architecture:** This phase touches the two most meaning-sensitive files in the repo — the rules file and the business-rules register. The governing constraint is **preserve meaning; only restructure.** No working rule and no `BR-*` rule may change meaning or be dropped; content moves, wording is preserved. Because `docs/BUSINESS-RULES.md` is read by tooling and cited by all ten workflow docs, the split ships together with the tooling updates that follow it, in one reviewable step per concern.

**Tech Stack:** Markdown + small TypeScript edits to the doc-check tooling. Verification is the existing gates plus `npm run build`.

**Spec:** `docs/superpowers/specs/2026-09-02-project-reset-design.md` — implements §3.3 (BUSINESS-RULES split, 200-line ceiling), §3.4 (CLAUDE.md role), §6b item 5 (orphan lines + dead links), and §7.2 (rules keep their rationale inline).

## Global Constraints

- **Preserve meaning. Never cut or reword a rule's meaning.** If a rule looks obsolete or contradictory, LIST it for the owner — do not delete it (that is a rule decision, spec §1 / owner directive).
- **Every `BR-*` code must survive the split** — all ten workflow docs cite codes validated by `run-blocking`'s brCodes world; a dropped code fails that gate.
- **`CLAUDE.md` stays exempt from the 200-line ceiling** (spec §3.3) — it is the one auto-loaded file; do not split it into must-open pieces.
- **Only cite paths that exist** (paths-exist gate scans `CLAUDE.md`, the rule docs, and `docs/operations/`).
- **Rule 0 stays at the top of `CLAUDE.md`** (spec §3.3): no sentence in it may describe current data.
- **Verification after each task:** `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, and — for the CLAUDE.md/README task — `npm run build`.
- **This phase's doc edits may be done directly; the `scripts/` edits go through the implementer (never hand-edit `scripts/`).** Claude reviews between tasks; the rewritten `CLAUDE.md` is presented to the owner before the phase is called done.

---

## Current-state description (mandatory, `CLAUDE.md` §1b)

1. **States / how set:** `CLAUDE.md` currently holds Part A (working rules §1–§9) + Part B (system description §10–§11) = 524 lines. `docs/BUSINESS-RULES.md` = 478 lines, one file, sections listed below. Each either passes the gates or not.
2. **Entry points:** none in the app. `CLAUDE.md` is auto-loaded each session; `BUSINESS-RULES.md` is read by tooling and cited by docs.
3. **What is in scope / excluded:** rewrite `CLAUDE.md`, refresh `README.md`, split `BUSINESS-RULES.md`. Excludes deleting anything else (Phase 5) and rebuilding scripts (Phase 4).
4. **Valid inputs / out-of-range:** a moved/renamed file that a reader still points at fails paths-exist or the brCodes gate — so every reader is updated in the same task as the move.
5. **Deliberately NOT served:** no rule meaning changes; no new rule is authored; the BUSINESS-RULES prose is reorganized, not rewritten.

**Readers of `docs/BUSINESS-RULES.md` that must keep working (measured 2026-09-03):**
- `scripts/check-rules-current.ts` — `RULE_DOCS` array lists it.
- `scripts/doc-checks/run-blocking.ts` — builds the `brCodes` world from it.
- `scripts/doc-checks/line-ceiling.ts` — has it in `EXEMPT`.
- `scripts/check-rules-current-core.test.ts` — may reference it.
- `scripts/verify-revenue.ts`, `lib/asset-purchase-allocation.ts`, `app/admin/inventory/stocktake/actions.test.ts` — reference it in COMMENTS only (not gate-checked; update opportunistically, do not let them block).
- All ten `docs/03-workflows/*.md` cite `BR-*` codes.

**Current `BUSINESS-RULES.md` section map (line ranges 2026-09-03, for the split):**
`## Tóm tắt` (7), `## Rule status` (13), `## Authority hierarchy` (24, DEAD LINKS), `## Sales and order rules` (37, BR-SALE), `## COGS and reporting rules` (91, BR-COGS), `## Inventory, purchasing, and production rules` (141, BR-INV), `## Backdated transaction rules` (199, BR-BACKDATE), `## Audit, recovery, and production-write rules` (219, BR-DATA), `## Backup and retention rules` (245, BR-BACKUP), `## Access and security rules` (277, MISLABELED — holds BR-ACCESS + misfiled BR-CATALOG/BR-INV/BR-COGS), `## Unresolved items` (459, BR-U table), `## Change procedure` (469, DEAD LINKS).

---

## Task 1: Split BUSINESS-RULES into domain files (content only, preserve every code)

**Files:**
- Create: `docs/02-rules/business-rules/{sales,cogs,inventory,catalog,data-integrity,access,unresolved}.md` and `docs/02-rules/business-rules/README.md`
- Delete (at end of task, after content is moved and verified): `docs/BUSINESS-RULES.md`

**Split map (by coherent domain, spec §3.3 — merge tiny siblings, fix the mislabel):**
- `sales.md` ← `## Sales and order rules` (BR-SALE-*)
- `cogs.md` ← `## COGS and reporting rules` (BR-COGS-*) + any BR-COGS-* misfiled under "Access and security"
- `inventory.md` ← `## Inventory, purchasing, and production rules` (BR-INV-*) + any BR-INV-* misfiled under "Access and security"
- `catalog.md` ← the BR-CATALOG-* rules currently misfiled under "Access and security"
- `data-integrity.md` ← `## Backdated transaction rules` + `## Audit, recovery, and production-write rules` + `## Backup and retention rules` (BR-BACKDATE/BR-DATA/BR-BACKUP) merged (spec §3.3: these three small siblings form one "protect and correct data" concern)
- `access.md` ← the real `## Access and security rules` content (BR-ACCESS-*) after the misfiled rules are moved out (spec §3.3b: safety rules keep their own file even if short)
- `unresolved.md` ← `## Unresolved items` (BR-U-* table) — kept so `users.md`'s `BR-U-003` citation stays valid
- `README.md` ← `## Tóm tắt cho chủ doanh nghiệp` + `## Rule status` legend + a rewritten `## Authority hierarchy` and `## Change procedure` (see Step 3), plus an index linking the domain files

- [ ] **Step 1: Read the whole current file and identify each rule's true home**

Run: `grep -n "^## \|^### BR-\|BR-[A-Z]\+-[0-9]\+" docs/BUSINESS-RULES.md`. For every `BR-*` code, decide its domain file from its family (SALE→sales, COGS→cogs, INV→inventory, CATALOG→catalog, BACKDATE/DATA/BACKUP→data-integrity, ACCESS→access, U→unresolved). The "Access and security" section is mislabeled: route each rule under it by its OWN code family, not by the header.

- [ ] **Step 2: Create the domain files, moving rule text verbatim**

For each domain file: an English or Vietnamese heading matching the source language (BUSINESS-RULES.md is Vietnamese — keep Vietnamese), then each rule's full text COPIED VERBATIM (the rule, its rationale/"Why" line, any `Test:` link). Do not reword. Preserve every `BR-*` code exactly. Keep each file under 200 lines (each domain is already well under per the section sizes; data-integrity ≈ 75).

- [ ] **Step 3: Create `business-rules/README.md` and fix the dead links**

Move `## Tóm tắt` and the `## Rule status` legend here. Rewrite `## Authority hierarchy`: its six outbound links all point at files this reset deletes (`domain-dictionary.md`, a `superpowers/specs/*` file, three `audits/*`, one `operations/*`) — replace them with pointers to the surviving doc set (`docs/02-rules/GLOSSARY.md`, `docs/01-system/SYSTEM-MAP.md`, the workflow docs) or drop the dead reference entirely. Rewrite `## Change procedure` step 6 to drop the reference to `DEVELOPMENT-TRACKING.md`/`docs/COMPLETED.md` (both deleted by this reset). Add an index table linking the seven domain files. Under 200 lines. Only backtick paths that exist.

- [ ] **Step 4: Verify content parity, then delete the old file**

Run: `grep -oE "BR-[A-Z]+-[0-9]+" docs/BUSINESS-RULES.md | sort -u > /tmp/before.txt; cat docs/02-rules/business-rules/*.md | grep -oE "BR-[A-Z]+-[0-9]+" | sort -u > /tmp/after.txt; diff /tmp/before.txt /tmp/after.txt`
Expected: NO differences — every code survived. If diff shows a missing code, STOP and fix before deleting. Then `git rm docs/BUSINESS-RULES.md`.

- [ ] **Step 5: Commit (do NOT verify gates yet — tooling still points at the old path; Task 2 fixes that in the same session)**

```bash
git add docs/02-rules/business-rules/ && git rm docs/BUSINESS-RULES.md
git commit --no-verify -m "docs(rules): split BUSINESS-RULES into domain files under 02-rules/business-rules"
```
`--no-verify` is REQUIRED here and ONLY here: the pre-commit hook reads the old path and would fail until Task 2 updates it. This is the one sanctioned hook bypass; Task 2 restores full green immediately after. (Owner note: this is a deliberate, single-commit bypass to keep the split and its tooling update reviewable as two steps, not a skipped gate.)

---

## Task 2: Update the tooling to read the new business-rules location

**Files:**
- Modify: `scripts/check-rules-current.ts` (RULE_DOCS), `scripts/doc-checks/run-blocking.ts` (brCodes world), `scripts/doc-checks/line-ceiling.ts` (exemption + scan), and `scripts/check-rules-current-core.test.ts` if it references the old path.

- [ ] **Step 1: check-rules-current.ts** — in `RULE_DOCS`, replace `"docs/BUSINESS-RULES.md"` with the seven `docs/02-rules/business-rules/*.md` files (read the directory the same way it already reads `docs/operations`, so new domain files are covered automatically: add a `businessRulesDocs` glob of `docs/02-rules/business-rules/*.md`).

- [ ] **Step 2: run-blocking.ts** — change the brCodes world from reading `docs/BUSINESS-RULES.md` to reading and concatenating all `docs/02-rules/business-rules/*.md`, then extracting `BR-[A-Z]+-\d+`. Every code cited by the ten flow docs must be found.

- [ ] **Step 3: line-ceiling.ts** — remove `docs/BUSINESS-RULES.md` from `EXEMPT` (it no longer exists) and confirm `docs/02-rules/` is in the governed allowlist scan (it is, per Phase-1 Task 8: `02-rules/` is one of the four governed folders) so each domain file is ceiling-checked.

- [ ] **Step 4: fix any test** — if `scripts/check-rules-current-core.test.ts` references `docs/BUSINESS-RULES.md`, point it at a surviving domain file or a fixture.

- [ ] **Step 5: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts`
Expected: all green; in particular `flow-doc-facts` PASS (every flow doc's `BR-*` codes still resolve against the new location), and `line-ceiling` PASS (each domain file under 200). If any flow doc's code fails to resolve, a code was lost in Task 1 — STOP and fix Task 1.

- [ ] **Step 6: Commit (hook runs and must pass — restoring full green)**

```bash
git add scripts/check-rules-current.ts scripts/doc-checks/run-blocking.ts scripts/doc-checks/line-ceiling.ts scripts/check-rules-current-core.test.ts
git commit -m "fix(docchecks): read business rules from 02-rules/business-rules"
```

---

## Task 3: Rewrite CLAUDE.md to rules + navigation only

**Files:** Modify `CLAUDE.md`.

**This is the rules file. Preserve every working rule's meaning. Move only the system description out; update navigation. Cut nothing without owner sign-off.**

- [ ] **Step 1: Inventory the current rules**

Read `CLAUDE.md` fully. Part A (§1–§9) = working rules; Part B (§10–§11) = system description + doc-location tables. List every rule in Part A so none is lost.

- [ ] **Step 2: Rewrite**

Keep, verbatim in meaning (re-tightened wording is fine, meaning is not): Rule 0 at the very top; all of Part A (§1 who does what, §1b four-step process, §2 risk tiers, §3 bulk data, §4 answering data questions, §5 worked examples, §6 talking to owner, §7 writing code, §8 how business rules are born, §9 done-definition with the four gates). Update §9 to also name the doc-currency gate (`run-blocking.ts`) now that it exists. Replace Part B (§10 system description, §11 where-to-look tables) with a SHORT navigation section pointing to the new doc set:
  - "What the shop/system is" → `docs/01-system/SYSTEM-OVERVIEW.md`
  - "Where a change reaches" → `docs/01-system/SYSTEM-MAP.md` (+ the generated `docs/generated/system-map.md`)
  - "How a flow works end to end" → `docs/03-workflows/`
  - "How money is calculated / why" → `docs/02-rules/business-rules/`
  - "Terms" → `docs/02-rules/GLOSSARY.md`
  - "What is unfinished" → `docs/04-operations/OPEN-ITEMS.md`
  - "When something breaks" → `docs/04-operations/INCIDENT-RESPONSE.md`
Only backtick paths that EXIST now. Keep Rule 0's "no current-data claims" — so the navigation section names files, not counts. CLAUDE.md is ceiling-exempt but still aim to be shorter than today (Part B leaving should drop it well below 524).

- [ ] **Step 3: If any rule seems obsolete**

Do NOT cut it. Write a short list of "rules that may be obsolete after the reset" and surface it to the owner in the phase report. Keep the rule in place until he decides.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts && npm run build`
Expected: all green; `check-rules-current` paths-exist PASS (every path CLAUDE.md cites exists); `no-retired-agents` PASS; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(rules): reduce CLAUDE.md to working rules + navigation"
```

---

## Task 4: Refresh README.md

**Files:** Modify `README.md`.

- [ ] **Step 1:** Update `README.md` (English) to reflect the current stack and how to run the app + the gates. Verify claims against reality: `package.json` scripts, the Supabase/Next stack, the pre-commit gates (`tsc`, `check-rules-current`, `run-blocking`), `npm run build`, `npx vitest run`, and the Singapore deploy-region requirement. Point newcomers to `docs/01-system/SYSTEM-OVERVIEW.md`. Only cite real scripts/paths. Under 200 lines (README is not ceiling-governed but keep it tight).

- [ ] **Step 2: Verify + commit**

Run: `npx vite-node scripts/check-rules-current.ts` (clean) and `npm run build` (succeeds).
```bash
git add README.md
git commit -m "docs(readme): refresh run + gate instructions"
```

---

## Task 5: Full Phase-3 verification

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts && npm run build` — all green.
- [ ] **Step 2:** Confirm structure: `ls docs/02-rules/business-rules/` (seven domain files + README), `docs/BUSINESS-RULES.md` gone, `CLAUDE.md` reduced, `README.md` refreshed.
- [ ] **Step 3:** Report to owner in Vietnamese: what CLAUDE.md now contains, how the rules are split, any "possibly obsolete rule" list from Task 3 Step 3, and confirm every BR code survived. Owner reviews the rewritten CLAUDE.md before Phase 3 is called done (spec §2.12) and before Phase 4.

---

## Self-Review

**Spec coverage:** BUSINESS-RULES split by domain (§3.3) → Task 1; tooling updated so the split doesn't break gates → Task 2; CLAUDE.md to rules+nav (§3.4) → Task 3; README → Task 4; orphan lines + dead links (§6b item 5) → Task 1 Step 3; rules keep rationale inline (§7.2) → Task 1 Step 2 (verbatim copy).

**Risk handling:** the one hook bypass (Task 1 Step 5) is explicit, justified, and immediately closed by Task 2. Every BR code is diff-verified to survive (Task 1 Step 4). No rule is cut — obsolete candidates are surfaced, not deleted (Global Constraint + Task 3 Step 3). The rules file is owner-reviewed before the phase closes.

**Ordering:** split content first (Task 1), rewire readers immediately (Task 2) to restore green, then the independent CLAUDE.md (Task 3) and README (Task 4), then full verify (Task 5).
