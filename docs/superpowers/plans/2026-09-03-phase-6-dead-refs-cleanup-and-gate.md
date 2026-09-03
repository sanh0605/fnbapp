# Phase 6 — Dead-reference cleanup (A) and a whole-tree reference gate (B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. This plan was already critiqued once (see "Critique history"); re-read the files it names before executing.

**Goal:** Leave the codebase with **zero dead `docs/...` references** — repoint or strip every dead pointer (the 8 to living docs, the ~332 provenance breadcrumbs to deleted plans/specs, the restore-drill's audit paths), fix the two runtime crashes in `scripts/verify-restore-drill.ts`, and add a blocking gate that catches ANY dead `docs/...` reference in code or scripts so none can reappear.

**Owner decision (2026-09-03):** everything must be a living file / current information; no dead points anywhere. This raises B from "police the living-doc trees only" to **police every `docs/...` reference**, and adds the mass scrub of the ~332 provenance breadcrumbs (Task 3). The maintenance cost of the broad gate — deleting a plan later forces stripping any code comment that cites it — is the enforcement mechanism the owner wants, not a drawback.

**Architecture:** A is comment-only repoint/strip edits (CLAUDE.md §2.19: drop the dead address, keep the reasoning) plus two behavioral fixes to one keeper script. B is a new `docs-refs` check in the existing `scripts/doc-checks/` pattern (pure `*-core.ts` + `*-core.test.ts`, wired into `run-blocking.ts` as a fifth `[docs]` line). B scans every `docs/...` token in `app/`, `lib/`, `components/`, `scripts/`; the only allowed dead references are genuine test-data fixtures and history-only one-off constants, each carrying an **inline, reasoned `docs-ref-allow` marker** at the reference site — no central list to rot.

**Tech Stack:** TypeScript, vite-node, vitest 4.1.10, the `CheckResult` shape from `scripts/check-result.ts`.

**Spec:** reset design `docs/superpowers/specs/2026-09-02-project-reset-design.md` §2.19 (strip dead comment pointers) and §4 (deletions). B + Task 3 finish the §2.19 cleanup that Phase 5's one-shot grep left ~332 hits short.

## Critique history (2026-09-03, Sonnet)

The first draft assumed "8 dead pointers." A wired-up scan found **361** dead `docs/...` references across 176 files: ~332 are code-comment provenance citations to `docs/superpowers/plans|specs/*` deleted in Phase 5; ~30 are in the living-doc jurisdiction (the 8 real ones plus deliberate test fixtures / gate comments / one-off consts); plus ~8 root-filename hits (`CONTEXT.md`, `DEVELOPMENT-TRACKING.md`). Opus re-measured independently and confirmed the shape (332 provenance + 30 in-jurisdiction + 8 root-name). The owner chose to scrub all of them and gate the whole tree. This v2 reflects that.

## Global Constraints

- **`scripts/` edits go through the implementer; Opus reviews and runs the gates independently** (memory: no self-review on `scripts/`).
- **Every change is comment-only except the two `verify-restore-drill.ts` behavioral fixes and the new check files.** No logic, no COGS/inventory, no production data, no `lib/historical/**` (frozen — its own README documents it as the record).
- **Keep every gate green after each task (except the intentional Task-1 red):** `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, `npm run build`.
- **A new check must be shown RED before GREEN** (CLAUDE.md §9), and the report must say whether it is red by **missing function** or by **value**.
- **Scrub = strip the dead address fragment only, keep every other word of the comment.** Never delete a whole comment or any code. `// Batch 1 (docs/superpowers/plans/2026-08-03-x.md): does X because Y` → `// Batch 1: does X because Y`.

---

## Current-state description (mandatory, CLAUDE.md §1b)

1. **States (this change):** each `docs/...` reference in code is *live-and-valid* (target exists), *dead* (target deleted), or *intentional-nonpath* (a test-data fixture or a history-only one-off const). This task makes dead → valid-or-removed everywhere, and marks intentional-nonpath so the gate can tell them apart. End state: the gate is green iff no unmarked dead reference exists.
2. **Entry points / buttons:** none — no UI. B adds one line to pre-commit output (`[docs] PASS/FAIL docs-refs`). `verify-restore-drill.ts` keeps its single CLI entry; its baseline read is removed and its result now writes to the OS temp dir.
3. **In scope / excluded:** IN — all ~370 dead `docs/...` references in `app/`, `lib/` (excluding `lib/historical/`), `components/`, `scripts/`; the drill's two crashes; the new `docs-refs` check. OUT — `lib/historical/**` (frozen record zone, excluded from the scan); `.md` documents (covered by `check-rules-current` paths-exist); git history; any non-comment logic; the advisory `undated-data-claims` warning.
4. **Valid inputs / out-of-range:** a `docs/...` token in scanned code is valid iff the path exists on disk OR its line carries `docs-ref-allow: <reason>`. Everything else the gate rejects.
5. **Deliberately NOT served:** B does not scan `.md` docs, does not validate non-`docs/` paths, does not auto-fix, and does not touch `lib/historical/**`. This task does NOT re-open Phase 5's keep decisions (the one-off scripts and `lib/historical/` stay; their dead audit-json references are marked, not deleted — deleting the scripts+their coupled `lib/*.test.ts` is a separate owner-approved follow-up, noted in Task 5).

**What I have looked at:** the 8 living-doc dead pointers and their "why"; `verify-restore-drill.ts` baseline (line 33), use (line 60), result write (line 152); the `doc-checks` pattern; the full measured worklist (332 provenance + 30 in-jurisdiction + 8 root-name); repoint targets confirmed present (`catalog.md`→BR-CATALOG-001, `inventory.md`→BR-INV-006, `cogs.md`→BR-COGS-006, `GLOSSARY.md`) and one absent (`access.md` has no owner/admin text → strip).
**What I have NOT looked at:** the exact comment wording of each of the 332 provenance sites — Task 3 handles them by a uniform rule (strip the `(docs/superpowers/...md)` fragment, keep the rest), verified complete by the gate going green, not by enumerating them here.

---

## Task 1: Build the whole-tree gate B and prove it goes red

**Files:** Create `scripts/doc-checks/docs-refs-core.ts`, `scripts/doc-checks/docs-refs-core.test.ts`; Modify `scripts/doc-checks/run-blocking.ts`.

**Interfaces:** Produces `export function checkDocsRefs(files: { path: string; content: string }[], exists: (repoPath: string) => boolean): CheckResult` — `check` is `"docs-refs"`.

- [ ] **Step 1: Write the failing test** `scripts/doc-checks/docs-refs-core.test.ts` (append `// docs-ref-allow: test fixture, path is test data not a real reference` to the two physical lines whose string literals contain a dead token, so the gate does not flag its own test):

```typescript
import { describe, it, expect } from "vitest";
import { checkDocsRefs } from "./docs-refs-core";

const exists = (p: string) => p === "docs/02-rules/GLOSSARY.md";

describe("checkDocsRefs", () => {
  it("passes a reference to a doc that exists", () => {
    const r = checkDocsRefs([{ path: "lib/x.ts", content: "// see docs/02-rules/GLOSSARY.md" }], exists);
    expect(r.ok).toBe(true);
  });
  it("flags a reference to a deleted doc, naming file, line, and token", () => {
    const r = checkDocsRefs([{ path: "lib/x.ts", content: 'a\n// gone: docs/BUSINESS-RULES.md' }], exists); // docs-ref-allow: test fixture, path is test data not a real reference
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("lib/x.ts:2");
    expect(r.problems[0]).toContain("docs/BUSINESS-RULES.md");
  });
  it("honors an inline docs-ref-allow marker", () => {
    const r = checkDocsRefs([{ path: "s/y.ts", content: 'const p = "docs/audits/gone.json"; // docs-ref-allow: history-only' }], exists);
    expect(r.ok).toBe(true);
  });
  it("catches deleted root doc filenames (DEVELOPMENT-TRACKING.md)", () => {
    const r = checkDocsRefs([{ path: "lib/x.ts", content: "// see DEVELOPMENT-TRACKING.md" }], exists); // docs-ref-allow: test fixture, path is test data not a real reference
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("DEVELOPMENT-TRACKING.md");
  });
});
```

- [ ] **Step 2: Run it, expect FAIL by missing function** — `npx vitest run scripts/doc-checks/docs-refs-core.test.ts`. Expected: cannot find module / not a function. Record this as "red by missing function."

- [ ] **Step 3: Implement** `scripts/doc-checks/docs-refs-core.ts`:

```typescript
import type { CheckResult } from "../check-result";

// Any docs/ path token, plus root-level doc filenames removed in the reset.
const DOCS_TOKEN = /docs\/[A-Za-z0-9._/-]+\.(?:md|json|ts|tsx)/g;
const ROOT_DOC_TOKEN = /\b(?:DEVELOPMENT-TRACKING|CONTEXT|ARCHITECTURE)\.md\b/g;
const ALLOW_MARKER = "docs-ref-allow";

export function checkDocsRefs(
  files: { path: string; content: string }[],
  exists: (repoPath: string) => boolean,
): CheckResult {
  const problems: string[] = [];
  for (const file of files) {
    file.content.split("\n").forEach((line, i) => {
      if (line.includes(ALLOW_MARKER)) return; // reasoned inline exemption
      const tokens = [...line.matchAll(DOCS_TOKEN), ...line.matchAll(ROOT_DOC_TOKEN)].map(m => m[0]);
      for (const token of tokens) {
        if (!exists(token)) {
          problems.push(`${file.path}:${i + 1} points at ${token}, which no longer exists — fix it or mark the line "${ALLOW_MARKER}: <reason>"`);
        }
      }
    });
  }
  return { check: "docs-refs", ok: problems.length === 0, problems };
}
```

Note: `DOCS_TOKEN`'s own source contains `docs\/` (escaped), so this file never matches itself. Confirm by running the gate over `scripts/` in Step 6 and checking `docs-refs-core.ts` is not reported.

- [ ] **Step 4: Run test, expect PASS** — `npx vitest run scripts/doc-checks/docs-refs-core.test.ts` → 4 passing.

- [ ] **Step 5: Wire into `run-blocking.ts`** after the line-ceiling block: walk `app`, `lib`, `components`, `scripts` for `.ts`/`.tsx`/`.js`, **skip any path containing `lib/historical/`**, read each, `checkDocsRefs(files, token => existsSync(join(root, token)))`, `results.push(...)`. Reuse the existing `walk`/`toRepoPath` helpers and the results/printing convention.

- [ ] **Step 6: Run B on the un-fixed tree, expect RED by VALUE** — `npx vite-node scripts/doc-checks/run-blocking.ts`. Expected `[docs] FAIL docs-refs` with ~370 problems. **Save the full list to the task report** — it is the worklist and the completeness check. Confirm `docs-refs-core.ts` itself is NOT in the list.

- [ ] **Step 7: Commit (the one sanctioned bypass)** — `git add scripts/doc-checks/docs-refs-core.ts scripts/doc-checks/docs-refs-core.test.ts scripts/doc-checks/run-blocking.ts && git commit --no-verify -m "feat(docchecks): add whole-tree docs-refs gate (intentionally red until Phase 6 cleanup lands)"`. `--no-verify` here only because the gate is designed to be red until Tasks 2-3; note it in the body.

## Task 2: Fix the 8 living-doc dead pointers

**Files:** `app/admin/reports/actions.ts`, `app/pos/page.tsx`, `lib/asset-purchase-allocation.ts`, `lib/auth.ts`, `lib/item-purchase-history.ts`, `components/ProductForm.tsx`, `app/admin/inventory/stocktake/actions.test.ts`. (Comment-only.)

- [ ] **Step 1: Repoints (survivor confirmed present).**
  - `app/pos/page.tsx:51` — `docs/domain-dictionary.md` → `docs/02-rules/GLOSSARY.md`.
  - `lib/asset-purchase-allocation.ts:8` — `docs/BUSINESS-RULES.md` → `docs/02-rules/business-rules/cogs.md`.
  - `components/ProductForm.tsx:45` — `docs/BUSINESS-RULES.md BR-CATALOG-001` → `docs/02-rules/business-rules/catalog.md BR-CATALOG-001`.
  - `app/admin/inventory/stocktake/actions.test.ts:84` — `docs/BUSINESS-RULES.md` → `docs/02-rules/business-rules/inventory.md`.
- [ ] **Step 2: Strips (no survivor — keep the reasoning).**
  - `app/admin/reports/actions.ts:73` — remove `, docs/OPEN-ITEMS.md item 31`; keep `owner decision 2026-08-05`.
  - `lib/auth.ts:75` — remove the `(docs/ACCESS-MODEL.md: "...")` citation; keep the inline fact and the `checked live 2026-08-09` note. (Do NOT repoint — `access.md` lacks this text.)
  - `lib/item-purchase-history.ts:2` — remove the `Design: docs/handoffs/...` line; keep `WF-1a: per-item purchase history viewer.`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit` (0) and `npx vitest run` (green).
- [ ] **Step 4: Commit** — `git commit -m "docs: repoint or strip 8 dead pointers to living docs"`. (Real hook runs; docs-refs still red from the 332, so this commit will fail the hook — use `--no-verify` and note the gate stays red until Task 3; OR reorder to commit Tasks 2+3 together. Prefer committing 2 and 3 as one hook-passing commit: skip this Step 4 commit and fold into Task 3 Step 5.)

## Task 3: Scrub the ~332 provenance breadcrumbs + fix the drill + mark true exceptions

**Files:** ~168 files across `app/`, `lib/` (not `lib/historical/`), `components/`, `scripts/` carrying `docs/superpowers/plans|specs/*` citations; plus `scripts/verify-restore-drill.ts`, `scripts/lock-backdated-historical-gap-cohort.ts`, `scripts/lock-btp-recipe-replay-drift-cohort.ts`, `scripts/check-rules-current-core.test.ts`, `scripts/check-rules-current.ts`, `scripts/check-rules-current-core.ts`, `scripts/doc-checks/line-ceiling.ts`, `scripts/doc-checks/flow-doc-core.test.ts`.

- [ ] **Step 1: Scrub provenance citations.** For every code comment containing a `docs/superpowers/plans/…md` or `docs/superpowers/specs/…md` path that does NOT exist on disk, remove only the path fragment (and its wrapping parens/`Design:`/`See ` lead-in if that leaves a clean sentence), keeping the reasoning. A citation to a **surviving** reset plan/spec (e.g. the design spec) stays. Work file-by-file or via a reviewed transformation; either way the gate is the completeness check.
- [ ] **Step 2: verify-restore-drill.ts — remove the baseline dead path entirely** (it is reference-only per the file's own comment; the real comparison is against live production). Drop the `baselinePath`/`readFileSync` lines; set the reference column to 0 or omit it, keeping row-count-vs-production intact. **Result write → OS temp dir:**

```typescript
  const os = await import("node:os");
  const outPath = path.join(os.tmpdir(), `fnbapp-restore-drill-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${outPath}`);
```

  Also strip the deleted-plan citation in the header comment (line 6).
- [ ] **Step 3: Mark / rephrase the true exceptions** surfaced in Task 1 Step 6:
  - `scripts/check-rules-current-core.test.ts` fixture lines writing fake doc paths into a tmp cwd, and `scripts/doc-checks/flow-doc-core.test.ts:76` `"docs/x.md"` placeholder → append `// docs-ref-allow: test fixture, path is test data not a real reference`.
  - `scripts/lock-*.ts` audit-json consts → append `// docs-ref-allow: history-only backup removed by the reset (spec §2.13)`.
  - Explanatory comments in `check-rules-current.ts` / `check-rules-current-core.ts` / `doc-checks/line-ceiling.ts` / `run-blocking.ts` that name a deleted doc as history → **rephrase** to not spell the dead path (e.g. "the former single business-rules file, since split by domain"); no marker.
- [ ] **Step 4: Verify B green by value** — `npx vite-node scripts/doc-checks/run-blocking.ts` → `[docs] PASS docs-refs` and the other four PASS. Then `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`.
- [ ] **Step 5: Commit (real hook must pass now)** — stage Tasks 2 + 3 together so the hook sees a clean tree: `git add -A && git commit -m "chore: remove all dead docs/ references; restore-drill no longer touches deleted docs/audits (Phase 6)"`.

## Task 4: Full verification

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts && npm run build` — all green, including `[docs] PASS docs-refs`.
- [ ] **Step 2:** Independently confirm zero dead refs remain: re-run the Step-6 scan mentally/practically — the gate green is the proof.
- [ ] **Step 3:** Report to owner in Vietnamese: count of provenance citations scrubbed, the 8 pointers fixed, the drill's two crashes closed, and that any dead `docs/...` reference now reds the pre-commit gate everywhere in code.

## Task 5: Follow-up to flag (do NOT execute without a separate owner go)

The `lock-*.ts` one-off scripts and `lib/historical/**` are themselves "history-only" code kept by Phase 5 (the former because `lib/*.test.ts` read them; the latter as the data-explaining record). Under the owner's "no dead points" principle these are candidates for a later removal that deletes each script together with its coupled `lib/*.test.ts`. This is out of Phase 6 scope (touches `lib/` tests, reopens a Phase 5 keep decision) — surface it as an option, do not act.

---

## Self-Review

**Spec coverage:** §2.19 strip pointers → Tasks 2 (living) + 3 (provenance); §4 audit-deletion fallout → Task 3 Step 2; the systemic gap → Task 1 (whole-tree gate). Owner "no dead points" → broad gate + full scrub.

**Red-before-green:** Task 1 Step 2 = red by missing function; Step 6 = red by value (~370 real dead refs). Both distinctions reported per §9.

**Ordering safety:** gate lands first and red (one `--no-verify`); Tasks 2+3 turn it green in a single hook-passing commit; gate green is the completeness proof for the scrub. No production data, no logic, no `lib/historical`.

**Type consistency:** `checkDocsRefs` returns `CheckResult` (`{ check, ok, problems }`), matching the four checks `run-blocking.ts` already prints.
