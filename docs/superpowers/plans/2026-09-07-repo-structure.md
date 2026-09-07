# Repository Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, in order, with a commit at the end of every task. Steps use checkbox (`- [ ]`) syntax for tracking. Before Task 1, do Task 0 (challenge the plan) and report; then run continuously. Stop only at the two owner steps marked **OWNER STEP** and at any rule or business question — do not decide those yourself.

**Goal:** Reorganize `lib/`, `components/`, and the test tree by business domain, add per-directory `CLAUDE.md` files and the `.claude/` pieces Anthropic's guidance calls for, and correct the documents found wrong on 2026-09-07 — with zero behaviour change.

**Architecture:** Files move; code does not change. A one-off helper script (`scripts/refactor-move.cjs`, deleted at the end) performs `git mv` plus a repo-wide rewrite of every import, alias, and doc reference for one module per call. Every task ends with the four fast gates green; every phase ends with `npm run build` green. Existing doc gates (`flow-doc-facts`, `map-drift`, `docs-refs`, `paths-exist`, `orphan-modules`) are the safety net: a forgotten reference turns a gate red.

**Tech Stack:** Next.js 14 App Router, TypeScript 5, Vitest 4, vite-node, git.

**Spec:** `docs/superpowers/specs/2026-09-07-cau-truc-kho-ma-lau-dai.md` — read it first; §0 is the list of owner-approved deletions, §3.2 is the target tree, §6 the cross-impacts.

## Current state (five numbered questions — see spec §2)

1. States: not applicable — files move, no business entity changes state.
2. Buttons: not applicable — no screen gains, loses, or changes a button.
3. Lists: applies to files. Moved: every `lib/*.ts` module and its tests, 47 tests with no module beside them, 32 screen-specific components. Not moved: `app/**` routes, `supabase/migrations/*.sql`, `scripts/**`, `types/db.ts`, `components/ui/`, `components/dev-feedback/`, `lib/__tests__/fixtures.ts`.
4. Inputs: not applicable.
5. Data: no data touched. No migration, no server write, cache tags unchanged.

Seen: all of `lib/`, `components/`, `scripts/`, `.claude/`, `docs/`, root config, importer map per module. Not seen: SQL bodies, edge-function bodies, `POSScreen.tsx` body.

## Global Constraints

- **No behaviour change.** No test's assertions change. If a test needs its body edited to pass, stop: the move is wrong.
- **Gates after every task:** `npx tsc --noEmit` (0 errors) · `npx vitest run` (all green, no test deleted without a stated reason) · `npx vite-node scripts/check-rules-current.ts` (clean) · `npx vite-node scripts/doc-checks/run-blocking.ts` (all PASS). **After every phase:** `npm run build` green.
- **Commit after every task; never push.** Commit subjects in English, prefixed `chore(structure):` unless stated. Deploy and migrations are out of scope.
- **`CLAUDE.md` stays under 200 lines** and must never contain the words `Codex`, `Antigravity`, `GLM`, `Gemini` (gate `no-retired-agents`).
- **Backticked paths in governed docs and `CLAUDE.md` must exist** (gate `paths-exist`). Never backtick a placeholder such as a path with `<...>` in it.
- **Owner-approved deletions are exactly spec §0 D1–D7.** Delete nothing else. Dead code you notice: report, don't delete.
- Code and comments in English; anything the owner reads (docs, `CLAUDE.md` files) in Vietnamese.
- Do not touch `.claude/settings.json`; the auto-mode classifier blocks it. That is **OWNER STEP O1/O2**.
- Measure the build once (Task 6) and record the duration in your report; if it is under 2 minutes, run it after every task in Phase 3 as well.

---

## Task 0: Challenge the plan (Sonnet critique, mandatory)

**Files:** none modified.

- [ ] **Step 1: Re-measure the two facts the plan rests on**

Run:
```bash
ls lib/*.ts | grep -v '\.test\.ts$' | wc -l          # expect ~61 modules at lib/ root
for f in lib/*.test.ts lib/*/*.test.ts; do if grep -q "supabase/migrations\|supabase/functions\|public/pos-sw" "$f" && ! grep -q "from ['\"]@/lib\|from ['\"]\./\|from ['\"]\.\./" "$f"; then echo "$f"; fi; done | wc -l   # expect 43
```

- [ ] **Step 2: Read the spec §3.2 mapping and list objections**

For each domain folder, ask: is there a module whose importers (spec §3.2 rule: placement follows *who imports it*, measured with `grep -rl "@/lib/<name>" app lib components scripts`) contradict its assigned folder? List every disagreement with evidence.

- [ ] **Step 3: Report in English to the owner, then continue**

Format: "Challenged the plan. Objections: (list, or 'none — checked N modules, all placements match their importers')." If an objection changes a placement, apply the corrected placement in the corresponding Phase 3 task and say so in that task's commit message. Do not wait for a reply unless an objection is a rule or business question.

---

## Phase 0 — Land this morning's work correctly

### Task 1: Un-ignore `.claude/rules/`, `.claude/hooks/`, `.claude/agents/`

**Files:**
- Modify: `.gitignore:79-82`

- [ ] **Step 1: Verify the gap**

Run: `git check-ignore -v .claude/hooks/block-destructive-sql.sh .claude/rules/ui-devices.md`
Expected: both lines print `.gitignore:79:.claude/*`.

- [ ] **Step 2: Add three negations after line 82 (`!.claude/commands/`)**

```gitignore
!.claude/rules/
!.claude/hooks/
!.claude/agents/
```

- [ ] **Step 3: Verify**

Run: `git check-ignore -v .claude/hooks/block-destructive-sql.sh .claude/rules/ui-devices.md; echo "exit:$?"`
Expected: no output, `exit:1` (not ignored). `git status --short .claude` now lists `hooks/` and `rules/` as untracked.

- [ ] **Step 4: Commit**

```bash
git add .gitignore .claude/hooks .claude/rules
git commit -m "chore(structure): track .claude/rules, hooks, agents -- the SQL guard hook and UI rule existed only on one machine"
```

### Task 2: Restore the four rules dropped from `CLAUDE.md` and add the three global-conflict rows

**Files:**
- Modify: `CLAUDE.md` (sections "Lệnh", "Khi luật máy toàn cục gọi thứ không có", "Quy trình", "Viết code")

- [ ] **Step 1: Under the "Lệnh" table, after the line `Việc đụng giá vốn hoặc tồn kho: ...`, add**

```markdown
Không xoá test mà không nêu lý do.
```

- [ ] **Step 2: In the table under "Khi luật máy toàn cục gọi thứ không có", append three rows**

```markdown
| "Always try to use Lodash" | hàm mảng và đối tượng có sẵn của JavaScript | kho không cài Lodash; thêm thư viện là ngoài yêu cầu |
| tên "CamelCase" | camelCase cho biến và hàm, PascalCase cho component và kiểu — theo code hiện có | luật toàn máy viết mơ hồ |
| dòng "will review your output" ở cuối file | `/code-review`, hoặc subagent review trong ngữ cảnh sạch | agent được nhắc đã bỏ 2026-07-31 |
```

(Do not write the retired agent's name anywhere in `CLAUDE.md`.)

- [ ] **Step 3: In "Quy trình", after the five numbered questions and before `- Ghi rõ chỗ chưa xem`, add two bullets**

```markdown
- Năm câu là sàn, không phải trần: tự nghĩ thêm bộ câu hỏi riêng cho đúng việc đó; chủ quán không nhớ giùm.
- Trước khi viết kế hoạch, xác nhận ý chủ quán tới ~95% bằng một ví dụ cụ thể, không diễn đạt lại trừu tượng.
```

- [ ] **Step 4: In "Viết code", after the bullet about hai bố cục riêng, add**

```markdown
- Không đo tỉ lệ thiết bị người dùng mở; chủ quán đã bác (2026-08-26). Điều kiện xem lại do chủ quán tự nêu.
```

- [ ] **Step 5: Verify line count and gates**

Run: `wc -l CLAUDE.md` → expected ≤ 184. Run the four gates.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): restore four rules dropped in the 2026-09-07 trim; map three global-file conflicts"
```

### Task 3: Correct the three documents that contradict the live database

**Files:**
- Modify: `docs/02-rules/business-rules/sales.md` (BR-SALE-006 status line)
- Modify: `docs/02-rules/business-rules/catalog.md` (BR-CATALOG-001 table list, BR-CATALOG-002 "Sequenced in two steps" paragraph)
- Modify: `docs/02-rules/business-rules/unresolved.md` (BR-U-002, BR-U-003 rows)
- Modify: `docs/02-rules/business-rules/data-integrity.md` (append one section)
- Modify: `docs/superpowers/specs/2026-09-02-project-reset-design.md` (two lines after the title)

Evidence (measured 2026-09-07 with a read-only probe against production): `base_ingredients` → PGRST205 not found; `purchased_items.base_ingredient_id` → 42703 does not exist; `stock_ledger` → not found; `outlets` → 2 rows; `orders_v2.outlet_id` → populated (`OUT-001`). `npx supabase migration list` shows remote applied only through `0064`.

- [ ] **Step 1: `sales.md` — replace the BR-SALE-006 `**Status:**` line with**

```markdown
**Status:** `APPROVED` — owner decision 2026-08-25 (Plan, outlets and order code). **Applied** — measured 2026-09-07 against the live database: `outlets` holds 2 rows and `orders_v2.outlet_id` is populated, so migrations `0071`/`0072` have run. `npx supabase migration list` still lists them as unapplied because its tracking stops at `0064` (see `data-integrity.md`, "Migration state is measured on the database").
```

- [ ] **Step 2: `catalog.md` — in BR-CATALOG-001 change `Seven catalogue tables (\`purchased_items\`, \`base_ingredients\`, ...)` to `Six catalogue tables (\`purchased_items\`, ...)` removing `base_ingredients` from the list; in BR-CATALOG-002 replace the paragraph starting `**Sequenced in two steps, only the first written as of 2026-09-01.**` with**

```markdown
**Both steps applied** — measured 2026-09-07 against the live database: the `base_ingredients` table (dropped by migration `0090`) and the `purchased_items.base_ingredient_id` column (dropped by `0095`) both answer "does not exist". Nothing in the schema or in any code path refers to the lower tier any more.
```

- [ ] **Step 3: `unresolved.md` — replace the last cell of the BR-U-002 row with**

`Two outlets and two brands run on one shared stock (see SYSTEM-OVERVIEW); a per-outlet stock model is the open decision, and MULTI-BRANCH-IMPACT lists what it touches`

and the last cell of BR-U-003 with

`Use intended/observed/verified labels; the enforcement audit is still pending (only STAFF is restricted, in middleware.ts, owner decision 2026-07-22)`

- [ ] **Step 4: `data-integrity.md` — append at the end**

```markdown
## Migration state is measured on the database, not read from the CLI

Observed 2026-09-07. `npx supabase migration list` records only migrations applied through the CLI. On this project its remote column stops at `0064` while `0065`–`0096` are live — verified by probing `outlets` (exists, 2 rows), `base_ingredients` (gone), `stock_ledger` (gone). To know whether a migration has run, query the table or column it creates or drops; never read the CLI list or a document. The 2026-09-02 reset spec recorded three batches as "not run" that had run — the same trap.
```

- [ ] **Step 5: `2026-09-02-project-reset-design.md` — insert after the first heading**

```markdown
**Hồ sơ quyết định.** Số đo trong §1.1 là ảnh chụp 02/09; hiện trạng đo lại trước khi dùng. `docs/generated/edge-cases.md` (§3.2) bỏ khỏi thiết kế 2026-09-07 (chủ quán duyệt, đặc tả `2026-09-07-cau-truc-kho-ma-lau-dai.md` D5) — máy trích được tên phép kiểm nhưng không dịch được sang tiếng Việt.
```

- [ ] **Step 6: Run the four gates** (the rules gate warns about numbers-with-units without a date — every new sentence above carries `2026-09-07`).

- [ ] **Step 7: Commit**

```bash
git add docs
git commit -m "docs(rules): record that 0071/0072/0090/0095/0096 are live (measured 2026-09-07); migration list is not a source of truth"
```

### Task 4: Owner-approved deletions D1, D2, D4 and the stale coverage list

**Files:**
- Delete: `docs/generated/architecture.md`, `scripts/system-map/generate-diagram.ts`, `scripts/system-map/build-diagram.ts`, `scripts/system-map/build-diagram.test.ts`
- Delete: `docs/superpowers/specs/2026-09-07-toi-uu-theo-huong-dan-anthropic.md`
- Delete: `scripts/migrate-to-sheets.js`
- Modify: `package.json` (`gen:docs`, remove `migrate`), `README.md` (gen:docs sentence), `vitest.config.ts` (coverage include)

- [ ] **Step 1: Confirm nothing else cites the files**

Run: `grep -rn "architecture.md\|generate-diagram\|build-diagram\|migrate-to-sheets\|toi-uu-theo-huong-dan" --include=*.ts --include=*.js --include=*.json --include=*.md app lib components scripts docs .claude CLAUDE.md README.md package.json`
Expected hits only in: `package.json` (2 scripts), `README.md` (gen:docs line), `scripts/system-map/generate-diagram.ts` itself, `docs/superpowers/specs/2026-09-07-danh-gia-tung-file-tai-lieu.md` (a proposal — leave it, it records the decision). Any other hit: stop and report.

- [ ] **Step 2: Delete**

```bash
git rm docs/generated/architecture.md scripts/system-map/generate-diagram.ts scripts/system-map/build-diagram.ts scripts/system-map/build-diagram.test.ts scripts/migrate-to-sheets.js
rm docs/superpowers/specs/2026-09-07-toi-uu-theo-huong-dan-anthropic.md   # untracked, so plain rm; the owner approved this deletion (spec D2)
```

- [ ] **Step 3: `package.json` — set `"gen:docs": "vite-node scripts/system-map/generate.ts"` and delete the `"migrate"` line.**

- [ ] **Step 4: `README.md` — change `# regenerate docs/generated/ (system map + architecture diagram)` to `# regenerate docs/generated/system-map.md` and, in the paragraph below, drop "and the Mermaid architecture diagram".**

- [ ] **Step 5: `vitest.config.ts` — replace the `coverage.include` array with the modules that exist:**

```ts
      include: [
        "lib/order-math.ts",
        "lib/order-types.ts",
        "lib/order-snapshot.ts",
        "lib/order-cart.ts",
        "lib/order-edit-cart.ts",
        "lib/sheets-db-v2-edit.ts",
        "lib/report-v2-allocators.ts",
      ],
```

- [ ] **Step 6: Run the four gates. Commit.**

```bash
git add -A package.json README.md vitest.config.ts scripts docs
git commit -m "chore: remove architecture diagram, superseded spec, Sheets-era migrate script (owner-approved 2026-09-07, spec D1/D2/D4)"
```

### Task 5: Commit everything else from 2026-09-07 morning

**Files:** the remaining modified/untracked files from the morning session (`CLAUDE.md` trim, skills relocation, doc-gate additions, plan deletions).

- [ ] **Step 1: Review what is pending**

Run: `git status --short | head -80`. Expected: modified `app/**`, `lib/**`, `scripts/**`, `docs/**`, `.husky/pre-commit`, `.vscode/settings.json`, `.claude/settings.json`, `.claude/commands/fix-ui-feedback.md`; untracked `.claude/skills/ui-ux-pro-max/`, `.claude/skills/web-design-guidelines/`, `docs/superpowers/specs/2026-09-07-danh-gia-tung-file-tai-lieu.md`, `docs/superpowers/specs/2026-09-07-cau-truc-kho-ma-lau-dai.md`, `docs/superpowers/plans/2026-09-07-repo-structure.md`, `scripts/doc-checks/claude-section-refs-core*.ts`; deleted `docs/superpowers/plans/2026-09-0*.md`.

- [ ] **Step 2: Run the four gates, then `npm run build`.** Record the build duration.

- [ ] **Step 3: Commit in two pieces**

```bash
git add .claude/skills
git commit -m "chore(skills): move ui-ux-pro-max and web-design-guidelines into .claude/skills (owner decision 2026-09-07)"
git add -A
git commit -m "docs: 2026-09-07 CLAUDE.md trim, section-name refs gate, plan cleanup, structure spec and plan"
```

**OWNER STEP O1 (can happen any time; does not block Sonnet):** in `.claude/settings.json` delete the second `"ask": [` block (the one holding `git push`, `rm *`, `npx vercel *`, `vercel *`, `supabase db push *`) and append those five entries to the end of the first `ask` array. Then `git commit -m "chore(claude): merge duplicate ask blocks" .claude/settings.json`.

---

## Phase 1 — Tooling for safe moves

### Task 6: The move helper `scripts/refactor-move.cjs`

**Files:**
- Create: `scripts/refactor-move.cjs`

**Interfaces:**
- Produces: `node scripts/refactor-move.cjs <old-module-path> <new-module-path>` (no extension). Moves `<old>.ts|.tsx` and every sibling test `<old>.test.ts(x)` / `<old>.<x>.test.ts(x)` with `git mv`, then rewrites every `@/<old>` alias, `<old>.ts` doc reference, and relative import that resolves to `<old>` across `app lib components scripts supabase tests docs .claude types` and the root files.

- [ ] **Step 1: Create the file**

```js
// scripts/refactor-move.cjs -- one-off helper for the 2026-09 restructure
// (docs/superpowers/plans/2026-09-07-repo-structure.md). Deleted in that plan's last task.
//
// Usage: node scripts/refactor-move.cjs <old-module-path> <new-module-path>   (no extension)
//   e.g. node scripts/refactor-move.cjs lib/order-math lib/sales/order-math
//
// 1. git-mv the module and its sibling tests (<old>.test.ts, <old>.<x>.test.ts, .tsx variants)
// 2. rewrite every reference to the old path across the repo:
//    - alias form         @/lib/order-math
//    - repo-path form     lib/order-math.ts   (docs, comments, config strings)
//    - relative form      ./order-math, ../lib/order-math  (resolved against the importing file)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const [oldMod, newMod] = process.argv.slice(2);
if (!oldMod || !newMod) {
  console.error("usage: node scripts/refactor-move.cjs <old-module-path> <new-module-path>");
  process.exit(1);
}
const oldDir = path.posix.dirname(oldMod);
const oldBase = path.posix.basename(oldMod);
const newDir = path.posix.dirname(newMod);
const newBase = path.posix.basename(newMod);

// 1. move the module and its sibling tests
fs.mkdirSync(newDir, { recursive: true });
const siblings = fs
  .readdirSync(oldDir)
  .filter(
    (n) =>
      n === `${oldBase}.ts` ||
      n === `${oldBase}.tsx` ||
      (n.startsWith(`${oldBase}.`) && /\.test\.tsx?$/.test(n)),
  );
if (siblings.length === 0) {
  console.error(`nothing to move: no ${oldBase}.ts(x) in ${oldDir}`);
  process.exit(1);
}
for (const n of siblings) {
  const target = n.replace(oldBase, newBase);
  execSync(`git mv "${path.posix.join(oldDir, n)}" "${path.posix.join(newDir, target)}"`, { stdio: "inherit" });
}

// 2. rewrite references
const ROOTS = ["app", "lib", "components", "scripts", "supabase", "tests", "docs", ".claude", "types"];
const ROOT_FILES = ["CLAUDE.md", "README.md", "vitest.config.ts", "package.json", "middleware.ts"];
function walk(dir, out) {
  for (const e of fs.readdirSync(dir)) {
    // docs/superpowers holds this plan and the spec; their old paths are history, not references
    if (e === "node_modules" || e === ".next" || e === "superpowers") continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|md|json|cjs|js|sh)$/.test(p)) out.push(p);
  }
  return out;
}
const files = [
  ...ROOTS.filter((r) => fs.existsSync(r)).flatMap((r) => walk(r, [])),
  ...ROOT_FILES.filter((f) => fs.existsSync(f)),
].map((p) => p.split(path.sep).join("/"));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const aliasRe = new RegExp(`@/${esc(oldMod)}(?=["'./:\\s)]|$)`, "g");
const docRe = new RegExp(`(?<![\\w/@])${esc(oldMod)}\\.(ts|tsx)\\b`, "g");
const relRe = /(from\s+|vi\.mock\(\s*|import\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g;

let rewritten = 0;
for (const f of files) {
  const before = fs.readFileSync(f, "utf8");
  const dir = path.posix.dirname(f);
  let s = before.replace(aliasRe, `@/${newMod}`).replace(docRe, `${newMod}.$1`);
  s = s.replace(relRe, (m, kw, q, spec) => {
    const resolved = path.posix.normalize(path.posix.join(dir, spec)).replace(/\.(ts|tsx)$/, "");
    if (resolved === oldMod) return `${kw}${q}@/${newMod}${q}`;
    // a sibling that moved in the same call still imports "./<oldBase>"; keep it relative
    if (dir === newDir && resolved === path.posix.join(newDir, oldBase)) return `${kw}${q}./${newBase}${q}`;
    return m;
  });
  if (s !== before) {
    fs.writeFileSync(f, s);
    rewritten++;
  }
}
console.log(`${oldMod} -> ${newMod}: moved ${siblings.length} file(s), rewrote ${rewritten} file(s)`);
```

- [ ] **Step 2: Prove the helper on one real module (this move is kept; Task 10 does not repeat it)**

Run: `node scripts/refactor-move.cjs lib/format lib/shared/format && git diff --stat && npx tsc --noEmit`
Expected: `lib/format.ts` moved (no test sibling exists), ~30 files rewritten, tsc 0 errors. Open `git diff` and read three rewritten files by eye: one `app/**` (alias), one `components/**` (alias), and one `docs/**` mention (`lib/format.ts` → `lib/shared/format.ts`). No file outside those categories may have changed.

- [ ] **Step 3: Four gates, then commit the helper together with its proof**

```bash
git add -A scripts/refactor-move.cjs lib app components docs
git commit -m "chore(structure): add one-off move helper (git mv + reference rewrite); proven on lib/format -> lib/shared/format"
```

### Task 7: The `lib/` root gate, as a todo, plus test-tree config

**Files:**
- Create: `scripts/doc-checks/lib-root-empty.test.ts`
- Modify: `vitest.config.ts` (`test.include`)
- Modify: `scripts/check-rules-current-core.ts:21-24` (`PATH_PREFIXES`)

- [ ] **Step 1: Create the gate as `it.todo` (flipped to a real test in Task 20)**

```ts
// The machine check for spec 2026-09-07 §3.3: lib/ root holds no source files;
// every module lives in a domain folder. it.todo until Phase 3 finishes moving
// them (OPEN-ITEMS.md is generated from it.todo, so this is the open item).
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

export function strayLibRootFiles(): string[] {
  return readdirSync("lib", { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

describe("lib/ root", () => {
  it.todo("holds no source files -- every module lives in a domain folder", () => {
    expect(strayLibRootFiles()).toEqual([]);
  });
});
```

- [ ] **Step 2: `vitest.config.ts` — add `"tests/**/*.test.ts"` to `test.include`.**

- [ ] **Step 3: `scripts/check-rules-current-core.ts` — add `"tests/"` to `PATH_PREFIXES`.**

- [ ] **Step 4: Regenerate open items and run the gates**

Run: `npx vite-node scripts/doc-checks/open-items.ts` → `docs/04-operations/OPEN-ITEMS.md` now lists the lib-root item. Run the four gates.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-checks/lib-root-empty.test.ts vitest.config.ts scripts/check-rules-current-core.ts docs/04-operations/OPEN-ITEMS.md
git commit -m "chore(structure): lib-root-empty gate as open item; tests/ joins vitest and path prefixes"
```

---

## Phase 2 — Tests with no module beside them move to `tests/`

### Task 8: Move 43 migration-text tests, 3 edge-function tests, 1 service-worker test

**Files:**
- Move: every `lib/**/*.test.ts` that reads `supabase/migrations`, `supabase/functions`, or `public/pos-sw` **and imports no `@/lib` or relative lib module** → `tests/migrations/`, `tests/edge-functions/`, or `tests/public/`.
- Keep in `lib/`: `lib/backup-restore.test.ts` (tests `lib/backup-restore.ts`).

- [ ] **Step 1: List the candidates and check the count**

```bash
for f in lib/*.test.ts lib/*/*.test.ts; do
  if grep -q "supabase/migrations\|supabase/functions\|public/pos-sw" "$f" && ! grep -q "from ['\"]@/lib\|from ['\"]\./\|from ['\"]\.\./" "$f"; then echo "$f"; fi
done > /tmp/move-tests.txt; wc -l /tmp/move-tests.txt
```
Expected: 44 (43 migration/function text tests + `lib/pos-sw.test.ts`). Then add the three edge-function tests that import from `supabase/functions` (they matched the relative-import exclusion): `lib/drive-backup.test.ts`, `lib/drive-backup-handler.test.ts`, `lib/user-admin-security-contract.test.ts`. Total 47.

- [ ] **Step 2: Move with `git mv` into three folders**

```bash
mkdir -p tests/migrations tests/edge-functions tests/public
for f in $(cat /tmp/move-tests.txt); do
  case "$f" in
    lib/pos-sw.test.ts) git mv "$f" tests/public/ ;;
    lib/backdated-ledger/*|lib/backdated-recipe-events/*|lib/history-ops/*) git mv "$f" "tests/migrations/$(basename $(dirname $f))-$(basename $f)" ;;
    *) git mv "$f" tests/migrations/ ;;
  esac
done
git mv lib/drive-backup.test.ts lib/drive-backup-handler.test.ts lib/user-admin-security-contract.test.ts tests/edge-functions/
rmdir lib/backdated-ledger lib/backdated-recipe-events lib/history-ops
```

- [ ] **Step 3: Fix the relative imports in the three edge-function tests**

`lib/drive-backup-handler.test.ts` imported `../supabase/functions/backup-to-drive/core` — from `tests/edge-functions/` that becomes `../../supabase/functions/backup-to-drive/core`. Do the same for `drive-backup.test.ts`. `user-admin-security-contract.test.ts` uses the `@/` alias and `process.cwd()`-relative `readFileSync` paths, which do not change. Migration tests use `resolve(process.cwd(), "supabase/migrations", ...)` — unchanged.

- [ ] **Step 4: Run the gates. Test count must still be 1291 and 190 files** (`npx vitest run 2>&1 | tail -6`). `lib/` must contain no subfolder except `__tests__`.

- [ ] **Step 5: Commit**

```bash
git add -A lib tests
git commit -m "chore(structure): move 47 tests with no module beside them to tests/ (migrations, edge-functions, public)"
```

---

## Phase 3 — `lib/` by domain, one commit per domain

Each task below runs the helper once per module, then the four gates, then commits. Do not batch domains into one commit. If tsc reports an unresolved import the helper missed, fix that import by hand and mention the file in the commit body.

### Task 9: `lib/db/` (includes D6: `sheets_db` → `tables`)

**Files:**
- Move: `lib/sheets_db.ts` → `lib/db/tables.ts` (+ `sheets_db.test.ts` → `tables.test.ts`), `lib/supabase.ts`, `lib/shared-actions.ts`, `lib/backup-restore.ts` (+ test)
- Modify by hand: `scripts/system-map/generate.ts:29-33`, `docs/01-system/SYSTEM-OVERVIEW.md` ("Hai cái bẫy" section), `lib/db/tables.ts:1-16` (header comment)

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/sheets_db lib/db/tables
node scripts/refactor-move.cjs lib/supabase lib/db/supabase
node scripts/refactor-move.cjs lib/shared-actions lib/db/shared-actions
node scripts/refactor-move.cjs lib/backup-restore lib/db/backup-restore
```

- [ ] **Step 2: `scripts/system-map/generate.ts` — the exclusion list matches by file name; update it**

```ts
    if (
      p.includes(join("lib", "db", "tables")) ||
      p.includes(join("lib", "db", "shared-actions")) ||
      p.endsWith(join("lib", "db", "backup-restore.ts"))
    ) return;
```
and update the comment above it: replace `sheets_db (the adapter)` with `lib/db/tables.ts (the adapter)`.

- [ ] **Step 3: `lib/db/tables.ts` header comment — replace lines 1–16 with**

```ts
/**
 * Database adapter over Supabase Postgres, keyed by table name.
 *
 * Callers pass a PascalCase table name (e.g. "Orders_V2"); Postgres stores it
 * lowercase, so names are lowercased before querying. Reads go through
 * unstable_cache with the tag `sheets-<TableName>` -- the prefix is historical
 * (the first backend was Google Sheets) and is kept because every revalidateTag
 * call in the app uses it; renaming the tag would be a behaviour change.
 *
 * CLI_MODE: scripts bypass the cache.
 */
```

- [ ] **Step 4: `docs/01-system/SYSTEM-OVERVIEW.md` — rewrite the section "## Hai cái bẫy khi đọc mã nguồn"**

Replace the heading and the two trap paragraphs with:

```markdown
## Một cái bẫy khi đọc mã nguồn, và một dấu vết

**Bẫy — một bảng, hai lối viết hoa.** Trong bản đồ hệ thống, cùng một bảng dữ
liệu có thể hiện ra dưới hai kiểu viết hoa khác nhau, ví dụ `Products` và
`products`, hay `Stock_Adjustments` và `stock_adjustments`. Đó **vẫn là một
bảng** — một lối viết đến từ lời gọi qua `lib/db/tables.ts`, lối kia đến từ thân
một hàm RPC. Đừng đếm chúng thành hai bảng.

**Dấu vết — khoá cache mang chữ "sheets".** Lớp đọc ghi `lib/db/tables.ts` đặt
khoá cache dạng `sheets-<Tên bảng>`. Chữ "sheets" là dấu vết thời đầu dùng Google
Sheets; ruột đã là Supabase từ lâu. Khoá giữ nguyên vì mọi lệnh làm mới cache
đang dùng nó — đổi tên khoá là đổi hành vi, không phải dọn dẹp.
```

- [ ] **Step 5: Gates, then commit**

```bash
git add -A
git commit -m "chore(structure): lib/db -- tables (was sheets_db), supabase, shared-actions, backup-restore (spec D6)"
```

### Task 10: `lib/shared/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/action-error lib/shared/action-error
node scripts/refactor-move.cjs lib/datetime lib/shared/datetime
node scripts/refactor-move.cjs lib/dialog lib/shared/dialog
node scripts/refactor-move.cjs lib/display-rounding lib/shared/display-rounding
node scripts/refactor-move.cjs lib/duplicate-name-guard lib/shared/duplicate-name-guard
node scripts/refactor-move.cjs lib/use-filter-form lib/shared/use-filter-form
node scripts/refactor-move.cjs lib/nav-completeness lib/shared/nav-completeness
node scripts/refactor-move.cjs lib/client-error-report lib/shared/client-error-report
node scripts/refactor-move.cjs lib/report-time lib/shared/report-time
```

- [ ] **Step 2: Gates, commit** — `git commit -am "chore(structure): lib/shared -- cross-cutting helpers"` (use `git add -A` first).

### Task 11: `lib/auth/` and `lib/dev-feedback/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/auth lib/auth/auth
node scripts/refactor-move.cjs lib/ui-feedback-store lib/dev-feedback/ui-feedback-store
node scripts/refactor-move.cjs lib/ui-feedback-fingerprint lib/dev-feedback/ui-feedback-fingerprint
```

- [ ] **Step 2: Gates, commit** — `chore(structure): lib/auth, lib/dev-feedback`.

### Task 12: `lib/sales/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/order-types lib/sales/order-types
node scripts/refactor-move.cjs lib/order-math lib/sales/order-math
node scripts/refactor-move.cjs lib/order-snapshot lib/sales/order-snapshot
node scripts/refactor-move.cjs lib/order-cart lib/sales/order-cart
node scripts/refactor-move.cjs lib/order-edit-cart lib/sales/order-edit-cart
node scripts/refactor-move.cjs lib/order-edit-transaction lib/sales/order-edit-transaction
node scripts/refactor-move.cjs lib/void-order-transaction lib/sales/void-order-transaction
node scripts/refactor-move.cjs lib/pos-captured-at lib/sales/pos-captured-at
node scripts/refactor-move.cjs lib/pos-order-transaction lib/sales/pos-order-transaction
node scripts/refactor-move.cjs lib/sheets-db-v2-edit lib/sales/sheets-db-v2-edit
```
(`order-math.property.test.ts` and `sheets-db-v2-edit.failure.test.ts` travel as siblings.)

- [ ] **Step 2: `lib/__tests__/fixtures.ts` — the helper rewrote its `../order-types` import to `@/lib/sales/order-types`; confirm with `grep -n "from" lib/__tests__/fixtures.ts`.**

- [ ] **Step 3: Gates, commit** — `chore(structure): lib/sales -- orders, void, POS order write`.

### Task 13: `lib/pos/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/pos-offline-queue lib/pos/pos-offline-queue
node scripts/refactor-move.cjs lib/pos-checkout-idempotency lib/pos/pos-checkout-idempotency
node scripts/refactor-move.cjs lib/pos-category-icons lib/pos/pos-category-icons
```

- [ ] **Step 2: Gates, commit** — `chore(structure): lib/pos -- device-side POS`.

### Task 14: `lib/purchasing/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/purchase-order-transaction lib/purchasing/purchase-order-transaction
node scripts/refactor-move.cjs lib/purchase-order-edit-gate lib/purchasing/purchase-order-edit-gate
node scripts/refactor-move.cjs lib/purchase-order-write-plan lib/purchasing/purchase-order-write-plan
node scripts/refactor-move.cjs lib/purchase-line-base-quantity lib/purchasing/purchase-line-base-quantity
node scripts/refactor-move.cjs lib/item-purchase-history lib/purchasing/item-purchase-history
git mv lib/purchase-order-action-integration.test.ts lib/purchasing/
```

- [ ] **Step 2: Fix any relative import in `purchase-order-action-integration.test.ts` by hand (it is a test with no module of its own, so the helper did not move it).**

- [ ] **Step 3: Gates, commit** — `chore(structure): lib/purchasing`.

### Task 15: `lib/costing/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/issue-costing lib/costing/issue-costing
node scripts/refactor-move.cjs lib/issue-costing-inputs lib/costing/issue-costing-inputs
node scripts/refactor-move.cjs lib/purchase-order-cost-allocation lib/costing/purchase-order-cost-allocation
node scripts/refactor-move.cjs lib/purchase-ledger-rebuild lib/costing/purchase-ledger-rebuild
```

- [ ] **Step 2: Gates, commit** — `chore(structure): lib/costing -- the COGS engine`.

### Task 16: `lib/stock/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/manual-issue-transaction lib/stock/manual-issue-transaction
node scripts/refactor-move.cjs lib/stock-adjustment-transaction lib/stock/stock-adjustment-transaction
node scripts/refactor-move.cjs lib/stocktake-transaction lib/stock/stocktake-transaction
node scripts/refactor-move.cjs lib/stocktake-package-lines lib/stock/stocktake-package-lines
node scripts/refactor-move.cjs lib/issue-slip-onhand-display lib/stock/issue-slip-onhand-display
node scripts/refactor-move.cjs lib/issue-slip-warnings lib/stock/issue-slip-warnings
node scripts/refactor-move.cjs lib/purchased-item-onhand lib/stock/purchased-item-onhand
node scripts/refactor-move.cjs lib/conversion-countability lib/stock/conversion-countability
```

- [ ] **Step 2: Check the two workflow docs that declare these files**

`docs/03-workflows/stock-issue.md` and `stocktake.md` `files:` lines must now read `lib/stock/...`. The `flow-doc-facts` gate proves it.

- [ ] **Step 3: Gates, commit** — `chore(structure): lib/stock -- issue, adjustment, stocktake`.

### Task 17: `lib/assets/`, `lib/products/`, `lib/catalog/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/asset-depreciation lib/assets/asset-depreciation
node scripts/refactor-move.cjs lib/asset-purchase-allocation lib/assets/asset-purchase-allocation
node scripts/refactor-move.cjs lib/product-save-transaction lib/products/product-save-transaction
node scripts/refactor-move.cjs lib/product-erase-transaction lib/products/product-erase-transaction
node scripts/refactor-move.cjs lib/recipe-selection lib/products/recipe-selection
node scripts/refactor-move.cjs lib/price-history lib/products/price-history
node scripts/refactor-move.cjs lib/outlet-code lib/catalog/outlet-code
node scripts/refactor-move.cjs lib/outlet-hours lib/catalog/outlet-hours
node scripts/refactor-move.cjs lib/unit-lock lib/catalog/unit-lock
node scripts/refactor-move.cjs lib/unit-delete-restriction lib/catalog/unit-delete-restriction
```

- [ ] **Step 2: Gates (the `product-catalog.md` flow doc declares two of these), commit** — `chore(structure): lib/assets, lib/products, lib/catalog`.

### Task 18: `lib/reports/`

- [ ] **Step 1: Move**

```bash
node scripts/refactor-move.cjs lib/issued-value-report lib/reports/issued-value-report
node scripts/refactor-move.cjs lib/outlet-breakdown-table lib/reports/outlet-breakdown-table
node scripts/refactor-move.cjs lib/report-v2-allocators lib/reports/report-v2-allocators
node scripts/refactor-move.cjs lib/daily-digest lib/reports/daily-digest
```

- [ ] **Step 2: Gates, commit** — `chore(structure): lib/reports`.

### Task 19: Sweep `lib/` root and update `vitest.config.ts` coverage paths

- [ ] **Step 1: List what is left**

Run: `ls -p lib | grep -v /`
Expected: nothing. If a file remains, it was missed by the spec's table: place it by its importers (`grep -rl "@/lib/<name>" app lib components scripts`), move it with the helper, and name it in the commit body.

- [ ] **Step 2: `vitest.config.ts` `coverage.include` — the helper rewrote each string; confirm every path exists:** `for p in $(grep -o '"lib/[^"]*"' vitest.config.ts | tr -d '"'); do test -f "$p" || echo "MISSING $p"; done` → no output.

- [ ] **Step 3: Gates; commit only if Step 1 or 2 changed something.**

### Task 20: Flip the `lib/` root gate from todo to green; build

**Files:**
- Modify: `scripts/doc-checks/lib-root-empty.test.ts` (`it.todo` → `it`)

- [ ] **Step 1: Change `it.todo(` to `it(` and run `npx vitest run scripts/doc-checks/lib-root-empty.test.ts`** → PASS. (To prove the gate bites, run `touch lib/x.ts && npx vitest run scripts/doc-checks/lib-root-empty.test.ts; rm lib/x.ts` → FAIL listing `x.ts`, then PASS again.)

- [ ] **Step 2: Regenerate open items:** `npx vite-node scripts/doc-checks/open-items.ts` → `docs/04-operations/OPEN-ITEMS.md` back to "Không có việc treo."

- [ ] **Step 3: Four gates, then `npm run build`.** Build must be green.

- [ ] **Step 4: Commit**

```bash
git add scripts/doc-checks/lib-root-empty.test.ts docs/04-operations/OPEN-ITEMS.md
git commit -m "chore(structure): lib/ root is empty -- gate turns green"
```

---

## Phase 4 — `components/`

### Task 21: Screen components move next to their screens; shared ones regroup

**Files:**
- Move: 8 POS components → `app/pos/components/`; `ProductForm`, `ToppingsManager`, `HistoryModal` → `app/admin/products/components/`; `SalesFilter`, `SalesCharts`, `CategoryPieChart`, `ProductTable` → `app/admin/reports/components/`; `InventoryForms`, `inventory/CategoryForm` → `app/admin/inventory/components/`; `SupplierForm` → `app/admin/suppliers/components/`; `CustomDatePicker`, `SearchableSelect` → `components/ui/`; `SessionProvider`, `DialogHost` (+ test) → `components/providers/`
- Delete (D3): `components/ui/Card.tsx`
- Modify: `.claude/rules/ui-devices.md` frontmatter

- [ ] **Step 1: Confirm Card is dead and delete it**

Run: `grep -rn "ui/Card\|/Card\"" app components lib --include=*.tsx --include=*.ts` → no output. Then `git rm components/ui/Card.tsx`.

- [ ] **Step 2: `components/DialogHost.tsx` imports `./ui/Dialog` and `./ui/Button` relatively; change both to `@/components/ui/Dialog` and `@/components/ui/Button` by hand first** (the helper only rewrites references *to* the file being moved, not references *from* it).

- [ ] **Step 3: Move with the helper, in this order — an imported file always moves before the file that imports it relatively** (`CustomDatePicker` before `ProductForm`; `CategoryForm` before `InventoryForms`; `DiscountBadge` → `CartItemRow` → `CartPanel`; `ProductCard` → `ProductGrid`). The helper handles `.tsx` and sibling `*.test.tsx`.

```bash
node scripts/refactor-move.cjs components/CustomDatePicker components/ui/CustomDatePicker
node scripts/refactor-move.cjs components/SearchableSelect components/ui/SearchableSelect
node scripts/refactor-move.cjs components/SessionProvider components/providers/SessionProvider
node scripts/refactor-move.cjs components/DialogHost components/providers/DialogHost
node scripts/refactor-move.cjs components/pos/DiscountBadge app/pos/components/DiscountBadge
node scripts/refactor-move.cjs components/pos/CartItemRow app/pos/components/CartItemRow
node scripts/refactor-move.cjs components/pos/CartPanel app/pos/components/CartPanel
node scripts/refactor-move.cjs components/pos/ProductCard app/pos/components/ProductCard
node scripts/refactor-move.cjs components/pos/ProductGrid app/pos/components/ProductGrid
node scripts/refactor-move.cjs components/pos/ItemConfigModal app/pos/components/ItemConfigModal
node scripts/refactor-move.cjs components/pos/DraftsModal app/pos/components/DraftsModal
node scripts/refactor-move.cjs components/POSScreen app/pos/components/POSScreen
node scripts/refactor-move.cjs components/ProductForm app/admin/products/components/ProductForm
node scripts/refactor-move.cjs components/ToppingsManager app/admin/products/components/ToppingsManager
node scripts/refactor-move.cjs components/HistoryModal app/admin/products/components/HistoryModal
node scripts/refactor-move.cjs components/SalesFilter app/admin/reports/components/SalesFilter
node scripts/refactor-move.cjs components/SalesCharts app/admin/reports/components/SalesCharts
node scripts/refactor-move.cjs components/CategoryPieChart app/admin/reports/components/CategoryPieChart
node scripts/refactor-move.cjs components/ProductTable app/admin/reports/components/ProductTable
node scripts/refactor-move.cjs components/inventory/CategoryForm app/admin/inventory/components/CategoryForm
node scripts/refactor-move.cjs components/InventoryForms app/admin/inventory/components/InventoryForms
node scripts/refactor-move.cjs components/SupplierForm app/admin/suppliers/components/SupplierForm
rmdir components/pos components/inventory
```

If `npx tsc --noEmit` still reports an unresolved relative import, fix that one line by hand to the `@/` alias form and name the file in the commit body.

- [ ] **Step 4: `.claude/rules/ui-devices.md` — frontmatter becomes**

```yaml
---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
---
```

- [ ] **Step 5: Confirm no route was created:** `find app -name page.tsx | wc -l` → 35, same as before. `ls components` → `dev-feedback  providers  ui`.

- [ ] **Step 6: Four gates, `npm run build`, commit**

```bash
git add -A
git commit -m "chore(structure): screen components live beside their screens; components/ keeps ui, providers, dev-feedback (spec D3)"
```

---

## Phase 5 — Instructions where the code is

### Task 22: Four per-directory `CLAUDE.md` files

**Files:**
- Create: `lib/costing/CLAUDE.md`, `supabase/CLAUDE.md`, `app/pos/CLAUDE.md`, `scripts/CLAUDE.md`

- [ ] **Step 1: `lib/costing/CLAUDE.md`**

```markdown
# lib/costing — máy tính giá vốn

Luật chi tiết: `docs/02-rules/business-rules/cogs.md` (mã `BR-COGS-*`).

- Giá vốn đo **lúc hàng rời kho** (phiếu xuất, chênh lệch kiểm kê), không đo lúc bán. Đừng thêm bất kỳ đường trừ kho hay tính giá vốn nào vào luồng bán hàng.
- Nguyên liệu tính theo bình quân gia quyền của các lần mua (`purchase-ledger-rebuild.ts`, `purchase-order-cost-allocation.ts`).
- `stock_ledger` và `inventory_ledger` đã bị xoá (migration `0096`). Không đọc, không ghi, không viết test nhắc tới chúng như bảng đang có.
- Làm tròn: đo bằng JavaScript, không nháp bằng Python — hai ngôn ngữ làm tròn 0,5 ngược nhau. Làm tròn hiển thị nằm ở `lib/shared/display-rounding.ts`, không nằm ở đây.
- **Chưa có script `verify-*` cho giá vốn** (đo 2026-09-07). Test trong thư mục này là phép kiểm tự động duy nhất — không nới, không xoá test mà không nêu lý do; sửa gì ở đây thì báo chủ quán mở báo cáo "Giá trị hàng đã xuất" đối chiếu bằng mắt.
```

- [ ] **Step 2: `supabase/CLAUDE.md`**

```markdown
# supabase — migration và edge function

- **Không sửa migration đã chạy.** Thêm file mới, số kế tiếp.
- Trước khi viết migration đụng một bảng: liệt kê trigger của bảng đó và nói rõ mỗi trigger làm gì với các dòng bị đụng; kiểm tên trigger có nhầm với tên hàm không (sự cố 2026-07-31). Skill: `fnbapp-bulk-data-change`.
- Migration đổi **kết quả trả về** của một hàm phải lên **cùng lúc** với code đọc hàm đó. Không bao giờ chạy migration trước (sự cố `0076`, 2026-08-30: bốn tiếng mỗi phiếu xuất ghi thành công nhưng báo lỗi đỏ).
- `npx supabase migration list` **không phải hiện trạng**: bảng theo dõi dừng ở `0064`, còn máy chủ đã chạy tới `0096` (đo 2026-09-07). Muốn biết migration đã chạy chưa thì truy vấn bảng hoặc cột nó tạo/xoá.
- Chạy migration lên máy chủ thật: chủ quán duyệt **từng lần**, tách khỏi duyệt push.
- Test đọc chữ migration nằm ở `tests/migrations/`; test edge function ở `tests/edge-functions/`. Không đặt test trong thư mục này.
- `functions/`: chạy trên Deno, import qua URL, `tsc` của dự án không kiểm; `backup-to-sheets` có `node_modules` riêng, không mở.
```

- [ ] **Step 3: `app/pos/CLAUDE.md`**

```markdown
# app/pos — máy bán hàng

Nhân viên chỉ dùng màn hình này; quán ngừng bán nếu nó hỏng.

- **Phải chạy khi mất mạng:** hàng đợi ngoại tuyến `lib/pos/pos-offline-queue.ts`, service worker `public/pos-sw.js` (test ở `tests/public/`). Sửa gì cũng phải giữ đường ngoại tuyến.
- **Thanh toán idempotent** (`lib/pos/pos-checkout-idempotency.ts`): bấm hai lần không ra hai đơn.
- **Bán không trừ kho, không tính giá vốn** (từ 2026-08-07). Đừng thêm.
- Điểm bán lấy từ đường dẫn; mã đơn đánh theo điểm bán + ngày (`BR-SALE-006`). Số điểm bán là dữ liệu, không phải hằng số.
- Việc có thể làm POS ngừng nhận đơn dù vài phút: **nói với chủ quán trước khi làm**, kèm mức rủi ro.
- Giao diện: luật thiết bị ở `.claude/rules/ui-devices.md`; POS chủ yếu mở trên máy tính bảng và điện thoại, nhưng phải dùng được trên máy tính.
```

- [ ] **Step 4: `scripts/CLAUDE.md`**

```markdown
# scripts — chạy tay và cửa kiểm

- Script ghi dữ liệu thật: **mặc định chạy thử**, `--apply` mới ghi; in số dòng và đối tượng trước khi ghi; chủ quán duyệt từng lần ghi. Skill: `fnbapp-bulk-data-change`.
- Tiền tố tên quyết định quyền: `audit-`, `verify-`, `check-`, `inspect-`, `investigate-`, `diagnose-` là chỉ đọc; các tiền tố khác phải hỏi. Đặt tên đúng bản chất.
- Tên cột lấy từ `information_schema` rồi tra bản đó; câu truy vấn sai tên cột nằm lại trong nhật ký lỗi của chủ quán.
- Báo kết quả kèm mẫu số: "0 lệch trên 3.364 dòng", không nói trống "0 lệch".
- `doc-checks/run-blocking.ts` là lối vào duy nhất của các cửa tài liệu; `check-rules-current.ts` là cửa luật; pre-commit gọi cả hai. Thêm cửa mới thì thêm vào `run-blocking.ts`, không tạo lối vào thứ hai.
- `system-map/generate.ts` sinh `docs/generated/system-map.md`; sửa tay file sinh là vô ích.
```

- [ ] **Step 5: Four gates (each backticked path above must exist), commit**

```bash
git add lib/costing/CLAUDE.md supabase/CLAUDE.md app/pos/CLAUDE.md scripts/CLAUDE.md
git commit -m "docs(claude-md): per-directory instructions for costing, supabase, pos, scripts"
```

### Task 23: Root `CLAUDE.md` structure section, `reviewer` subagent, README, overview

**Files:**
- Modify: `CLAUDE.md` (replace section "Quy ước đường dẫn"; add the agent path to the D7 row)
- Create: `.claude/agents/reviewer.md`
- Modify: `README.md` (add a repository-layout table), `docs/01-system/SYSTEM-OVERVIEW.md` (append one section)

- [ ] **Step 1: `CLAUDE.md` — replace the whole "## Quy ước đường dẫn" section with**

```markdown
## Cấu trúc và đường dẫn

| Thư mục | Chứa |
|---|---|
| `app/` | route Next.js; component riêng của một màn hình nằm trong thư mục `components/` cạnh màn hình đó |
| `lib/` | logic theo vùng, mỗi vùng một thư mục con: `db`, `shared`, `auth`, `sales`, `pos`, `purchasing`, `costing`, `stock`, `assets`, `products`, `catalog`, `reports`, `dev-feedback` |
| `components/` | chỉ thứ dùng chung: `ui/`, `providers/`, `dev-feedback/` |
| `tests/` | test không có module bên cạnh: chữ migration, edge function, service worker |
| `scripts/`, `supabase/`, `app/pos/`, `lib/costing/` | có `CLAUDE.md` riêng, máy nạp khi mở file trong đó |

Module mới đặt vào đúng vùng; không có vùng hợp thì hỏi trước khi tạo vùng mới. Gốc `lib/` không chứa file — có phép kiểm canh.
Đường dẫn viết bắt đầu bằng tên thư mục gốc (`app`, `lib`, `components`, `tests`, `scripts`, `docs`, `supabase`, `types`, `.claude`), không mở đầu bằng dấu gạch chéo. Phép kiểm chỉ nhận dạng lối này, nên đừng lấy đường dẫn không có thật ra làm ví dụ.
```

Then in the D7 row from Task 2 change `subagent review trong ngữ cảnh sạch` to `subagent \`reviewer\` trong \`.claude/agents/\``.

- [ ] **Step 2: `.claude/agents/reviewer.md`**

```markdown
---
name: reviewer
description: Fresh-context review of a diff against its plan or spec. Use after a task is implemented and before it is reported done; never on work the same session wrote without a plan to check against.
tools: Read, Grep, Glob, Bash
model: opus
---
You review work you did not write. You receive the path of the plan or spec and a git range (or "working tree"). Read the plan first, then `git diff <range>`.

Report only gaps that affect correctness or the stated requirements: an item in the plan with no change in the diff; a change outside the plan's scope; a test whose assertion was edited to pass; a document that now disagrees with the code; a moved file whose reference somewhere was not updated. Do not propose style changes or refactors.

Answer in English, at most 30 lines, each finding as `file:line — what is wrong — which plan item it violates`. If nothing is wrong, say "Checked N plan items against the diff; no gaps" with the number.
```

- [ ] **Step 3: `README.md` — after "## Stack", add**

```markdown
## Repository layout

| Directory | Holds |
|---|---|
| `app/` | Next.js routes; a screen's own components sit in a `components/` folder beside it |
| `lib/<domain>/` | domain logic: `db`, `shared`, `auth`, `sales`, `pos`, `purchasing`, `costing`, `stock`, `assets`, `products`, `catalog`, `reports`, `dev-feedback` |
| `components/` | shared only: `ui/`, `providers/`, `dev-feedback/` |
| `tests/` | tests with no module beside them (migration text, edge functions, service worker) |
| `scripts/` | maintenance scripts and the doc gates |
| `supabase/` | migrations and edge functions |
| `docs/` | see the documentation map below |

`lib/costing/`, `app/pos/`, `scripts/`, and `supabase/` carry their own `CLAUDE.md` with the rules specific to that area.
```

(README is not a governed doc for `paths-exist`, so `lib/<domain>/` is acceptable there.)

- [ ] **Step 4: `docs/01-system/SYSTEM-OVERVIEW.md` — append before "## Đọc tiếp ở đâu"**

```markdown
## Kho mã chia theo vùng

Từ 2026-09-07, logic trong `lib/` xếp theo vùng nghiệp vụ trùng với menu quản
trị: `sales` (bán hàng, đơn), `pos` (máy bán hàng), `purchasing` (mua vào),
`costing` (giá vốn), `stock` (xuất kho, điều chỉnh, kiểm kê), `assets` (tài
sản), `products` (món), `catalog` (danh mục), `reports` (báo cáo); `db`,
`shared`, `auth` là nền dùng chung. Component riêng của một màn hình nằm cạnh
màn hình đó trong `app/`. Bốn vùng có luật riêng trong `CLAUDE.md` của chính
thư mục: `lib/costing/`, `app/pos/`, `scripts/`, `supabase/`.
```

- [ ] **Step 5: `wc -l CLAUDE.md` ≤ 199; four gates; commit**

```bash
git add CLAUDE.md .claude/agents/reviewer.md README.md docs/01-system/SYSTEM-OVERVIEW.md
git commit -m "docs: structure map in CLAUDE.md and README; reviewer subagent; overview names the domains"
```

**OWNER STEP O2 (any time after Task 1):** add to `.claude/settings.json` under `permissions`:
```json
    "deny": [
      "Read(./recovery-snapshots/**)",
      "Read(./coverage/**)",
      "Read(./supabase/functions/**/node_modules/**)",
      "Read(./.next/**)"
    ]
```
Optionally, to let agents edit `.claude/` next time, add `"Edit(.claude/**)"` and `"Write(.claude/**)"` to the `allow` list of `.claude/settings.local.json`.

### Task 24: `SessionStart` hook — "where are we" from sources that cannot go stale

Owner decision 2026-09-07: no CSV/SQLite memory store; instead every session starts with the last commits, the working-tree size, and the open items injected into context. Anthropic (`hooks` docs): text a `SessionStart` hook prints to stdout is added to Claude's context before the first prompt.

**Files:**
- Create: `.claude/hooks/session-start.sh`
- **OWNER STEP O3:** register it in `.claude/settings.json` (Sonnet cannot write that file)

- [ ] **Step 1: Create the hook**

```sh
#!/usr/bin/env sh
# SessionStart hook: put "where are we" into context from sources that cannot
# go stale -- git and the machine-generated open-items file. Kept short: every
# line here costs context in every session.
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
echo "[session-start] Branch: $(git branch --show-current 2>/dev/null)"
echo "[session-start] Last 10 commits:"
git log --oneline -10 2>/dev/null
echo "[session-start] Working tree: $(git status --short 2>/dev/null | wc -l | tr -d ' ') changed file(s)"
echo "[session-start] Open items (docs/04-operations/OPEN-ITEMS.md):"
sed -n '3,$p' docs/04-operations/OPEN-ITEMS.md 2>/dev/null
exit 0
```

- [ ] **Step 2: Run it by hand**

Run: `sh .claude/hooks/session-start.sh`
Expected: branch name, ten commit lines, a changed-file count, and either "Không có việc treo." or the open-item lines. Exit code 0 even outside a git repo (`cd … || exit 0`).

- [ ] **Step 3: Commit**

```bash
git add .claude/hooks/session-start.sh
git commit -m "chore(claude): SessionStart hook prints recent commits, tree size, open items (owner decision 2026-09-07: no separate memory store)"
```

**OWNER STEP O3:** in `.claude/settings.json`, inside `"hooks"`, add alongside `"PreToolUse"`:
```json
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "sh .claude/hooks/session-start.sh" }
        ]
      }
    ]
```
Then start a new session and confirm the `[session-start]` lines appear in the first context.

---

## Phase 6 — Final verification and cleanup

### Task 25: Remove the helper, run everything, hand over

**Files:**
- Delete: `scripts/refactor-move.cjs`

- [ ] **Step 1: `git rm scripts/refactor-move.cjs`** (its only reference is this plan and the spec).

- [ ] **Step 2: All five gates**

```bash
npx tsc --noEmit
npx vitest run            # expect 1291 tests / 190 files: 1291 - 1 (build-diagram, Task 4) + 1 (lib-root-empty)
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
npm run build
```

- [ ] **Step 3: Revenue verification with denominator**

Run: `npx vite-node scripts/verify-revenue.ts`
Report the exact line it prints, including how many orders were compared. Expected: 0 mismatches over N.

- [ ] **Step 4: Structure proof**

```bash
ls -p lib | grep -v /            # empty
ls components                     # dev-feedback providers ui
find app -name page.tsx | wc -l   # 35
git log --oneline d4714f9..HEAD | wc -l
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(structure): remove one-off move helper; restructure complete"
```

- [ ] **Step 6: Report to the owner in Vietnamese** — one message, this shape:

1. Số commit, số file dời, kết quả 5 cửa (kèm số test và mẫu số của `verify-revenue`).
2. Việc chủ quán cần mở tận mắt sau `npm run dev`, đăng nhập rồi mở: **/pos** (thấy lưới món và giỏ hàng), **/admin/inventory/issue-slips** (danh sách phiếu xuất), **/admin/inventory/stocktake** (kỳ kiểm kê), **/admin/reports/sales** (báo cáo có bảng theo điểm bán), **/admin/products** (danh sách món, mở form sửa một món). Không màn hình nào được trông khác trước.
3. Ba việc tay của chủ quán còn treo (O1, O2, O3) nếu chưa làm.
4. Việc treo ghi nhận, không làm trong đợt này: tách `app/pos/components/POSScreen.tsx` (1.143 dòng); cài plugin `typescript-lsp`.
5. Không push. Chờ chủ quán duyệt push riêng.

---

## Self-review (done by the plan author, 2026-09-07)

- **Spec coverage:** §0 D1→Task 4, D2→Task 4, D3→Task 21, D4→Task 4, D5→Task 3, D6→Task 9, D7→Task 2, D8→O1/O2. §1.3 items 1–5 → Tasks 1, 2, 3, 3, 4. §3.2 tree → Tasks 8–21. §3.3 gates → Task 7/20. §3.4 → Task 22. §3.5 → Tasks 1, 23, O2. §4 docs → Tasks 3, 9, 16, 17, 21, 23. §5 phases → Phases 0–6. §6 cross-impacts: cache tag (Task 9 comment), `generate.ts` exclusions (Task 9), retired-agent word (Task 2), `git mv` (helper).
- **Placeholders:** none; every step has its content.
- **Name consistency:** helper is `scripts/refactor-move.cjs` everywhere; gate file `scripts/doc-checks/lib-root-empty.test.ts` in Tasks 7, 20, 25; agent `reviewer` in Tasks 2 (row), 23; hook `.claude/hooks/session-start.sh` in Task 24 and O3 (spec §3.5 item 4).
