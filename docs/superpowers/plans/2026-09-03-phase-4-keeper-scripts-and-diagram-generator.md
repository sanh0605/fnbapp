# Phase 4 — Keeper Scripts, Diagram Generator, and the Delete Inventory: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Establish the small set of scripts the project actually still needs, prove the mandatory gates run and catch errors, add a diagram generator so the visual system map tracks the code, and produce a verified keep/delete inventory of all 251 scripts for Phase 5 to act on — deleting nothing itself.

**Architecture:** Most of the 251 scripts are one-off history (backfills, migrations, audits, resets already executed) — they are not rebuilt (spec §2.7, owner 2026-09-03: keep the currently-needed tools, delete the one-offs). The keeper set is small and mostly already exists from Phase 1. This phase adds one new tool — a diagram generator that reads the machine map and emits a visual that regenerates with the system (owner 2026-09-03: the visual should track the system, not be a hand-drawn snapshot). Phase 4 deletes nothing; it verifies the keepers and hands Phase 5 an explicit, reviewed delete list.

**Tech Stack:** TypeScript + vite-node, Mermaid (text-based, renders in GitHub/VS Code — no layout engine, no dependency). Verification is the existing gates.

**Spec:** `docs/superpowers/specs/2026-09-02-project-reset-design.md` §2.7 (rebuild scripts, keepers first), §3.5/§3.6 (the map the diagram is generated from), and the owner's 2026-09-03 decisions (keep-and-delete, auto-generate the visual).

## Global Constraints

- **Delete nothing in this phase.** The categorized delete happens in Phase 5 with its own owner approval (irreversible). Phase 4 only builds, verifies, and lists.
- **A keeper must be proven to run and, where it is a gate, to catch a real error** (spec §9 / §2.7) before Phase 5 removes anything.
- **No new npm dependencies.** Mermaid output is plain text in a fenced block.
- **The diagram is machine-generated** → it lands in `docs/generated/` and is never hand-edited (spec §3.2d).
- **Verification after each task:** `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`.
- **`scripts/` edits go through the implementer** (never hand-edited by Claude); Claude reviews between tasks.

---

## Current-state description (mandatory, `CLAUDE.md` §1b)

1. **States / how set:** 251 files under `scripts/`. Each is either a keeper (needed going forward) or a one-off (already executed, historical). This phase assigns each a category; Phase 5 acts on it.
2. **Entry points:** npm scripts, the pre-commit hook, and manual `vite-node` runs. No app entry points.
3. **In scope / excluded:** build the diagram generator, verify keepers, produce the keep/delete inventory. Excludes deleting anything (Phase 5) and rebuilding one-off historical scripts (pointless — they ran once against real data).
4. **Valid inputs / out-of-range:** a script is a KEEPER only if it is a current gate, Phase-1 tooling, a backup/restore tool referenced by `INCIDENT-RESPONSE.md`, or referenced by `package.json`/`.husky`/a surviving doc. Anything else is a one-off → DELETE candidate. A file that can't be clearly categorized is left as KEEPER and flagged for the owner (never deleted on a guess).
5. **Deliberately NOT served:** no historical one-off is recreated; the diagram is a generated overview, not a hand-curated infographic (the curated money-lane picture stays a separate artifact if the owner wants that look).

**Measured 2026-09-03:** 251 scripts. Keepers identified so far (verified present): `scripts/check-rules-current.ts` (+core, +test), `scripts/verify-revenue.ts` (runs; revenue matches known figures for 5 months), `scripts/system-map/*`, `scripts/doc-checks/*`, `scripts/doc-map/*`, `scripts/verify-drive-backup.ts`, `scripts/restore-backup-to-target.ts`, `scripts/verify-restore-drill.ts`, `scripts/apps-script/*`. One-offs: the ~200 `audit-*`, `apply-*`, `backfill-*`, `migrate-*`, `reset-*`, `revert-*`, `reprocess-*`, `remigrate-*`, `re-migrate-*`, `rollback-*`, `repair-*`, `recon-*`, `trace-*`, `investigate-*`, `diagnose-*` scripts.

---

## Task 1: Diagram generator — a visual that tracks the system

**Files:**
- Create: `scripts/system-map/generate-diagram.ts`, `scripts/system-map/build-diagram.ts`, `scripts/system-map/build-diagram.test.ts`
- Output (generated): `docs/generated/architecture.md`

**Interfaces:**
- Consumes: the ten `docs/03-workflows/*.md` flow-decls (via `parseFlowDecl`, Task 7 of Phase 1) and `docs/generated/system-map.md` relations (via `parseRelationBlock`).
- Produces: `buildDiagram(flows: {name: string; tables: string[]}[]): string` (pure — returns a Mermaid `flowchart` as text); `generate-diagram.ts` is the CLI writing `docs/generated/architecture.md`.

- [ ] **Step 1: Write the failing test for `build-diagram.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildDiagram } from "./build-diagram";

describe("buildDiagram", () => {
  it("emits a mermaid flowchart with one subgraph per flow and write edges", () => {
    const md = buildDiagram([
      { name: "stock-issue", tables: ["issue_slips", "stock_issues"] },
      { name: "sales", tables: ["orders_v2"] },
    ]);
    expect(md).toContain("```mermaid");
    expect(md).toContain("flowchart");
    expect(md).toContain("subgraph");
    expect(md).toContain("issue_slips");
    expect(md).toContain("orders_v2");
    expect(md.trim().endsWith("```")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm fail** — `npx vitest run scripts/system-map/build-diagram.test.ts` → module not found.

- [ ] **Step 3: Implement `build-diagram.ts` and `generate-diagram.ts`**

`build-diagram.ts`: emit a Mermaid `flowchart LR` (or `TD`), one `subgraph` per flow (the flow's file name as title), and one node per table the flow declares, with the flow node pointing to each table via `-->|ghi| table`. Deterministic ordering (sort flows, sort tables). Wrap in a ```` ```mermaid ```` fence inside a markdown file with a "generated, do not edit" header. Escape/normalise table names for mermaid node ids (alphanumeric + underscore are safe). `generate-diagram.ts`: read `docs/03-workflows/*.md` → `parseFlowDecl` for each → `{name, tables}`; call `buildDiagram`; write `docs/generated/architecture.md`.

- [ ] **Step 4: Run to confirm pass** — `npx vitest run scripts/system-map/build-diagram.test.ts`.

- [ ] **Step 5: Generate the real diagram and confirm it renders + tracks**

Run: `npx vite-node scripts/system-map/generate-diagram.ts && head -30 docs/generated/architecture.md`
Expected: a valid ```` ```mermaid ```` flowchart with the ten flows as subgraphs and their real tables (e.g. `stock-issue` → `issue_slips`, `stock_issues`). Confirm it "tracks": it is built from the same flow-decls the gates already check, so it cannot drift from them without the flow-doc gate going red first. Note in the file header how to refresh: `vite-node scripts/system-map/generate-diagram.ts`.

- [ ] **Step 6: Wire refresh into the generator step**

So the diagram refreshes whenever the map does: have `run-blocking.ts` (or a combined `generate` entry) also run `generate-diagram.ts` after regenerating the map, OR document that both generators run together. Keep it simple — if wiring into run-blocking risks slowing the hook, instead add an npm script `gen:docs` that runs both generators and note it in README. Verify the doc gates still pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/system-map/generate-diagram.ts scripts/system-map/build-diagram.ts scripts/system-map/build-diagram.test.ts docs/generated/architecture.md
git commit -m "feat(systemmap): generate architecture diagram that tracks the flows"
```

---

## Task 2: Prove the keeper gates run and catch errors

**Files:** none created — this task runs and records.

- [ ] **Step 1: Run each keeper gate and capture the result**

- `npx vite-node scripts/check-rules-current.ts` → clean (paths-exist, no-retired-agents, business-rule-tests PASS).
- `npx vite-node scripts/doc-checks/run-blocking.ts` → all `[docs] PASS`.
- `npx vite-node scripts/verify-revenue.ts` → "Revenue verification OK", 5 months match known figures.
- Any cost/inventory check scripts that CLAUDE.md §9 relies on for engine work: identify them (`ls scripts/verify-*.ts scripts/check-*cost* scripts/check-*inventory* 2>/dev/null`), run the ones that verify current state, record which pass.

- [ ] **Step 2: Prove a gate catches a real error (not just passes)**

For `check-rules-current` and `run-blocking`, briefly introduce a known-bad state in a scratch copy or via a temporary edit that you immediately revert (e.g. add a fake `docs/` path citation to a scratch file), confirm the gate goes red, then revert. This confirms the keepers are live checks, not vacuous. (Phase 1 already proved the doc gates catch drift; this is a re-confirmation that they still do after the Phase-3 changes.)

- [ ] **Step 3: Record the keeper list**

Write the verified keeper set into the Phase 5 inventory (Task 3). No commit needed for this task alone.

---

## Task 3: Produce the keep/delete inventory for Phase 5

**Files:**
- Create: `docs/superpowers/plans/2026-09-03-phase-5-deletion-inventory.md` (the reviewed list Phase 5 acts on)

- [ ] **Step 1: Categorize every script**

Build the list programmatically: `ls scripts/**/*.ts` (recursively). For each, mark KEEP or DELETE by the rule in Current-state item 4. KEEP if: it is a gate (`check-rules-current*`, `verify-revenue*`), Phase-1/4 tooling (`scripts/system-map/*`, `scripts/doc-checks/*`, `scripts/doc-map/*`), a backup/restore tool named in `docs/04-operations/INCIDENT-RESPONSE.md` (`verify-drive-backup`, `restore-backup-to-target`, `verify-restore-drill`, `scripts/apps-script/*`), or referenced by `package.json` / `.husky/pre-commit` / a surviving doc. DELETE if it is a one-off (audit/apply/backfill/migrate/reset/revert/reprocess/remigrate/rollback/repair/recon/trace/investigate/diagnose). Anything ambiguous → KEEP + flag.

- [ ] **Step 2: Cross-check the DELETE list against references**

For each DELETE candidate, grep the surviving tree (`app/`, `lib/`, `components/`, `package.json`, `.husky/`, `docs/01-system`, `docs/02-rules`, `docs/03-workflows`, `docs/04-operations`, `scripts/` keepers) for its filename. If anything still imports/calls it, move it to KEEP + flag — a one-off that something live still calls is not dead. Report the count that moved.

- [ ] **Step 3: Write the inventory doc**

List KEEP (with why) and DELETE (grouped by prefix, with counts), plus the non-script deletions Phase 5 owns (per design §4: `docs/audits/`, `docs/superpowers/plans/` except the current phase plans, `docs/superpowers/specs/` except the reset design, `docs/handoffs/`, `DEVELOPMENT-TRACKING.md`, the 13 legacy stray docs, the old `docs/OPEN-ITEMS.md`, and the §9/§1 CLAUDE.md references to `DEVELOPMENT-TRACKING.md`/legacy `OPEN-ITEMS.md` that must be repointed as those files go). This doc is what the owner approves before Phase 5 runs.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-09-03-phase-5-deletion-inventory.md
git commit -m "docs(plan): keep/delete inventory for Phase 5"
```

---

## Task 4: Full Phase-4 verification

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts` — all green.
- [ ] **Step 2:** Confirm `docs/generated/architecture.md` exists and renders as a mermaid flowchart of the ten flows; confirm nothing was deleted (Phase 4 is additive + inventory only).
- [ ] **Step 3:** Report to owner in Vietnamese: the diagram now regenerates from the map; the keeper set is verified; the keep/delete inventory is ready for Phase 5's separate approval. Do NOT start Phase 5.

---

## Self-Review

**Spec coverage:** rebuild = keep-and-verify the current tools, not recreate one-offs (§2.7 + owner 2026-09-03) → Tasks 2, 3; auto-generated visual that tracks the system (owner 2026-09-03) → Task 1; keepers proven before any delete (§2.7) → Task 2; the delete list is explicit and owner-reviewed before Phase 5 (§2.1, irreversibility) → Task 3.

**Safety:** Phase 4 deletes nothing. Ambiguous scripts default to KEEP. Every DELETE candidate is reference-checked against the living tree before it reaches the list. Phase 5 is a separate, owner-approved, irreversible step.

**Diagram honesty:** the generated diagram is built from the same flow-decls the gates enforce, so it cannot silently drift; it is a structural overview, and the plan says plainly it is not the curated money-lane infographic.
