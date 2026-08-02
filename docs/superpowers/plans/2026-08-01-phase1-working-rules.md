# Phase 1: Working Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace four drifting rule documents with one auto-loaded rulebook plus
three mechanisms that report when a rule has become false.

**Architecture:** `CLAUDE.md` becomes the only rule document read every session,
because the harness loads it automatically while any other file must be
voluntarily opened. Its rules are indexed by risk category rather than by file
path, so the phase 3 restructure cannot invalidate them. `docs/COLLABORATION.md`
and `AGENTS.md` are deleted — they existed to bridge three AI vendors that no
longer participate. Error prevention moves into a settings hook and a project
skill, which fire without being remembered, and `scripts/check-rules-current.ts`
runs in the pre-commit hook to catch rules that have drifted from reality.

**Tech Stack:** TypeScript, Vitest, `vite-node`, Claude Code settings/skills,
Husky.

**Spec:** `docs/superpowers/specs/2026-08-01-working-rules-and-repo-structure-design.md`

## Before you start: challenge this plan

Owner decision 2026-07-31 (spec D3). Read the whole plan, then report to the
coordinator what is wrong, missing, or unverifiable **before writing any code**.
If nothing is wrong, say so explicitly — silence is indistinguishable from
skipping the step.

Known-weak spots worth attacking first: the path-extraction rule in Task 1 (does
it produce false positives against the real `CLAUDE.md`?), and the reference
sweep in Task 3 (is the list of 11 living documents actually complete?).

## Global Constraints

- Code and comments in English. User-facing strings Vietnamese.
- `npx tsc --noEmit` must report 0 errors. Enforced by the Husky pre-commit hook.
- Full test suite green before each commit. Current baseline: 939 tests.
- One commit per task: one outcome plus its verification.
- Commit prefix `Claude-Sonnet <type>:`.
- Do not push.
- **No file under `app/`, `lib/`, `components/`, or `supabase/` may be created,
  modified, renamed, or deleted by this plan.** This phase touches documentation,
  `.claude/`, `.husky/`, `scripts/`, and `docs/` only. A diff touching those
  directories means the plan went off the rails — stop and report.
- `CLAUDE.md` must end at or under **130 lines**. The spec said 120; that number
  was chosen before the file was drafted, and the finished draft is exactly 120
  with nothing left to cut but rules. Raised to 130 by the coordinator
  2026-08-01 so the ceiling constrains bloat rather than forcing prose to be
  shaved to hit a guess. It is still a hard gate — exceeding it stops the task.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/check-rules-current-core.ts` (create) | The three drift checks, callable with an explicit file list so it is testable against fixtures | 1 |
| `scripts/check-rules-current.ts` (create) | CLI entry point — names the checked documents, prints, sets the exit code | 1 |
| `scripts/check-rules-current-core.test.ts` (create) | Fixture-based tests for all three checks, both passing and failing | 1 |
| `CLAUDE.md` (rewrite) | The single session-loaded rulebook | 2 |
| `docs/COLLABORATION.md` (delete), `AGENTS.md` (delete) | — | 3 |
| 10 living docs + 3 code comments (modify) | Repoint references away from the deleted files | 3 |
| `docs/OPEN-ITEMS.md` (modify), `docs/ROADMAP.md` (delete) | Collapse two competing pending-work lists into one | 3b |
| `docs/COMPLETED.md` (close, not delete), `README.md` (modify) | One live log, one scope statement, one signpost | 3c |
| `.claude/skills/fnbapp-bulk-data-change/SKILL.md` (create) | The bulk-data-change procedure, surfaced by description match | 4 |
| `.claude/settings.json` (modify) | Hook that fires on `--apply` commands and migration edits | 4 |
| `.husky/pre-commit` (modify) | Run the checker alongside `tsc` | 5 |

---

### Task 1: The drift checker

**Files:**
- Create: `scripts/check-rules-current-core.ts` (pure logic, exported)
- Create: `scripts/check-rules-current.ts` (CLI entry point)
- Test: `scripts/check-rules-current-core.test.ts`

The `-core.ts` split is this repository's existing convention for a script that
is both runnable and unit-tested — see `audit-admin-action-auth-core.ts`,
`audit-po-save-ledger-core.ts`, `audit-gate3-database-security-core.ts`,
`generate-script-cleanup-plan-core.ts`. Following it removes any need to guess
at runtime whether the module was imported or executed.

**Interfaces:**
- Produces: `checkRulesCurrent(ruleDocs: string[], repoRoot: string): CheckResult[]`
  where `type CheckResult = { check: string; ok: boolean; problems: string[] }`.
  Task 5 calls the CLI wrapper, not this function directly.
- Consumes: nothing from other tasks. Independent; runs first so Task 3's
  deletions have a verifier.

The checker takes its file list as an argument rather than hardcoding it, so
tests run against fixtures in a temp directory and never depend on the real
repository's current state.

- [ ] **Step 1: Write the failing tests**

Create `scripts/check-rules-current-core.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRulesCurrent } from "./check-rules-current-core";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rules-check-"));
  mkdirSync(join(root, "lib"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(relativePath: string, contents: string): void {
  writeFileSync(join(root, relativePath), contents, "utf8");
}

function resultFor(check: string, docs: string[]) {
  return checkRulesCurrent(docs, root).find(r => r.check === check)!;
}

describe("check 1: every path named in a rule doc exists", () => {
  it("passes when every named path is real", () => {
    write("lib/real-file.ts", "export const x = 1;");
    write("CLAUDE.md", "Read `lib/real-file.ts` before editing.");
    expect(resultFor("paths-exist", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("fails and names the missing path", () => {
    write("CLAUDE.md", "Read `lib/deleted-file.ts` before editing.");
    const result = resultFor("paths-exist", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("lib/deleted-file.ts");
  });

  it("ignores glob patterns, which name no single file", () => {
    write("CLAUDE.md", "UI lives in `app/**/page.tsx`.");
    expect(resultFor("paths-exist", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("ignores backticked text that is not a path", () => {
    write("CLAUDE.md", "Run `npx tsc --noEmit` and `--apply` carefully.");
    expect(resultFor("paths-exist", ["CLAUDE.md"]).ok).toBe(true);
  });

  // Prefix matching alone skipped every root-level file, so CLAUDE.md could
  // point at a deleted README.md forever without the checker noticing.
  it("checks root-level documents that carry no directory prefix", () => {
    write("CLAUDE.md", "Bối cảnh nằm ở `CONTEXT.md`.");
    const result = resultFor("paths-exist", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("CONTEXT.md");
  });

  it("passes a root-level document that exists", () => {
    write("CONTEXT.md", "bối cảnh");
    write("CLAUDE.md", "Bối cảnh nằm ở `CONTEXT.md`.");
    expect(resultFor("paths-exist", ["CLAUDE.md"]).ok).toBe(true);
  });

  // Documents under docs/ cite their siblings relatively. Resolving only from
  // the repo root would fail every one of them.
  it("resolves a sibling reference relative to the citing document", () => {
    write("docs/ACCESS-MODEL.md", "roles");
    write("docs/BUSINESS-RULES.md", "Xem `ACCESS-MODEL.md`.");
    expect(resultFor("paths-exist", ["docs/BUSINESS-RULES.md"]).ok).toBe(true);
  });
});

describe("check 2: no retired agent is named as current", () => {
  it("passes for the two current agents", () => {
    write("CLAUDE.md", "Opus 5 coordinates. Sonnet 5 implements.");
    expect(resultFor("no-retired-agents", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("fails and names the retired agent", () => {
    write("CLAUDE.md", "Codex owns the engine files.");
    const result = resultFor("no-retired-agents", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("Codex");
  });

  // OPEN-ITEMS.md must be able to say a task was stranded when Codex left.
  // Policing history out of the backlog would destroy the very record that
  // makes stranded work findable.
  it("polices only the rulebook, not the backlog", () => {
    write("docs/OPEN-ITEMS.md", "Việc này từng giao cho Codex, agent đã ngừng.");
    expect(resultFor("no-retired-agents", ["docs/OPEN-ITEMS.md"]).ok).toBe(true);
  });
});

describe("check 3: a declared test link points at a test that exists", () => {
  it("passes when the test file and the test name are both present", () => {
    write("lib/rounding.test.ts", `it("tiền luôn làm tròn lên", () => {});`);
    write(
      "docs/BUSINESS-RULES.md",
      'Test: `lib/rounding.test.ts` — "tiền luôn làm tròn lên"',
    );
    expect(resultFor("business-rule-tests", ["docs/BUSINESS-RULES.md"]).ok).toBe(true);
  });

  it("fails when the test file is missing", () => {
    write("docs/BUSINESS-RULES.md", 'Test: `lib/gone.test.ts` — "một luật nào đó"');
    expect(resultFor("business-rule-tests", ["docs/BUSINESS-RULES.md"]).ok).toBe(false);
  });

  it("fails when the file exists but no longer contains the named test", () => {
    write("lib/rounding.test.ts", `it("một tên khác hẳn", () => {});`);
    write(
      "docs/BUSINESS-RULES.md",
      'Test: `lib/rounding.test.ts` — "tiền luôn làm tròn lên"',
    );
    const result = resultFor("business-rule-tests", ["docs/BUSINESS-RULES.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("tiền luôn làm tròn lên");
  });

  it("passes a rule that declares no test link at all", () => {
    write("docs/BUSINESS-RULES.md", "Một luật chưa có test.");
    expect(resultFor("business-rule-tests", ["docs/BUSINESS-RULES.md"]).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/check-rules-current-core.test.ts`
Expected: FAIL — `check-rules-current` does not exist yet.

- [ ] **Step 3: Write the checker**

Create `scripts/check-rules-current-core.ts`:

```ts
/**
 * Reports when a rule document has drifted from reality.
 *
 * Prose rules rot silently because staying true depends on someone
 * remembering to update them. These three checks are the parts of that
 * memory work a machine can do, each corresponding to a drift already
 * observed in this repository.
 *
 * Takes its file list as an argument so tests can run against fixtures.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export type CheckResult = {
  check: string;
  ok: boolean;
  problems: string[];
};

const PATH_PREFIXES = [
  "app/", "lib/", "components/", "scripts/", "docs/",
  "supabase/", "types/", ".claude/", ".husky/",
];

// A backticked token is a path when it names a known top-level directory or is
// a bare document filename. Prefix matching alone silently skipped every
// root-level file -- README.md, CONTEXT.md, DEVELOPMENT-TRACKING.md -- so the
// three of them that CLAUDE.md section 10 depends on were never verified at
// all. A token containing a space is prose or a shell command, never a path.
function looksLikePath(token: string): boolean {
  if (token.includes("*") || token.includes(" ") || token.includes("{")) {
    return false;
  }
  if (PATH_PREFIXES.some(prefix => token.startsWith(prefix))) return true;
  return /^[A-Za-z][A-Za-z0-9._-]*\.md$/.test(token);
}

const RETIRED_AGENTS = ["Codex", "Antigravity", "GLM", "Gemini"];

function backtickedTokens(text: string): string[] {
  return Array.from(text.matchAll(/`([^`\n]+)`/g)).map(match => match[1]);
}

function checkPathsExist(docs: string[], repoRoot: string): CheckResult {
  const problems: string[] = [];
  for (const doc of docs) {
    const docPath = join(repoRoot, doc);
    if (!existsSync(docPath)) continue;
    const docDir = dirname(docPath);
    for (const token of backtickedTokens(readFileSync(docPath, "utf8"))) {
      if (!looksLikePath(token)) continue;
      // Strip a trailing line-number reference such as file.ts:123-145.
      const path = token.replace(/:\d+(-\d+)?$/, "");
      // Root files are cited from the root (`README.md` in CLAUDE.md) and
      // siblings are cited relatively (`ACCESS-MODEL.md` inside docs/).
      // Accept either, or the sibling form fails against the repo root.
      if (existsSync(join(repoRoot, path)) || existsSync(join(docDir, path))) {
        continue;
      }
      problems.push(`${doc} names '${path}', which does not exist`);
    }
  }
  return { check: "paths-exist", ok: problems.length === 0, problems };
}

// Scoped to the rulebook alone. A pending-work list legitimately records
// history -- "this was assigned to Codex, who no longer exists" is a true and
// necessary sentence that must not fail a commit. This check exists to stop
// the rules describing a retired agent as current, nothing more.
const AGENT_CURRENT_DOCS = ["CLAUDE.md"];

function checkNoRetiredAgents(docs: string[], repoRoot: string): CheckResult {
  const problems: string[] = [];
  for (const doc of docs) {
    if (!AGENT_CURRENT_DOCS.includes(doc)) continue;
    const docPath = join(repoRoot, doc);
    if (!existsSync(docPath)) continue;
    const lines = readFileSync(docPath, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const agent of RETIRED_AGENTS) {
        if (line.includes(agent)) {
          problems.push(`${doc}:${index + 1} names retired agent '${agent}'`);
        }
      }
    });
  }
  return { check: "no-retired-agents", ok: problems.length === 0, problems };
}

// A rule declares its test as:  Test: `path/to/file.test.ts` — "test name"
const TEST_LINK = /Test:\s*`([^`]+)`\s*[—-]\s*"([^"]+)"/g;

function checkBusinessRuleTests(docs: string[], repoRoot: string): CheckResult {
  const problems: string[] = [];
  for (const doc of docs) {
    const docPath = join(repoRoot, doc);
    if (!existsSync(docPath)) continue;
    const contents = readFileSync(docPath, "utf8");
    for (const match of contents.matchAll(TEST_LINK)) {
      const [, testFile, testName] = match;
      const testPath = join(repoRoot, testFile);
      if (!existsSync(testPath)) {
        problems.push(`${doc} links to '${testFile}', which does not exist`);
        continue;
      }
      if (!readFileSync(testPath, "utf8").includes(testName)) {
        problems.push(`${testFile} no longer contains the test "${testName}"`);
      }
    }
  }
  return { check: "business-rule-tests", ok: problems.length === 0, problems };
}

export function checkRulesCurrent(docs: string[], repoRoot: string): CheckResult[] {
  return [
    checkPathsExist(docs, repoRoot),
    checkNoRetiredAgents(docs, repoRoot),
    checkBusinessRuleTests(docs, repoRoot),
  ];
}

```

The list of checked documents does **not** live here. It belongs to the CLI,
because choosing what to check is a policy decision and this file is the
mechanism. Step 3b carries it.

- [ ] **Step 3b: Write the CLI as a separate file**

The pure logic above lives in `-core.ts` and the runnable entry point is its own
file, following the convention this repository already uses for
`audit-admin-action-auth`, `audit-po-save-ledger`,
`audit-gate3-database-security` and `generate-script-cleanup-plan`.

**Do not guard the entry point on `process.argv[1]`.** An earlier revision did,
and under `vite-node` `process.argv[1]` is
`node_modules/vite-node/dist/cli.mjs`, never the script path — so the guard was
always false, `main()` never ran, and the command printed nothing while exiting
0. A checker that silently passes is worse than no checker, because Task 5 wires
that exact command into the commit gate.

Create `scripts/check-rules-current.ts`:

```ts
/**
 * CLI for the rule drift checks. Logic and tests live in
 * check-rules-current-core.ts; this file only runs it and reports.
 */
import { checkRulesCurrent } from "./check-rules-current-core";

// Documents that make claims about the present. Chronicles are deliberately
// absent: DEVELOPMENT-TRACKING.md cites hundreds of paths inside dated entries,
// many pointing at files correctly deleted since, and a chronicle entry is a
// record of what was true then -- not a claim about now. Measured 2026-08-01:
// checking it would fire on ~230 paths, essentially none of them defects.
const RULE_DOCS = ["CLAUDE.md", "docs/BUSINESS-RULES.md", "docs/OPEN-ITEMS.md"];

const results = checkRulesCurrent(RULE_DOCS, process.cwd());
let failed = false;
for (const result of results) {
  if (result.ok) {
    console.log(`[rules] PASS ${result.check}`);
    continue;
  }
  failed = true;
  console.error(`[rules] FAIL ${result.check}`);
  result.problems.forEach(problem => console.error(`  ${problem}`));
}
if (failed) {
  console.error("\n[rules] A rule document disagrees with the repository.");
  // exitCode, not exit(): lets stdout flush before the process ends.
  process.exitCode = 1;
}
```

- [ ] **Step 3c: Prove the CLI actually runs**

Run: `npx vite-node scripts/check-rules-current.ts; echo "EXIT=$?"`

**This step runs before Task 2, so a clean result is not what proves success.**
The `CLAUDE.md` still on disk is the old one, which names Codex and Antigravity,
so the correct outcome here is a *loud failure*:

```
[rules] PASS paths-exist
[rules] FAIL no-retired-agents
  CLAUDE.md:5 names retired agent 'Codex'
  CLAUDE.md:87 names retired agent 'Codex'
  CLAUDE.md:87 names retired agent 'Antigravity'
[rules] PASS business-rule-tests

[rules] A rule document disagrees with the repository.
EXIT=1
```

That is the checker working: three checks reported, a real defect found in a
real file, and a non-zero exit code. Task 2 turns those three lines into PASS by
rewriting `CLAUDE.md`; Task 2 Step 3 is where an all-PASS run is expected.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Nếu lệnh này KHÔNG in gì và EXIT=0 -> main không chạy, checker chết. Đó là
  lỗi bản trước, nguy hiểm vì Task 5 gắn đúng lệnh này vào cổng chặn commit:
  cổng sẽ luôn báo qua mà không kiểm gì. DỪNG.
  Báo lỗi to = ĐẠT. Im lặng = HỎNG. Đừng đọc ngược.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/check-rules-current-core.test.ts`
Expected: PASS, 14 tests (7 for check 1, 3 for check 2, 4 for check 3).

- [ ] **Step 5: Run the full suite and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 953 tests green (939 baseline + 14 new), 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-rules-current-core.ts scripts/check-rules-current.ts \
        scripts/check-rules-current-core.test.ts
git commit -m "Claude-Sonnet feat: a checker that reports when a rule has drifted from reality

Three checks, each matching a drift already observed here: a rule document
naming a path that no longer exists, a retired agent still described as
current, and a business rule whose test has been renamed out from under it.

Takes its file list as an argument so the tests run against fixtures rather
than the repository's live state. Not yet wired into pre-commit -- Task 5
does that, after the documents it checks have been rewritten.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite `CLAUDE.md` as the rulebook

**Files:**
- Modify: `CLAUDE.md` (full rewrite)

**Interfaces:**
- Consumes: nothing. The checker from Task 1 is not yet wired in.
- Produces: the document Task 3 repoints references toward and Task 5 verifies.

The content below is final. Write it exactly; do not improvise additions. Every
line earns its place against a 130-line ceiling, and the ceiling is the point —
this file is loaded on every session, so length is a recurring cost.

Two things deliberately stay in this file rather than moving to
`docs/BUSINESS-RULES.md`: the inventory reasoning rule (section 7) and the
communication rules (section 5). `BUSINESS-RULES.md` holds calculations and their
tests; `CLAUDE.md` holds how to *reason* about the domain and how to talk to the
owner. Both are needed in working memory every session.

**One section of the old file is dropped, deliberately.** The previous
`CLAUDE.md` carried a "Token Efficiency" section — do not re-read a file you
just edited, batch edits, prefer Grep over Read. It is gone from the rewrite,
and that is a decision rather than an oversight: the harness itself now
instructs the agent not to re-read files it just edited, and the remainder is
generic agent hygiene rather than a rule about this shop. Nothing in it is
project-specific enough to spend session context on every single time. Recorded
here because it was dropped silently in the first draft, which is exactly the
kind of quiet loss this whole phase exists to prevent.

**Correction added 2026-08-01, after Task 2 had already run.** The risk table
below gained one row: *"Xoá dữ liệu gốc … Không xoá. Đánh dấu ngừng dùng."*

Deleting `docs/COLLABORATION.md` in Task 3 removed the only statement of the
never-delete-master-data rule. Two places cite it — `docs/OPEN-ITEMS.md` item 14
and `scripts/fix-backwards-recipe-intervals.ts` — and after the deletion the
rule survived only as a fragment inside one item's justification, with no
document stating it. The code still obeys it everywhere (soft-delete via a
status column), so this was silent loss of a real, live rule, caught by the
implementer rather than by any check.

It belongs in this table rather than `docs/BUSINESS-RULES.md`: that file holds
calculations paired with tests, while this is a prohibition on a destructive
action, and an agent about to delete a row must already have it in mind rather
than know to go looking. The stated reason matters as much as the rule — an old
order cannot explain its own numbers if the ingredient or recipe it names has
been erased.

If Task 2 is already committed, apply this as a follow-up commit; `CLAUDE.md`
goes from 120 to 121 lines, still under the 130 ceiling.

- [ ] **Step 1: Replace the entire contents of `CLAUDE.md`**

````markdown
# CLAUDE.md — FNB App

Bộ quy tắc duy nhất phải đọc mỗi phiên. Mọi thứ khác chỉ tra khi cần.

## 1. Ai làm gì

Hai agent, cả hai đều là Claude Code:

- **Opus 5** — điều phối: viết spec, viết plan, review. Không tự viết code.
- **Sonnet 5** — thực thi toàn bộ code, script, và cập nhật cấu trúc dữ liệu.

**Sonnet phản biện plan trước khi code** (chủ quán chốt 2026-07-31). Đọc plan,
chỉ ra chỗ sai, chỗ thiếu, chỗ không kiểm chứng được — báo lại rồi mới làm.
Nếu soát mà không thấy gì thì phải nói rõ là đã soát và sạch: im lặng không
phân biệt được với bỏ qua.

Không ai vừa làm vừa tự duyệt việc của mình.

## 2. Mức rủi ro quyết định mọi thứ

Không tra theo đường dẫn file — file sẽ đổi chỗ. Tra theo loại việc:

| Loại việc | Bắt buộc |
|---|---|
| Đụng giá vốn hoặc tồn kho | Có plan; Sonnet phản biện; kèm script kiểm tra chạy lại được |
| Ghi vào dữ liệu thật | Mặc định chạy thử; `--apply` mới ghi; in số lượng và đối tượng chính xác trước khi ghi; chủ quán duyệt lần ghi |
| Xoá dữ liệu gốc (nguyên liệu, món, công thức, đơn, nhà cung cấp) | **Không xoá. Đánh dấu ngừng dùng.** Đơn hàng cũ vẫn cần chúng để giải thích được số của chính nó |
| Lộ ra ngoài repo (push, deploy) | Chủ quán duyệt từng lần. Không có uỷ quyền sẵn |
| Đổi một quy tắc kinh doanh | Sửa luật và sửa test của nó trong cùng một lần lưu |
| Còn lại | Agent tự quyết, làm xong báo lại bằng tiếng Việt dễ hiểu |

## 3. Sửa dữ liệu hàng loạt

Backfill, migration, tính lại lịch sử — dùng skill `fnbapp-bulk-data-change`.

Điều dễ quên nhất, đã gây sự cố 2026-07-31: **liệt kê trigger của bảng sắp sửa
và nói rõ mỗi cái làm gì với những dòng bị đụng.** Một lệnh được coi là "không
đổi hành vi" vẫn có thể kích hoạt trigger rồi hẹn giờ cho một tiến trình tự
động ghi đè dữ liệu lịch sử.

## 4. Ví dụ tính sẵn là bắt buộc

Mọi bước plan đụng dữ liệu thật phải kèm một ví dụ **tính trước bằng số thật**:
một món có tên, một dòng đơn hàng có mã, con số phải ra. Không phải minh hoạ
định dạng — một trường hợp người thực thi đối chiếu được trước khi chạy cả lô.

Và trước khi viết plan, phải xác nhận ý chủ quán tới ~95% **bằng một ví dụ cụ
thể**, không phải bằng cách diễn đạt lại trừu tượng.

Trước khi kết luận từ một truy vấn, nói rõ truy vấn đó **không** cho thấy điều gì.

## 5. Nói chuyện với chủ quán

Chủ quán là người kinh doanh, không phải người viết phần mềm.

- Tiếng Việt, không thuật ngữ. Dùng thì phải giải nghĩa ngay lần đầu.
- **Gọi tên thật** của nguyên liệu và món ("Trứng gà"), không đọc mã ("NNL-007").
- Chỉ hỏi chủ quán **quyết định kinh doanh**: ưu tiên, phạm vi, đánh đổi, bất cứ
  thứ gì đụng tiền thật hoặc không thể quay đầu. Việc kỹ thuật thì tự quyết, làm
  xong báo lại.
- Mỗi lần chỉ hỏi **một** vấn đề. Liệt kê lựa chọn, nêu khuyến nghị, chờ chọn.
- **Chủ động cảnh báo ảnh hưởng chéo.** Nếu việc đang làm có thể ảnh hưởng hoặc
  phụ thuộc việc khác trong cùng phiên, nói ngay — đừng đợi được hỏi. Im lặng bị
  hiểu là "đã kiểm tra và ổn".

## 6. Quy tắc kinh doanh mới sinh ra thế nào

Khi chủ quán chốt điều gì thay đổi **cách tính**, **cách hiển thị số**, hoặc
**cách vận hành**, ghi ngay vào `docs/BUSINESS-RULES.md` trong cùng phiên đó,
kèm ngày. Thứ làm mất một quy tắc không phải là thiếu chỗ ghi — mà là nó được
chốt trong lúc trao đổi rồi trôi đi.

## 7. Tồn kho và giá vốn: nền tảng để suy luận

Chủ quán xác nhận 2026-07-22. Không suy diễn khác đi.

1. **Chưa từng có lệnh nấu bán thành phẩm chính thức trong lịch sử.** Đừng giả
   định dữ liệu sản xuất quá khứ là đáng tin.
2. **Chỉ ba nguồn đáng tin:** công thức, đơn bán hàng, đơn nhập hàng. Dùng công
   thức + đơn bán để trừ tồn; dùng đơn nhập để tính giá vốn bình quân gia quyền.
   Mọi dòng khác trong sổ kho là **suy ra**, không phải gốc.
3. **Trừ tồn khi bán:** món dùng nguyên liệu thô thì trừ thẳng. Món dùng bán
   thành phẩm mà tồn không đủ thì hệ thống tự sinh lệnh nấu ngầm — trừ nguyên
   liệu thô theo công thức nấu, cộng tồn bán thành phẩm, rồi mới trừ để pha chế.

## 8. Viết code

- Code và chú thích bằng tiếng Anh. Chữ hiển thị cho người dùng bằng tiếng Việt.
- Đơn giản trước. Không thêm tính năng, trừu tượng, hay tuỳ biến ngoài yêu cầu.
- Chỉ chạm đúng chỗ cần. Không "cải thiện" code lân cận, không refactor thứ
  không hỏng. Thấy code chết không liên quan thì nói, đừng tự xoá.
- Không rõ thì hỏi, đừng đoán.

## 9. Xong việc nghĩa là gì

- `npx tsc --noEmit` — 0 lỗi.
- `npx vitest run` — toàn bộ xanh. Không xoá test mà không nêu lý do.
- `npx vite-node scripts/check-rules-current.ts` — sạch.
- Việc đụng giá vốn hoặc tồn kho: chạy script kiểm tra tương ứng, 0 sai lệch.
- Ghi một mục vào `DEVELOPMENT-TRACKING.md`, cập nhật `docs/OPEN-ITEMS.md` nếu
  có mục nào đổi trạng thái.
- Không push.

## 10. Tra ở đâu

| Cần gì | Ở đâu |
|---|---|
| Việc chưa xong | `docs/OPEN-ITEMS.md` |
| Cách tính, nguyên tắc hiển thị số | `docs/BUSINESS-RULES.md` |
| Quán là gì, phạm vi tới đâu | `CONTEXT.md` |
| Đã làm gì, khi nào | `DEVELOPMENT-TRACKING.md` |
| Thuật ngữ | `docs/domain-dictionary.md` |
| Cách chạy máy, công nghệ dùng gì | `README.md` |
| File mới đặt ở đâu | `docs/FILE-ORGANIZATION.md` |
| Vì sao có một luật | git log |
| Màn hình, hành động phía máy chủ | `app/` |
| Bộ máy tính: giá vốn, tồn kho, báo cáo | `lib/` |
| Giao diện dùng chung | `components/` |
| Cập nhật cấu trúc dữ liệu | `supabase/migrations/` |

Bốn dòng cuối là thư mục code, tạm tới khi chia lại theo mảng nghiệp vụ.
````

This "where the code lives" block is deliberately four lines about *directories*,
not a file-by-file map. A hand-written file map rots within a week; four
directory names do not. It sits in `CLAUDE.md` rather than `ARCHITECTURE.md`
because this is the file a session actually loads, and — the part that makes it
self-defending — the checker's `paths-exist` check validates every path in it, so
the phase 3 restructure cannot move a directory without the next commit being
blocked until this block is updated.

- [ ] **Step 2: Verify the line ceiling**

Run: `wc -l < CLAUDE.md`

Expected: **120**, which is the drafted file's exact length, against a ceiling
of 130. Anything above 130 means text was added that the plan did not specify —
stop and report rather than trimming rules to fit, because the ceiling is a
design constraint the coordinator owns.

- [ ] **Step 3: Verify the checker is satisfied by the new file**

Run: `npx vite-node scripts/check-rules-current.ts`

Expected: `PASS paths-exist`, `PASS no-retired-agents`, `PASS business-rule-tests`.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Mục 10 nhắc 11 đường dẫn, cả 11 đều tồn tại hôm nay:
    docs/OPEN-ITEMS.md, docs/BUSINESS-RULES.md, docs/domain-dictionary.md,
    docs/FILE-ORGANIZATION.md, CONTEXT.md, DEVELOPMENT-TRACKING.md,
    README.md, app/, lib/, components/, supabase/migrations/
  Bốn cái đầu khớp theo tiền tố thư mục; ba cái giữa là file gốc không có
  thư mục — CHỈ được kiểm sau khi Task 1 sửa looksLikePath. Nếu checker báo
  sạch mà không hề nhắc ba file gốc đó, nghĩa là bản sửa chưa vào. DỪNG.
```

- [ ] **Step 4: Run the full suite and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: green, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Claude-Sonnet refactor: CLAUDE.md becomes the only rulebook read each session

Rules are now indexed by risk category rather than by file path. The previous
protocol enumerated lib/mac-cogs.ts, scripts/**, app/**/page.tsx and similar,
which the phase 3 restructure would have invalidated wholesale; 'touches cost
or stock', 'writes production data', 'visible outside the repo' survive a
refactor.

Placed here rather than in a referenced document because the harness loads
this file automatically while any other file must be voluntarily opened --
and the previous version's own instruction to read six other files first is
the evidence that voluntary reading does not happen: those files sat stale
for weeks.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Delete the coordination files and repoint what still points at them

**Files:**
- Delete: `docs/COLLABORATION.md`, `AGENTS.md`
- Modify: every living document and code comment that references either

**Interfaces:**
- Consumes: `CLAUDE.md` from Task 2, which is where most references are repointed.
- Produces: a repository where `check-rules-current.ts` check 1 can pass.

Both files existed to bridge three AI vendors that each loaded a different
instruction file. With two agents that both auto-load `CLAUDE.md`, there is no
gap left to bridge.

- [ ] **Step 1: Produce the current reference list**

```bash
git grep -ln "COLLABORATION\.md\|AGENTS\.md" | sort
```

Expected: **69 files**, verified 2026-08-01.

**Every search in Tasks 3, 3b and 3c uses `git grep`, never `grep -r`.** Three
independent reasons, each of which broke an earlier revision of this plan:

1. **Exclusions are by path, not by substring.** `grep -rn` prints
   `path:line:content`, so a downstream `grep -v "docs/handoffs/"` also matches
   when that text appears in the *content* of a line. It silently discarded real
   findings in files that merely mentioned a handoff. `git grep`'s pathspec
   (`':!docs/handoffs'`) filters the path and nothing else.
2. **Binary files.** `grep -r` emits `Binary file ./.git/index matches`, which
   no `^\./\.git/` filter catches because the line begins with `Binary file`.
   `git grep` skips binaries by default.
3. **Ignored directories.** `git grep` searches tracked files only, so
   `node_modules/`, `.next/`, `.git/` and `.superpowers/` disappear without a
   single filter — including the two `.next/cache/**/*.pack` build artifacts an
   earlier count picked up and could not classify.

Expected: roughly 68 files. Classify each into exactly one bucket:

| Bucket | Action |
|---|---|
| `docs/handoffs/**` | **Leave untouched.** Immutable point-in-time briefs, most addressed to agents that no longer exist. A dead link in a historical record harms nothing. |
| `docs/audits/**`, `docs/superpowers/**` | **Leave untouched**, same reason — except this plan and its spec, which already describe the deletion correctly. |
| Living documents | Repoint to `CLAUDE.md` |
| Code and config comments | Repoint to `CLAUDE.md` |

The living-document set, verified 2026-08-01:

```
README.md
ARCHITECTURE.md
CLAUDE.md
DEVELOPMENT-TRACKING.md
docs/TESTING.md
docs/COMPLETED.md
docs/OPEN-ITEMS.md
docs/ACCESS-MODEL.md
docs/FEATURE-CATALOG.md
docs/FILE-ORGANIZATION.md
```

**`docs/ROADMAP.md` is deliberately absent from that list.** Task 3b deletes it,
so repointing its references would be wasted work. Leave it alone in this task.

Code and config:

```
.husky/pre-commit                  (line 2, header comment)
scripts/fix-backwards-recipe-intervals.ts
supabase/migrations/0051_recipes_end_after_start.sql
```

`.husky/pre-commit`'s header comment is repointed **here, in Task 3**, not in
Task 5. Task 5 only adds the checker invocation to the same file. Splitting one
line of text across two tasks was an earlier drafting error.

**`supabase/migrations/0051_...sql` is the one exception to this plan's
"no `supabase/` edits" constraint** — it is a comment line in an
already-applied migration. Changing a comment in an applied migration file
does not re-run it and does not alter the database. If touching it feels
wrong, leave it: a stale comment in an applied migration is harmless, and the
checker does not read migration files. Prefer leaving it.

- [ ] **Step 2: Repoint each living reference**

For each file in the living-document list, replace the reference with the
equivalent pointer to `CLAUDE.md`. Two shapes recur:

- "see `docs/COLLABORATION.md` section E (Merge Gate)" → "see `CLAUDE.md`
  section 9 (Xong việc nghĩa là gì)"
- "per `docs/COLLABORATION.md`" → "per `CLAUDE.md`"

Where a reference points at content that no longer exists anywhere — the model
selection matrix, the three-agent ownership table, the Codex handoff template —
**delete the sentence containing it** rather than repointing it. Do not invent a
new home for retired content.

`DEVELOPMENT-TRACKING.md` and `docs/COMPLETED.md` are historical logs: only
repoint references in their *header or standing-instruction* sections, never
inside a dated entry. A dated entry is a record of what was true then.

- [ ] **Step 3: Remove the stale session instruction**

`CLAUDE.md` as written in Task 2 no longer instructs anyone to read
`docs/handoffs/2026-06-25-codex-handoff-active-task-tracking.md`. Confirm no
other living document still does:

```bash
git grep -n "2026-06-25-codex-handoff" -- . \
  ':!docs/handoffs' ':!docs/audits' ':!docs/superpowers'
```

Expected, measured 2026-08-01 — **not** an empty result:

```
AGENTS.md                       1 line   deleted in Step 4
CLAUDE.md                       1 line   see below
DEVELOPMENT-TRACKING.md         2 lines  chronicle, dated entries, leave
docs/COLLABORATION.md           1 line   deleted in Step 4
scripts/trace-ing003-sua-dac.ts 1 line   header comment, leave
```

The previous revision of this step filtered with `grep -v docs/handoffs/`, and
**every real citation writes the full path**
`docs/handoffs/2026-06-25-codex-handoff-active-task-tracking.md` — so the filter
discarded 100% of them and the step returned nothing but binary noise. It could
not have failed for any state of the repository. That is worse than a wrong
expectation: a check that always passes.

`CLAUDE.md` appears here only if Task 2 has not run yet. The rewritten file
does not mention the handoff, so after Task 2 this line should be gone —
if it is still present, Task 2 was not applied as written.

`scripts/trace-ing003-sua-dac.ts` is a closed one-off investigation script whose
header comment cites the handoff as the source of its task. That citation is a
historical fact and stays — same rule as the chronicle. The handoff file itself
also stays where it is.

Anything **outside** this list means a living document still routes sessions to
a task brief for an agent that no longer exists. Repoint that one.

- [ ] **Step 4: Delete the two files**

```bash
git rm docs/COLLABORATION.md AGENTS.md
```

- [ ] **Step 5: Verify no living reference survives**

```bash
git grep -n "COLLABORATION\.md\|AGENTS\.md" -- . \
  ':!docs/handoffs' ':!docs/audits' ':!docs/superpowers' ':!DEVELOPMENT-TRACKING.md'
```

Expected, measured 2026-08-01 — exactly three files remain:

```
docs/ROADMAP.md                              6 lines   deleted in Task 3b
docs/COMPLETED.md                            2 lines   deleted in Task 3c
supabase/migrations/0051_recipes_end_...sql  1 line    left alone, on purpose
```

The migration is the one Step 1 says to prefer leaving: a comment inside an
already-applied migration, which no reader consults and which the checker never
opens. An earlier revision of this step expected only two files and would have
contradicted Step 1 for the same file.

`DEVELOPMENT-TRACKING.md` is excluded by pathspec, not repointed: it carries
**29** matching lines, all inside dated entries, which Step 2's own rule says to
leave alone. An earlier revision of this step expected "exactly one match in
`docs/ROADMAP.md`" — wrong three times over. `ROADMAP.md` has six lines, not
one; `COMPLETED.md` still exists at this point; and the chronicle's 29 lines
were neither excluded nor expected, so the implementer would have met dozens of
unexpected results and, following this step's old instruction to go fix them,
would have rewritten history that Step 2 forbids touching.

Anything outside those two files means a living document was missed in Step 1 —
repoint it and say so when reporting.

- [ ] **Step 6: Run the checker, the full suite, and the type check**

Run: `npx vite-node scripts/check-rules-current.ts && npx vitest run && npx tsc --noEmit`
Expected: checker clean, suite green, 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Claude-Sonnet refactor: delete both coordination files, repoint what pointed at them

docs/COLLABORATION.md and AGENTS.md existed to bridge three AI vendors that
each loaded a different instruction file, so no single file was read by all of
them. With Opus and Sonnet -- both Claude Code, both auto-loading CLAUDE.md --
there is nothing left to bridge.

Living documents and code comments repointed to CLAUDE.md. References inside
docs/handoffs/, docs/audits/ and docs/superpowers/ deliberately left dangling:
those are immutable point-in-time records, and a dead link in one harms
nothing. Retired content (model matrix, three-agent ownership, Codex handoff
template) had its referencing sentences deleted rather than rehomed.

History is preserved by git, which is the whole reason no replacement history
file was created.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3b: One pending-work list, not two

**Files:**
- Modify: `docs/OPEN-ITEMS.md`
- Delete: `docs/ROADMAP.md`
- Modify: any living document that references `docs/ROADMAP.md`

**Interfaces:**
- Consumes: Task 3's repointing pass, which deliberately skipped `ROADMAP.md`.
- Produces: a single pending-work list, which Task 5's checker reads (it is in
  `RULE_DOCS`).

`docs/ROADMAP.md` line 3 says "Single source of truth for pending tasks."
`docs/OPEN-ITEMS.md` line 2 says "The single list of what is not finished." Two
files, the same claim. `OPEN-ITEMS.md` was created 2026-07-30 *because*
`ROADMAP.md` had stopped being maintained — a second list to fix an unmaintained
first list, which leaves two to maintain.

`OPEN-ITEMS.md` survives because it is the one that survived contact with
reality: 70 lines, one line per item, and it is actually being updated.
`ROADMAP.md` is 320 lines whose own stated process ("move the entry to
`COMPLETED.md` when done") nobody follows — which is why its P1 and P2 queues are
now almost entirely closed rows.

**`ROADMAP.md` also carries a third copy of the agent ownership table**, naming
"Claude (GLM 5.1)", "Codex (GPT 5.5)" and "Antigravity (Gemini 3.1)". The same
table lives in the two files Task 3 deletes. Three copies of one fact was the
whole disease.

- [ ] **Step 1: Migrate the genuinely-open items**

Read `docs/ROADMAP.md` in full. Every row in P1, P2 and P3 is either `[x]`
closed — in which case it stays closed and is **not** migrated — or genuinely
open, in which case it becomes a one-line entry in `docs/OPEN-ITEMS.md` in that
file's existing format (what it is, why it is still open).

The open set, classified 2026-08-01. Migrate exactly these:

| From `ROADMAP.md` | Becomes |
|---|---|
| `INV-COUNT-1` — marked `[~X]`, "in progress by Codex" | **Stranded work.** Phase S1 shipped (commit `88774a0`); migration `0036_stocktake_sessions.sql` written but never applied to production; phase S2 never started. It was assigned to an agent that no longer exists, so nobody is holding it. |
| `COGS-1-FOLLOWUP` — `CRON_SECRET` | Owner action in Vercel settings; the nightly correction sweep cannot run without it |
| `H1. Push local commits` | Note the real current count rather than copying the stale "41+" |
| `OPS-CONT-1` — operational continuity audit | Single-owner dependency on the Vercel/Supabase/Google/GitHub accounts; never audited in any gate |
| `INFRA-UPGRADE-1` — Next.js 14→16 | Carries `DEP-1`'s remaining advisories, which are only fixed in next@16 |
| `V1` — first real operator backdate verify | Waiting on the operator to backdate a purchase order in the real UI |

Do **not** migrate the unticked duplicate `PERF-1` row: an identical row three
lines above is marked `[x]`, closed by being folded into `PERF-2`. The unticked
copy is stale, not open. Note the duplicate in the commit message.

**One reconciliation needs judgment — flag it, do not silently resolve it.**
`OPEN-ITEMS.md` item 15 already says "Physical stocktake — owner moved it behind
Phase 7", while `INV-COUNT-1` is the half-built feature that supports exactly
that. They may be the same item at two different altitudes, or a deferred
business activity plus its stranded tooling. Write both, mark the relationship
explicitly, and raise it to the coordinator rather than merging them on a guess.

- [ ] **Step 2: Carry over the two sections that are not open items**

`ROADMAP.md` holds two sections that are neither pending work nor closed work,
and both must survive:

1. **"Future direction"** (lines 105-156) — the owner's seven-phase order, set
   2026-07-18/19. Copy it into `docs/OPEN-ITEMS.md` as its own section. Update
   only what is now known to be false: item 1's eight-gate audit is finished, and
   item 2's repository reorganization refers to the 2026-07-20 docs-and-scripts
   pass, **not** the application-code restructure planned as phase 3 of the
   current program — say so, or the next reader will conclude the restructure is
   already done.
2. **"Out of scope (do not start without explicit approval)"** (lines 157-165) —
   copy across verbatim except the negative-stock entry, whose live figures are
   from 2026-07-19 and have been superseded several times since. Replace those
   figures with a pointer to the most recent audit rather than carrying numbers
   that are now wrong.

- [ ] **Step 3: Prove nothing was lost**

For every `ROADMAP.md` row in P0/P1/P2/P3/Blocked, confirm it is in exactly one
of three states, and list the counts in the commit message:

```
closed   ([x], stays closed, not migrated)      : N
migrated (now a line in OPEN-ITEMS.md)          : 6
dropped  (stale duplicate, with a reason)       : 1
```

Any row that fits none of the three is a row you do not understand yet — stop
and ask rather than dropping it.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  P0 rỗng (ghi "none"). Blocked rỗng (ghi "none"). P3 có đúng 1 dòng (V1).
  Nếu đếm ra khác, đọc lại — đừng tự ý bỏ dòng nào.
```

- [ ] **Step 4: Delete `ROADMAP.md` and repoint what pointed at it**

```bash
git grep -ln "ROADMAP\.md" -- . ':!docs/handoffs' ':!docs/audits' ':!docs/superpowers'
git rm docs/ROADMAP.md
```

Expected before deletion, measured 2026-08-01:

```
CLAUDE.md                    rewritten in Task 2, should already be clean
CONTEXT.md                   repoint
README.md                    repoint
docs/ACCESS-MODEL.md         repoint
docs/FEATURE-CATALOG.md      repoint
docs/FILE-ORGANIZATION.md    repoint
docs/COMPLETED.md            leave — Task 3c deletes it
docs/COLLABORATION.md        already deleted in Task 3
docs/ROADMAP.md              itself
DEVELOPMENT-TRACKING.md      leave — dated entries
docs/operations/implicit-production-quantity-correction-playbook.md   repoint
```

That last one is a **living runbook**, not a historical record, and it appears
in no living-document list in Tasks 3 or 3c because neither of those searched
for `ROADMAP.md`. It cites `COGS-4` in the roadmap's queue; repoint it to
`docs/OPEN-ITEMS.md` and carry that item across in Step 1 if it is still open.

Leave references inside `docs/handoffs/`, `docs/audits/` and
`docs/superpowers/` dangling, for the same reason as Task 3.

`CLAUDE.md` section 10 as written in Task 2 already points at
`docs/OPEN-ITEMS.md` and never mentions `ROADMAP.md`, so it needs no change —
confirm this rather than assuming it.

- [ ] **Step 5: Verify**

```bash
npx vite-node scripts/check-rules-current.ts && npx vitest run && npx tsc --noEmit
```

Expected: checker clean — note that `docs/OPEN-ITEMS.md` is now one of the files
it reads, so any path you introduced there must exist. Suite green, 0 type
errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Claude-Sonnet refactor: one pending-work list, not two

ROADMAP.md called itself the single source of truth for pending tasks;
OPEN-ITEMS.md called itself the single list of what is not finished. The
second was created 2026-07-30 because the first had stopped being maintained
-- a second list to fix an unmaintained first list, leaving two to maintain.

Kept the one that survived contact with reality. ROADMAP.md's own process,
move the row to COMPLETED.md when done, was never followed, which is why its
queues had become almost entirely closed rows.

It also held a third copy of the agent ownership table, still naming GLM 5.1,
Codex and Antigravity. The other two copies went in the previous commit.

Migrating the open set surfaced stranded work: INV-COUNT-1 (periodic stocktake)
was marked in-progress by Codex, an agent that no longer exists. Phase S1
shipped, migration 0036 was written but never applied, phase S2 never started,
and no list was reporting it as anyone's.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3c: One completed-work log, one scope statement, one signpost

**Files:**
- Delete: `docs/COMPLETED.md`
- Modify: `README.md`
- Modify: any living document referencing `docs/COMPLETED.md`

**Interfaces:**
- Consumes: `CLAUDE.md` section 10 from Task 2, which `README.md` now points at.
- Produces: nothing other tasks consume.

Three overlaps found 2026-08-01 while answering "what files will remain".

**REVISED 2026-08-02, after Step 1 ran. The file is no longer deleted.**

Step 1 did its job and stopped the task. Sampling found entries that exist
**only** in `docs/COMPLETED.md`: the 2026-07-20 post-audit repository
reorganization (all five commit hashes absent from `DEVELOPMENT-TRACKING.md`)
and the 2026-07-11 `U2` UI consistency sweep (its only trace elsewhere is a
"next session candidates" line, which is a plan, not a record).

One reported miss was not one: `REBUILD-1` **is** recorded, at
`DEVELOPMENT-TRACKING.md:976`, under the label `COGS-6` with matching figures
(5,491 entries, 1,352 orders, 703 cost lines, 173,526 VND). It was searched for
by label rather than by substance. Two of six orphaned, not three.

The premise this task rested on — that the file is a pure summary of a fuller
record — is false regardless. So:

**Do not delete `docs/COMPLETED.md`. Close it instead.** Its content is not
copied into `DEVELOPMENT-TRACKING.md`: transcribing several 500-700 word entries
by hand risks losing exactly the detail that makes them worth keeping, for a
cosmetic gain. Declaring the file closed solves the actual problem — two logs
competing to be the live one — because a closed archive competes with nothing.

The governance file count therefore ends at **13, not the 12 stated earlier**.
`docs/COMPLETED.md` is deliberately **not** added to `CLAUDE.md` section 10:
listing it would invite people to use it, and it is inert.

- [ ] **Step 1 (done): the sampling that stopped the deletion**

`docs/COMPLETED.md`'s own first line says it is a "compact 1-line-per-task
archive" whose "detailed entries remain in `DEVELOPMENT-TRACKING.md`". Two
things say it has stopped working: its entries are now 500-700 words each, not
one line, and its newest entry is dated **2026-07-22** while
`DEVELOPMENT-TRACKING.md` has run continuously since. It was fed by
`ROADMAP.md`'s "move the row here when done" step, which nobody performed.

**Do not delete on the strength of that self-description.** Sample at least six
entries spread across its date range — one each from 2026-07-22, 07-20, 07-17,
07-11, 07-04, and the "Earlier (pre-2026-07)" section — and confirm each names
work that also appears in `DEVELOPMENT-TRACKING.md`.

If any entry describes work found nowhere else, **stop and report**. Do not
copy it across on your own judgement: an orphaned record means the premise of
this step is wrong, and the coordinator needs to know that before anything is
deleted.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Mục 22/07 "REBUILD-1 — Full-history inventory quantity + COGS ground-truth
  rebuild" phải tìm thấy tương ứng trong DEVELOPMENT-TRACKING.md cùng ngày,
  chi tiết hơn. Nếu KHÔNG có -> DỪNG, đừng xoá file.
```

- [ ] **Step 2: Close the archive and repoint what pointed at it**

Replace the header of `docs/COMPLETED.md` — the first three lines, up to and
including its current one-line description — with:

```markdown
# Completed Work Archive (CLOSED)

**Closed 2026-08-02. Nothing is added here any more.**
`DEVELOPMENT-TRACKING.md` is the live chronicle and the only place completed
work is recorded from now on.

This file is kept rather than deleted because it is the sole record of some
work — the 2026-07-20 repository reorganization and the 2026-07-11 `U2` UI
sweep appear nowhere else. It was fed by a "move the row here when done" step
in the old roadmap, which nobody performed after 2026-07-22.
```

Then repoint every living document that still points here **as a place to
look**, so nothing routes a reader to a closed archive. The reference set,
re-verified 2026-08-01:

```
README.md
CONTEXT.md                  (line 68)
docs/FEATURE-CATALOG.md
docs/FILE-ORGANIZATION.md
```

An earlier revision of this task listed `docs/OPEN-ITEMS.md` here; it does not
mention `COMPLETED.md` at all, and it omitted `docs/FEATURE-CATALOG.md` and
`docs/FILE-ORGANIZATION.md`, which do.

`DEVELOPMENT-TRACKING.md` also names it, at lines 942, 970, 1541, 1563 and 1674
— all **inside dated entries**, describing what was done on those days. Leave
every one of them. A chronicle entry recording "moved the row to
`docs/COMPLETED.md`" stays true after the file is deleted; rewriting it would
falsify the record. Same rule as Task 3.

Leave `docs/handoffs/`, `docs/audits/` and `docs/superpowers/` dangling.

- [ ] **Step 3: Give scope one home**

`README.md` sections "Tổng quan" and "Phạm vi vận hành hiện tại" (lines 3-19)
restate what `CONTEXT.md` already says in "Mục đích", "Mô hình đang vận hành"
and "Phạm vi hiện tại". These are **not** full duplicates of each other's files —
`CONTEXT.md` additionally carries the six desired business outcomes, the
decision-authority list, and the out-of-scope list; `README.md` additionally
carries the technical stack, local setup, and production-safety rules. Only the
scope prose is doubled.

`CONTEXT.md` keeps it: it is the owner-facing document, written in Vietnamese
for exactly this purpose, and its own closing section already defines when it
must be updated.

In `README.md`, replace those two sections with a short paragraph plus a link:

```markdown
## Tổng quan

FNB App là hệ thống bán hàng và quản lý vận hành cho một quán đồ uống bán mang
đi. Bối cảnh kinh doanh, mô hình đang vận hành và phạm vi hiện tại — kể cả
những gì **chưa** thuộc phạm vi — nằm ở [`CONTEXT.md`](CONTEXT.md), là tài liệu
chính thống cho phần đó.

Tài liệu này chỉ nói cách chạy và vận hành hệ thống.
```

Do not edit `CONTEXT.md`'s scope sections in this task. Its stale
"Xác minh gần nhất: 2026-07-17" line and its two `docs/ROADMAP.md` references are
handled by Task 3b's grep-driven repointing pass — confirm they were caught, and
report if they were not, since `CONTEXT.md` was missing from Task 3's list.

- [ ] **Step 4: Remove the second signpost**

`README.md`'s "Canonical documentation" table lists ten documents, three of
which this phase deletes. Rebuilding it would recreate the exact defect this
whole phase exists to remove: `CLAUDE.md` section 10 is already a "where to
look" table, and two such tables must be kept in agreement by hand.

Replace the whole `## Canonical documentation` section with:

```markdown
## Canonical documentation

`CLAUDE.md` section 10 is the map — it lists every living document and what each
one is for. It is kept honest by `scripts/check-rules-current.ts`, which fails
the commit if it names a path that no longer exists.
```

- [ ] **Step 5: Verify**

```bash
npx vite-node scripts/check-rules-current.ts && npx vitest run && npx tsc --noEmit
```

Expected: checker clean, suite green, 0 type errors. Then confirm no living
document still points at the deleted archive:

```bash
git grep -n "COMPLETED\.md" -- . \
  ':!docs/handoffs' ':!docs/audits' ':!docs/superpowers' ':!DEVELOPMENT-TRACKING.md'
```

Expected: no matches. `DEVELOPMENT-TRACKING.md` is excluded by pathspec —
its mentions live inside dated entries and stay.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Claude-Sonnet refactor: one completed-work log, one scope statement, one signpost

COMPLETED.md declared itself a compact one-line-per-task archive whose detail
lived in DEVELOPMENT-TRACKING.md. Its entries had grown to 500-700 words, and
its newest was dated 2026-07-22 while its sibling ran continuously -- it was
fed by ROADMAP.md's 'move the row here when done' step, which nobody performed.
Sampled entries across its whole date range and confirmed each appears in
DEVELOPMENT-TRACKING.md before deleting; git retains it either way.

README.md and CONTEXT.md are not duplicates -- only their scope prose was
doubled. CONTEXT.md keeps it, being the owner-facing Vietnamese document
written for that purpose; README.md now covers only how to run the system.

README.md's canonical-documentation table is gone rather than rebuilt. Keeping
it would have meant two hand-synchronised 'where to look' maps, which is the
defect this phase exists to remove -- and CLAUDE.md section 10 is the one the
harness actually loads, and the one the drift checker validates.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: The hook and the bulk-data-change skill

**Files:**
- Create: `.claude/skills/fnbapp-bulk-data-change/SKILL.md`
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: `CLAUDE.md` section 3, which names the skill by the exact directory
  name `fnbapp-bulk-data-change`. The name must match or the reference dangles.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the skill**

Create `.claude/skills/fnbapp-bulk-data-change/SKILL.md`:

````markdown
---
name: fnbapp-bulk-data-change
description: Use before any bulk write to production data in fnbapp - backfills, migrations that touch existing rows, historical reprocessing, or any script run with --apply. Covers the trigger and downstream-automation checks that a "behaviour-neutral" change can still set off.
---

# Bulk data change

A change can be provably neutral in the rows it writes and still cause damage
through what those writes set in motion. This happened on 2026-07-31: a
backfill of 124 rows was correct in every value it wrote, and it still created
132 spurious detection events and scheduled an unreviewed rewrite of historical
sales data.

Work through all five before writing anything.

## 1. List the target table's triggers

For every table the change writes to:

```sql
select tgname, pg_get_triggerdef(oid)
  from pg_trigger
 where tgrelid = 'public.<table>'::regclass and not tgisinternal;
```

For each trigger, state in one sentence what it will do with the rows being
touched. **Pay particular attention to `after insert or update`** — an `UPDATE`
that merely fills in a column still fires it.

## 2. Follow what the triggers feed

A trigger that writes to a queue table is only half the story. Find what reads
that queue. In this repository, `backdated_ledger_events` and
`backdated_recipe_events` are swept nightly at 03:00 by
`/api/cron/apply-backdated-corrections`, which can rewrite `cost_at_sale` and
`recipe_snapshot_json` on historical order lines with no human approval.

State what the downstream automation will do with the rows the change creates.

## 3. Prove neutrality per row, not by argument

Replay the real decision the change is supposed to leave untouched, across every
affected record, before and after. Report the count compared and the count that
differed. "Differences: 0" is only meaningful next to the number checked — a
vacuous zero from comparing nothing is the failure mode to guard against, and it
has occurred here.

## 4. Dry run by default

`--apply` is required to write. Before writing, print the exact count and the
first several targets. After writing, re-read and confirm the expected end
state.

## 5. Report the side effects, not just the writes

Say what else changed: rows added to queue tables, events raised, automation now
scheduled. A report that lists only the intended writes is incomplete.
````

- [ ] **Step 2: Add the hook**

Modify `.claude/settings.json` — add a `hooks` key as a sibling of the existing
`permissions` key. Leave `permissions` exactly as it is.

```json
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'if grep -q -- \"--apply\" /dev/stdin; then echo \"[rule] Ghi vao du lieu that. Bat buoc: (1) liet ke trigger cua bang dich va noi ro moi cai lam gi voi cac dong bi dung, (2) noi ro tien trinh tu dong nao doc nhung dong trigger sinh ra, (3) chung minh trung tinh tren tung dong va bao ca so luong da so sanh, (4) chu quan duyet lan ghi. Skill: fnbapp-bulk-data-change\"; fi'"
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'if grep -q \"supabase/migrations/\" /dev/stdin; then echo \"[rule] Sua cau truc du lieu. Bat buoc: liet ke trigger cua bang dich, va kiem tra migration co nham ten trigger voi ten ham khong (loi da xay ra 2026-07-31). Skill: fnbapp-bulk-data-change\"; fi'"
          }
        ]
      }
    ]
  }
```

- [ ] **Step 3: Verify the JSON parses and the hook fires**

Run: `node -e "JSON.parse(require('node:fs').readFileSync('.claude/settings.json','utf8')); console.log('settings.json parses')"`
Expected: `settings.json parses`

Then, in a fresh session, run any Bash command containing `--apply` (a harmless
one such as `echo --apply`) and confirm the reminder text appears.

**If the hook does not fire**, do not fight the hook syntax alone — invoke the
`update-config` skill, which is the maintained reference for this file's schema,
and report what it says. The hook shape above is written from the documented
schema but has not been executed in this repository before.

- [ ] **Step 4: Verify the skill is discoverable**

In a fresh session, confirm `fnbapp-bulk-data-change` appears in the available
skills listing. If it does not, report it — a skill nobody can invoke is worse
than a document, because it looks like coverage.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/fnbapp-bulk-data-change/SKILL.md .claude/settings.json
git commit -m "Claude-Sonnet feat: hook and skill that fire without being remembered

A plan template shares the defect of a rules document -- it only works if
someone opens it. The hook fires on the two actions that have actually caused
damage here (a command carrying --apply, an edit under supabase/migrations/),
and the skill is surfaced by description match when the task is a bulk data
change.

Both carry the check that would have caught the 2026-07-31 defect: list the
target table's triggers, then follow what those triggers feed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire the checker into the commit gate

**Files:**
- Modify: `.husky/pre-commit`

**Interfaces:**
- Consumes: `scripts/check-rules-current.ts` (Task 1), the rewritten `CLAUDE.md`
  (Task 2), and the repointed references (Task 3). Runs last because it fails
  against the pre-Task-3 repository by design.

The checker also reads `docs/BUSINESS-RULES.md`. That file was verified clean
against all three checks on 2026-08-01 — no retired agent names, no dangling
paths, no declared test links — so it will not block this gate. If it does,
something changed it in the meantime; fix the reference, not the checker, and
leave its *content* alone (that is phase 2).

- [ ] **Step 1: Add the check to the hook**

Modify `.husky/pre-commit`, appending after the existing `tsc` block:

```sh
echo "[pre-commit] Running rule drift check..."
npx vite-node scripts/check-rules-current.ts
if [ $? -ne 0 ]; then
  echo "[pre-commit] FAIL: a rule document disagrees with the repository."
  echo "[pre-commit] Sua quy tac cho dung thuc te, dung sua checker cho im lang."
  exit 1
fi

echo "[pre-commit] PASS: rules current."
```

The header comment citing `docs/COLLABORATION.md section E` was already
repointed in Task 3. Confirm it reads `CLAUDE.md section 9` rather than
repointing it a second time.

- [ ] **Step 2: Prove the gate blocks a real drift**

Introduce a deliberate drift, confirm the commit is refused, then undo it:

```bash
printf '\nStale: `lib/this-file-does-not-exist.ts`\n' >> CLAUDE.md
git add CLAUDE.md
git commit -m "temp: should be blocked"
```

Expected: the commit is **refused**, and the output names
`lib/this-file-does-not-exist.ts`.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Phai thay dong: "CLAUDE.md names 'lib/this-file-does-not-exist.ts',
  which does not exist" va commit BI CHAN.
  Neu commit van di qua -> hook chua chay, DUNG va bao lai.
```

Then undo:

```bash
git reset HEAD CLAUDE.md
git checkout -- CLAUDE.md
```

Confirm `CLAUDE.md` is back to its Task 2 state and its line count is unchanged.

- [ ] **Step 3: Run the full gate**

Run: `npx vite-node scripts/check-rules-current.ts && npx vitest run && npx tsc --noEmit`
Expected: checker clean, suite green, 0 type errors.

- [ ] **Step 4: Update tracking**

Append an entry to `DEVELOPMENT-TRACKING.md` covering all seven tasks, and
update `docs/OPEN-ITEMS.md`. Follow `CLAUDE.md` section 9.

Add one new open item, which this phase creates knowingly:

> **Only three documents are checked for dead references.** `CLAUDE.md`,
> `docs/BUSINESS-RULES.md` and `docs/OPEN-ITEMS.md` are covered by
> `scripts/check-rules-current.ts`. The other current-claim documents —
> `README.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `docs/TESTING.md`,
> `docs/FEATURE-CATALOG.md`, `docs/ACCESS-MODEL.md`,
> `docs/FILE-ORGANIZATION.md`, `docs/domain-dictionary.md` — are not, so a
> reference in them can die unnoticed. Widening the checker to cover them needs
> a cleanup pass first: measured 2026-08-01, several already carry dead links,
> and the gate would fail on day one. Chronicles (`DEVELOPMENT-TRACKING.md`)
> stay out permanently by design.

- [ ] **Step 5: Commit**

```bash
git add .husky/pre-commit DEVELOPMENT-TRACKING.md docs/OPEN-ITEMS.md
git commit -m "Claude-Sonnet feat: rule drift check runs on every commit

The only rule in this repository that never went stale was the one that was
not prose -- tsc --noEmit in this hook. The drift checker joins it, so a rule
document that disagrees with the repository blocks the commit instead of
quietly misleading the next session.

Verified by introducing a deliberate stale path and confirming the commit was
refused before undoing it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verification bar

Per the spec, and checked at the end of Task 5:

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — green, 953 tests (939 baseline + 14 new).
- `npx vite-node scripts/check-rules-current.ts` — all three checks pass, and
  demonstrably fails on a stale path (proven in Task 5 Step 2).
- `CLAUDE.md` at 120 lines as drafted, ceiling 130.
- `git diff --stat` for the whole phase touches **no file** under `app/`,
  `lib/`, or `components/`. The one permitted `supabase/` touch is a comment in
  `0051`, and leaving it alone is preferred.
- `docs/COLLABORATION.md`, `AGENTS.md`, `docs/ROADMAP.md` and `docs/COMPLETED.md`
  are gone; no living document or code comment points at any of them.
- `docs/OPEN-ITEMS.md` is the only pending-work list, and every `ROADMAP.md` row
  is accounted for as closed, migrated, or dropped-with-a-reason.
- Exactly one "where to look" map exists, in `CLAUDE.md` section 10.
- Governance documents: **16 before, 12 after**. Root keeps `CLAUDE.md`,
  `README.md`, `ARCHITECTURE.md`, `CONTEXT.md`, `DEVELOPMENT-TRACKING.md`;
  `docs/` keeps `OPEN-ITEMS.md`, `BUSINESS-RULES.md`, `TESTING.md`,
  `FEATURE-CATALOG.md`, `ACCESS-MODEL.md`, `domain-dictionary.md`,
  `FILE-ORGANIZATION.md`.
- No push.

## Out of scope

- Business rules content — calculation and display rules are phase 2, which is
  why Task 1's check 3 only validates rules that *declare* a test link.
- Any repository restructure or file move — phase 3.
- UI/UX rules — phase 4.
- Clearing the spurious `backdated_recipe_events` rows (`docs/OPEN-ITEMS.md`
  item 2b). Separate track, owner already decided not to diff the cron result.
