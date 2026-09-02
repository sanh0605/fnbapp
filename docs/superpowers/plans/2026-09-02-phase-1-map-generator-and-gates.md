# Phase 1 — Map Generator and Hard-Blocking Gates: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the machine that keeps the new documentation honest — a generator that derives a system map from live source, plus the hard-blocking checks that go red when a document drifts from that map — and prove it catches a real drift on one seed workflow doc.

**Architecture:** Mirror the two patterns this repo already runs successfully. (1) `scripts/check-rules-current-core.ts` + thin CLI + fixture tests, for anything wired into the pre-commit hook. (2) `lib/nav-completeness.ts` (pure decision function + filesystem readers) exercised by an ordinary vitest test, for structural properties. Every new module is a pure function taking inputs and returning a typed result, plus a thin reader/CLI layer, plus fixture-based tests. No module reads the network; the generator reads only files on disk (migrations, `app/`, `lib/`).

**Tech Stack:** TypeScript, `vite-node` (run scripts), vitest 4.1.10 (tests), Node `fs`/`path`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-project-reset-design.md` (owner-approved 2026-09-02). Read it alongside this plan; this plan implements its §3.5b, §3.6, §3.7, §3.8, §3.3, and the four Phase-1 items in §6b.

## Global Constraints

- **Code and comments in English; user-facing strings in Vietnamese.** (`CLAUDE.md` §7)
- **No new npm dependencies.** Use Node built-ins and what `package.json` already has.
- **Every rule that blocks must have an automated check.** (spec §2.3) A rule enforced only by prose is not done.
- **The generated map is machine-owned.** It lands in `docs/generated/` and is never hand-edited. (spec §3.2d)
- **New checks that block go in the PRE-COMMIT hook (`.husky/pre-commit`), not inside `npx vitest run`.** (spec §3.7) `vitest run` must still exit 0 on a clean tree so `CLAUDE.md` §9's all-green bar survives.
- **Follow the existing core+CLI+fixture pattern** of `scripts/check-rules-current-core.ts`. Do not invent a new test style.
- **This plan is implemented by Sonnet.** Claude does not edit `scripts/` directly (owner directive). Sonnet critiques this plan before writing code (spec §1 / `CLAUDE.md` §1).

---

## Current-state description (mandatory, `CLAUDE.md` §1b) — five numbered facts

Written before proposing changes, for the owner to reject, not as questions. The "thing" here is the check infrastructure, not a screen.

1. **What states does this have, and how is each set?** The infrastructure has two run contexts: (a) `npx vitest run` — the existing test gate, must stay all-green; (b) `.husky/pre-commit` — the existing blocking gate, currently runs `tsc --noEmit` then `check-rules-current.ts`. New blocking checks attach to context (b); the map-drift check and open-items generator can run in either — decided per task below.
2. **What buttons/entry points exist?** No UI. Entry points are npm/vite-node commands and the pre-commit hook. New commands: `vite-node scripts/system-map/generate.ts` (writes the map), and new checks invoked from the hook. Nothing here is reachable from `app/`.
3. **What does the generated map contain, and what is deliberately excluded?** Included: DB tables with columns and `check(status in (...))` enums (from migrations); which source file writes which table (via `sheets_db` calls and direct `supabase.from(...)` writes); which route calls which server action. Excluded: read-only access, runtime-computed table names (reported as "unresolved", never silently dropped — spec §3.5b), and anything requiring the network.
4. **What inputs are valid, and what happens outside that range?** The generator reads `supabase/migrations/*.sql`, `app/**`, `lib/**`. A write whose table name resolves through one of the three known shapes (literal, same-file const, two-hop `shared-actions`) or a direct `supabase.from("t")` chain is recorded; anything else is emitted to an `UNRESOLVED` section for a human, and the run still succeeds. Malformed migration SQL is skipped with a warning, not a crash.
5. **What does it deliberately NOT serve?** It does not check prose correctness (spec §5.1 — button labels, hand-written validation, "who it deliberately excludes" stay unverifiable), does not read the running database, and does not verify the *content* of a workflow doc beyond its declaration block.

**What I have NOT examined:** the exact SQL dialect variety across all 96 migrations (I sampled `0001_init_schema.sql` and confirmed `check (status in (...))`; Task 2 must handle multi-line `create table` and `alter table ... add column`). Every other claim above was measured against source on 2026-09-02.

**Answers to the four §6b Phase-1 pin-down items:**
1. **Intra-Phase-1 build order** = the task order below (generator foundation → map → drift check → seed → declaration check → line-ceiling → open-items → wire hook → prove).
2. **Relation-block micro-format** = defined in Task 1.
3. **Line-ceiling checker's gate** = pre-commit (Task 8), same gate as the other blocking checks.
4. **Line-ceiling vs BUSINESS-RULES split sequencing** = the line-ceiling check ships with an explicit exemption allowlist (Task 8) that includes `docs/BUSINESS-RULES.md` **until Phase 3 splits it**, with the reason recorded inline; the exemption is removed in the Phase 3 plan when the split lands. No window where the check is on and a kept file silently violates.

---

## File Structure

**Generator** (`scripts/system-map/`):
- `extract-tables.ts` — migrations → `TableInfo[]` (name, columns, status enum values).
- `extract-writes.ts` — `app/`+`lib/` → `WriteSite[]` (file → table, via the 3 sheets_db shapes + direct `supabase.from`), plus `UnresolvedWrite[]`.
- `extract-routes.ts` — `app/**/page.tsx` and `actions.ts` → `RouteActions[]`.
- `build-map.ts` — pure composer: the three inputs → the map document string (deterministic ordering).
- `generate.ts` — thin CLI: read disk, call `build-map`, write `docs/generated/system-map.md`.
- `*.test.ts` for each, fixture-based.

**Relation-block format + parser** (`scripts/doc-map/`):
- `relation-block.ts` — parse the fenced relation block out of a hand doc; serialize relations.
- `relation-block.test.ts`.

**Checks** (`scripts/doc-checks/`):
- `map-drift-core.ts` — generated relations vs hand block → `CheckResult`.
- `flow-doc-core.ts` — declaration block vs reality + staged-diff coupling → `CheckResult`.
- `line-ceiling-core.ts` — file line counts vs ceiling + exemptions → `CheckResult`.
- `open-items.ts` — vitest JSON `status:"todo"` → `OPEN-ITEMS.md`.
- CLI wrappers + `*.test.ts` each.

**Wiring & seed:**
- `.husky/pre-commit` — append the new blocking checks.
- `docs/generated/README.md`, `docs/generated/system-map.md` (generated), `docs/generated/edge-cases.md` (generated).
- `docs/01-system/SYSTEM-MAP.md` — seed hand map with one relation block.
- `docs/03-workflows/stock-issue.md` — seed workflow doc with one declaration block.

---

## Task 1: Relation-block micro-format and parser

Defines the machine-readable block the hand `SYSTEM-MAP.md` carries (spec §3.6, §6b item 2). Format: a fenced code block tagged `relations`, one relation per line as `screen_or_file -> table (write|read)`. Everything outside the fence is free prose for humans.

**Files:**
- Create: `scripts/doc-map/relation-block.ts`
- Test: `scripts/doc-map/relation-block.test.ts`

**Interfaces:**
- Produces: `type Relation = { from: string; to: string; kind: "write" | "read" }`; `parseRelationBlock(markdown: string): Relation[]`; `serializeRelations(rels: Relation[]): string` (returns the fenced block text, relations sorted for determinism).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseRelationBlock, serializeRelations } from "./relation-block";

describe("parseRelationBlock", () => {
  it("reads relations inside a ```relations fence and ignores prose", () => {
    const md = [
      "# System map",
      "Some prose about sales.",
      "```relations",
      "sales -> orders_v2 (write)",
      "sales -> order_payments (write)",
      "reports -> orders_v2 (read)",
      "```",
      "More prose.",
    ].join("\n");
    expect(parseRelationBlock(md)).toEqual([
      { from: "sales", to: "orders_v2", kind: "write" },
      { from: "sales", to: "order_payments", kind: "write" },
      { from: "reports", to: "orders_v2", kind: "read" },
    ]);
  });

  it("round-trips through serialize", () => {
    const rels = [
      { from: "b", to: "t2", kind: "write" as const },
      { from: "a", to: "t1", kind: "write" as const },
    ];
    const text = serializeRelations(rels);
    expect(parseRelationBlock(text)).toEqual([
      { from: "a", to: "t1", kind: "write" },
      { from: "b", to: "t2", kind: "write" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/doc-map/relation-block.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export type Relation = { from: string; to: string; kind: "write" | "read" };

const LINE = /^(\S+)\s*->\s*(\S+)\s*\((write|read)\)\s*$/;

export function parseRelationBlock(markdown: string): Relation[] {
  const rels: Relation[] = [];
  const lines = markdown.split("\n");
  let inside = false;
  for (const line of lines) {
    if (line.trim() === "```relations") { inside = true; continue; }
    if (inside && line.trim() === "```") { inside = false; continue; }
    if (!inside) continue;
    const m = LINE.exec(line.trim());
    if (m) rels.push({ from: m[1], to: m[2], kind: m[3] as "write" | "read" });
  }
  return rels;
}

export function serializeRelations(rels: Relation[]): string {
  const sorted = [...rels].sort((a, b) =>
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
  const body = sorted.map(r => `${r.from} -> ${r.to} (${r.kind})`).join("\n");
  return "```relations\n" + body + "\n```";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/doc-map/relation-block.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-map/relation-block.ts scripts/doc-map/relation-block.test.ts
git commit -m "feat(docmap): relation-block micro-format parser and serializer"
```

---

## Task 2: Extract tables, columns, and status enums from migrations

**Files:**
- Create: `scripts/system-map/extract-tables.ts`
- Test: `scripts/system-map/extract-tables.test.ts`

**Interfaces:**
- Produces: `type TableInfo = { name: string; columns: string[]; statusValues: string[] }`; `extractTables(sqlSources: string[]): TableInfo[]` (pure — takes SQL text, not paths, so tests use fixtures; sorted by table name).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { extractTables } from "./extract-tables";

describe("extractTables", () => {
  it("reads table name, columns, and a status check-enum", () => {
    const sql = `
      create table if not exists public.products (
        id text primary key,
        name text not null,
        status text not null default 'ACTIVE'
          check (status in ('ACTIVE','INACTIVE','DELETED'))
      );`;
    expect(extractTables([sql])).toEqual([
      { name: "products", columns: ["id", "name", "status"], statusValues: ["ACTIVE", "INACTIVE", "DELETED"] },
    ]);
  });

  it("merges columns added by a later alter table", () => {
    const create = `create table public.assets ( id text primary key );`;
    const alter = `alter table public.assets add column note text;`;
    expect(extractTables([create, alter])[0].columns).toEqual(["id", "note"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/system-map/extract-tables.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export type TableInfo = { name: string; columns: string[]; statusValues: string[] };

const CREATE = /create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*;/gi;
const ALTER = /alter table (?:if exists )?(?:public\.)?(\w+)\s+add column\s+(?:if not exists\s+)?(\w+)/gi;
const STATUS_ENUM = /status\s+in\s*\(([^)]*)\)/i;
const COLUMN_HEAD = /^([a-z_][a-z0-9_]*)\s+/i;

// Words that begin a table constraint, not a column definition.
const NON_COLUMN = new Set(["primary", "foreign", "unique", "check", "constraint"]);

export function extractTables(sqlSources: string[]): TableInfo[] {
  const byName = new Map<string, TableInfo>();
  const get = (name: string) =>
    byName.get(name) ?? byName.set(name, { name, columns: [], statusValues: [] }).get(name)!;

  for (const sql of sqlSources) {
    for (const m of sql.matchAll(CREATE)) {
      const table = get(m[1]);
      const enumMatch = STATUS_ENUM.exec(m[2]);
      if (enumMatch) {
        table.statusValues = enumMatch[1].split(",").map(s => s.trim().replace(/^'|'$/g, ""));
      }
      for (const rawLine of m[2].split("\n")) {
        const line = rawLine.trim();
        const head = COLUMN_HEAD.exec(line);
        if (!head || NON_COLUMN.has(head[1].toLowerCase())) continue;
        if (!table.columns.includes(head[1])) table.columns.push(head[1]);
      }
    }
    for (const m of sql.matchAll(ALTER)) {
      const table = get(m[1]);
      if (!table.columns.includes(m[2])) table.columns.push(m[2]);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/system-map/extract-tables.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify against real migrations (no silent zero)**

Run: `npx vite-node -e "import('./scripts/system-map/extract-tables.ts').then(async m => { const fs=require('fs'); const dir='supabase/migrations'; const sql=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).map(f=>fs.readFileSync(dir+'/'+f,'utf8')); const t=m.extractTables(sql); console.log('tables:', t.length); console.log('products status:', t.find(x=>x.name==='products')?.statusValues); })"`
Expected: `tables:` a count in the low dozens (spec §10 lists tables like `orders_v2`, `stock_issues`, `assets`), and `products status:` shows `[ 'ACTIVE', 'INACTIVE', 'DELETED' ]`. If tables is 0, the CREATE regex does not match this repo's SQL — stop and fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add scripts/system-map/extract-tables.ts scripts/system-map/extract-tables.test.ts
git commit -m "feat(systemmap): extract tables, columns, status enums from migrations"
```

---

## Task 3: Extract write-sites (three sheets_db shapes + direct supabase.from)

Resolves the spec's §3.5b requirement, including the round-9 finding that `app/actions/auth.ts` writes `users` directly via `supabase.from("users").update(...)`.

**Files:**
- Create: `scripts/system-map/extract-writes.ts`
- Test: `scripts/system-map/extract-writes.test.ts`

**Interfaces:**
- Produces: `type WriteSite = { file: string; table: string }`; `type UnresolvedWrite = { file: string; reason: string }`; `extractWrites(files: { path: string; source: string }[]): { writes: WriteSite[]; unresolved: UnresolvedWrite[] }`. Resolves table names via: (1) string literal argument; (2) same-file `const NAME = "Table"` then that NAME passed; (3) two-hop through `createEntity/updateEntity/deleteEntity/softDeleteEntity` (first argument is the table); plus direct `supabase.from("t").{insert,update,upsert,delete}`. A write-verb call whose table argument is none of these → `unresolved`, never dropped.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { extractWrites } from "./extract-writes";

describe("extractWrites", () => {
  it("resolves literal, same-file const, shared-actions two-hop, and direct supabase.from", () => {
    const files = [
      { path: "app/a/actions.ts", source: `await insert("Units", data);` },
      { path: "app/b/actions.ts", source: `const SHEET = "Users";\nawait update(SHEET, id, data);` },
      { path: "app/c/actions.ts", source: `const SHEET = "Brands";\nreturn createEntity(SHEET, "BR", data, PATH);` },
      { path: "app/actions/auth.ts", source: `await supabase.from("users").update({ password_hash });` },
    ];
    const { writes } = extractWrites(files);
    expect(writes).toEqual([
      { file: "app/a/actions.ts", table: "Units" },
      { file: "app/actions/auth.ts", table: "users" },
      { file: "app/b/actions.ts", table: "Users" },
      { file: "app/c/actions.ts", table: "Brands" },
    ]);
  });

  it("reports an unresolvable table name instead of dropping it", () => {
    const files = [{ path: "app/d/actions.ts", source: `await insert(computeName(x), data);` }];
    const { writes, unresolved } = extractWrites(files);
    expect(writes).toEqual([]);
    expect(unresolved).toEqual([
      { file: "app/d/actions.ts", reason: "insert(...) with a non-literal table argument: computeName(x)" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/system-map/extract-writes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export type WriteSite = { file: string; table: string };
export type UnresolvedWrite = { file: string; reason: string };

const SHEETS_VERBS = ["insert", "insertMany", "update", "updateMany", "remove", "removeMany"];
const WRAPPERS = ["createEntity", "updateEntity", "deleteEntity", "softDeleteEntity"];

// `const NAME = "Table"` declarations in the same file.
function localConsts(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of source.matchAll(/const\s+(\w+)\s*=\s*"([^"]+)"/g)) map.set(m[1], m[2]);
  return map;
}

// Resolve one call argument to a table name, or null if not statically known.
function resolveArg(arg: string, consts: Map<string, string>): string | null {
  const literal = /^"([^"]+)"$/.exec(arg.trim());
  if (literal) return literal[1];
  const asConst = consts.get(arg.trim());
  return asConst ?? null;
}

function firstArg(callBody: string): string {
  // callBody is what's inside the parens; take up to the first top-level comma.
  let depth = 0;
  for (let i = 0; i < callBody.length; i++) {
    const c = callBody[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) return callBody.slice(0, i);
  }
  return callBody;
}

// A single regex cannot match a balanced call — insert(computeName(x), data)
// would stop at the inner ")". Scan forward from each verb name, tracking paren
// depth, to capture the whole argument list. The `(?<![.\w])` lookbehind skips
// method calls (supabase's `.update(...)`, `.insert(...)`) and identifiers that
// merely end in a verb name; sheets_db verbs and shared-actions wrappers are
// always called as bare functions.
const VERB_CALL = /(?<![.\w])(\w+)\s*\(/g;
const SUPABASE_WRITE = /\.from\(\s*"([^"]+)"\s*\)\s*\.\s*(insert|update|upsert|delete)\b/g;

function callArgs(source: string, openParenIndex: number): string | null {
  let depth = 1;
  let i = openParenIndex + 1;
  const start = i;
  for (; i < source.length && depth > 0; i++) {
    const c = source[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
  }
  return depth === 0 ? source.slice(start, i - 1) : null;
}

export function extractWrites(files: { path: string; source: string }[]) {
  const writes: WriteSite[] = [];
  const unresolved: UnresolvedWrite[] = [];

  for (const { path, source } of files) {
    const consts = localConsts(source);

    for (const sm of source.matchAll(SUPABASE_WRITE)) {
      writes.push({ file: path, table: sm[1] });
    }

    for (const m of source.matchAll(VERB_CALL)) {
      const fn = m[1];
      if (!SHEETS_VERBS.includes(fn) && !WRAPPERS.includes(fn)) continue;
      const argsBody = callArgs(source, m.index + m[0].length - 1);
      if (argsBody === null) continue;
      const arg = firstArg(argsBody);
      const table = resolveArg(arg, consts);
      if (table) writes.push({ file: path, table });
      else unresolved.push({ file: path, reason: `${fn}(...) with a non-literal table argument: ${arg.trim()}` });
    }
  }

  const key = (w: WriteSite) => `${w.file}|${w.table}`;
  const deduped = [...new Map(writes.map(w => [key(w), w])).values()]
    .sort((a, b) => a.file.localeCompare(b.file) || a.table.localeCompare(b.table));
  return { writes: deduped, unresolved };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/system-map/extract-writes.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the known real case is caught (use a temp script, not glob)**

`glob` is NOT a declared dependency and returns backslash paths on this Windows repo, leaking `lib/historical/` past a forward-slash filter (Sonnet round-4 review). Use a throwaway `.ts` file with the same `walk`+`path.join` approach Task 4's `generate.ts` uses. Create `scripts/system-map/__census.ts`:

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { extractWrites } from "./extract-writes";
const root = process.cwd();
const files: { path: string; source: string }[] = [];
function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!full.endsWith(".ts") || full.endsWith(".test.ts")) continue;
    if (full.includes("sheets_db") || full.includes(join("lib", "historical")) || full.includes(join("lib", "shared-actions"))) continue;
    files.push({ path: relative(root, full).split(sep).join("/"), source: readFileSync(full, "utf8") });
  }
}
for (const b of ["app", "lib"]) walk(join(root, b));
const r = extractWrites(files);
console.log("writes:", r.writes.length, "unresolved:", r.unresolved.length);
console.log("auth users:", r.writes.find(w => w.file === "app/actions/auth.ts"));
console.log("unresolved:", r.unresolved);
```

Run: `npx vite-node scripts/system-map/__census.ts && rm scripts/system-map/__census.ts`
Expected: non-zero writes; `auth users:` shows `{ file: 'app/actions/auth.ts', table: 'users' }`. Unresolved should be small now that `shared-actions.ts` is excluded — a couple of comment-text false matches (e.g. the word "update(" inside a `//` comment) are a known, accepted limitation, not a real 4th shape. **Note: RPC writes are NOT in this census — they are handled in Task 3b; a flow like stock-issue writes only via RPC and will correctly show zero direct writes here.**

- [ ] **Step 6: Commit**

```bash
git add scripts/system-map/extract-writes.ts scripts/system-map/extract-writes.test.ts
git commit -m "feat(systemmap): extract write-sites incl. direct supabase.from"
```

---

## Task 3b: Extract RPC write-sites (the dominant write path)

**The critical path this codebase actually writes through.** Measured 2026-09-02: 14 files, 16 `.rpc("...")` atomic functions carry most core writes (`create_issue_slip_atomic`, `void_order_atomic`, `save_purchase_order_atomic`, `save_product_atomic`, the stocktake functions). The table an RPC writes lives in its SQL body in a migration, not at the TS call site — and the function is redefined via `create or replace function` across many migrations, so the LATEST definition wins. Spec §3.5b, third write path.

**Files:**
- Create: `scripts/system-map/extract-rpc.ts`
- Test: `scripts/system-map/extract-rpc.test.ts`

**Interfaces:**
- Produces: `rpcCallSites(files: { path: string; source: string }[]): { file: string; fn: string }[]` (parses `.rpc("name"` at call sites); `rpcWriteTargets(sqlSources: string[]): Map<string, string[]>` (function name → tables it writes, from the latest `create [or replace] function` body); `resolveRpcWrites(callSites, targets): { writes: WriteSite[]; unresolved: UnresolvedWrite[] }` (a call to a function whose body could not be found → unresolved, never dropped).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { rpcCallSites, rpcWriteTargets, resolveRpcWrites } from "./extract-rpc";

describe("extract-rpc", () => {
  it("finds .rpc call sites", () => {
    const files = [{ path: "lib/manual-issue-transaction.ts", source: `await client.rpc("create_issue_slip_atomic", { p });` }];
    expect(rpcCallSites(files)).toEqual([{ file: "lib/manual-issue-transaction.ts", fn: "create_issue_slip_atomic" }]);
  });

  it("reads write targets from the latest function definition", () => {
    const older = `create function create_issue_slip_atomic() returns void as $$ begin
      insert into public.stock_ledger (id) values ('x'); end; $$ language plpgsql;`;
    const newer = `create or replace function create_issue_slip_atomic() returns void as $$ begin
      insert into public.issue_slips (id) values ('x');
      insert into public.stock_issues (id) values ('y'); end; $$ language plpgsql;`;
    const targets = rpcWriteTargets([older, newer]);
    expect(targets.get("create_issue_slip_atomic")).toEqual(["issue_slips", "stock_issues"]);
  });

  it("resolves call site to tables, and flags an unknown function", () => {
    const callSites = [
      { file: "lib/x.ts", fn: "create_issue_slip_atomic" },
      { file: "lib/y.ts", fn: "mystery_fn" },
    ];
    const targets = new Map([["create_issue_slip_atomic", ["issue_slips", "stock_issues"]]]);
    const r = resolveRpcWrites(callSites, targets);
    expect(r.writes).toEqual([
      { file: "lib/x.ts", table: "issue_slips" },
      { file: "lib/x.ts", table: "stock_issues" },
    ]);
    expect(r.unresolved).toEqual([{ file: "lib/y.ts", reason: "rpc('mystery_fn') has no function body found in migrations" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/system-map/extract-rpc.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { WriteSite, UnresolvedWrite } from "./extract-writes";

const RPC_CALL = /\.rpc\(\s*"([a-z_]+)"/g;

export function rpcCallSites(files: { path: string; source: string }[]): { file: string; fn: string }[] {
  const out: { file: string; fn: string }[] = [];
  for (const { path, source } of files) {
    for (const m of source.matchAll(RPC_CALL)) out.push({ file: path, fn: m[1] });
  }
  return out;
}

// Latest definition wins: iterate sqlSources in order, overwrite the map.
const FN_DEF = /create\s+(?:or replace\s+)?function\s+(?:public\.)?(\w+)\b([\s\S]*?)\$\$([\s\S]*?)\$\$/gi;
const WRITE_TARGET = /(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?(\w+)/gi;

export function rpcWriteTargets(sqlSources: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const sql of sqlSources) {
    for (const def of sql.matchAll(FN_DEF)) {
      const fn = def[1];
      const body = def[3];
      const tables = new Set<string>();
      for (const w of body.matchAll(WRITE_TARGET)) tables.add(w[1]);
      map.set(fn, [...tables].sort()); // later migration overwrites earlier
    }
  }
  return map;
}

export function resolveRpcWrites(
  callSites: { file: string; fn: string }[],
  targets: Map<string, string[]>,
): { writes: WriteSite[]; unresolved: UnresolvedWrite[] } {
  const writes: WriteSite[] = [];
  const unresolved: UnresolvedWrite[] = [];
  for (const { file, fn } of callSites) {
    const tables = targets.get(fn);
    if (!tables) { unresolved.push({ file, reason: `rpc('${fn}') has no function body found in migrations` }); continue; }
    for (const table of tables) writes.push({ file, table });
  }
  const key = (w: WriteSite) => `${w.file}|${w.table}`;
  const deduped = [...new Map(writes.map(w => [key(w), w])).values()]
    .sort((a, b) => a.file.localeCompare(b.file) || a.table.localeCompare(b.table));
  return { writes: deduped, unresolved };
}
```

Note on `update`/`delete` target parsing: `update public.foo set ...` and `delete from public.foo` both start with the table token captured above. `WRITE_TARGET`'s `update\s+(\w+)` could match `update set` edge cases, but in practice these function bodies write `update public.<table> set`; accept the small risk and rely on the test census in Step 5 to catch anything wrong.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/system-map/extract-rpc.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify against real migrations + real call sites**

Create a throwaway `scripts/system-map/__rpc-census.ts` that walks `supabase/migrations/*.sql` into `rpcWriteTargets`, walks `app`+`lib` (excluding tests) into `rpcCallSites`, resolves, and prints. Run it, then delete it.
Expected: `create_issue_slip_atomic` resolves to include `issue_slips` and `stock_issues`; `void_order_atomic`, `save_purchase_order_atomic`, `save_product_atomic` all resolve to non-empty table lists; unresolved is small. If `create_issue_slip_atomic` resolves to `[]` or is missing, the `$$`-body regex failed — stop and fix, since the seed (Task 6) depends on it.

- [ ] **Step 6: Commit**

```bash
git add scripts/system-map/extract-rpc.ts scripts/system-map/extract-rpc.test.ts
git commit -m "feat(systemmap): extract RPC write-sites from function bodies"
```

---

## Task 4: Extract routes→actions and compose the generated map

**Files:**
- Create: `scripts/system-map/extract-routes.ts`, `scripts/system-map/build-map.ts`, `scripts/system-map/generate.ts`
- Test: `scripts/system-map/extract-routes.test.ts`, `scripts/system-map/build-map.test.ts`

**Interfaces:**
- Consumes: `TableInfo` (Task 2), `WriteSite`/`UnresolvedWrite` (Tasks 3 and 3b), `Relation` (Task 1).
- Produces: `extractRoutes(pages: {route: string; imports: string[]}[]): RouteActions[]`; `buildMap(input: { tables: TableInfo[]; writes: WriteSite[]; unresolved: UnresolvedWrite[]; routes: RouteActions[] }): string` (deterministic markdown, contains a `relations` block of write-sites as `file -> table (write)`); `generate.ts` is a CLI writing `docs/generated/system-map.md`. **`generate.ts` merges the direct writes (Task 3) and the RPC writes (Task 3b) into one `writes` list before calling `buildMap`.**

- [ ] **Step 1: Write the failing test for build-map**

```ts
import { describe, it, expect } from "vitest";
import { buildMap } from "./build-map";
import { parseRelationBlock } from "../doc-map/relation-block";

describe("buildMap", () => {
  it("emits a relations block covering every write-site", () => {
    const md = buildMap({
      tables: [{ name: "orders_v2", columns: ["id", "status"], statusValues: ["COMPLETED", "SUPERSEDED"] }],
      writes: [{ file: "app/pos/actions.ts", table: "orders_v2" }],
      unresolved: [],
      routes: [],
    });
    expect(parseRelationBlock(md)).toEqual([
      { from: "app/pos/actions.ts", to: "orders_v2", kind: "write" },
    ]);
  });

  it("lists unresolved writes in a visible section so they are not lost", () => {
    const md = buildMap({ tables: [], writes: [], unresolved: [{ file: "app/x.ts", reason: "dynamic" }], routes: [] });
    expect(md).toContain("UNRESOLVED");
    expect(md).toContain("app/x.ts");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/system-map/build-map.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `extract-routes.ts`, `build-map.ts`, `generate.ts`**

```ts
// extract-routes.ts
export type RouteActions = { route: string; actions: string[] };
export function extractRoutes(pages: { route: string; imports: string[] }[]): RouteActions[] {
  return pages
    .map(p => ({ route: p.route, actions: [...new Set(p.imports)].sort() }))
    .sort((a, b) => a.route.localeCompare(b.route));
}
```

```ts
// build-map.ts
import { serializeRelations, type Relation } from "../doc-map/relation-block";
import type { TableInfo } from "./extract-tables";
import type { WriteSite, UnresolvedWrite } from "./extract-writes";
import type { RouteActions } from "./extract-routes";

export function buildMap(input: {
  tables: TableInfo[];
  writes: WriteSite[];
  unresolved: UnresolvedWrite[];
  routes: RouteActions[];
}): string {
  const rels: Relation[] = input.writes.map(w => ({ from: w.file, to: w.table, kind: "write" }));
  const out: string[] = [];
  out.push("# System map (generated)");
  out.push("");
  out.push("Do not edit by hand. Regenerate with `vite-node scripts/system-map/generate.ts`.");
  out.push("");
  out.push("## Write relations");
  out.push(serializeRelations(rels));
  out.push("");
  out.push("## Tables");
  for (const t of input.tables) {
    const status = t.statusValues.length ? ` status: ${t.statusValues.join(", ")}` : "";
    out.push(`- ${t.name} (${t.columns.join(", ")})${status}`);
  }
  if (input.unresolved.length) {
    out.push("");
    out.push("## UNRESOLVED write-sites (need a human)");
    for (const u of input.unresolved) out.push(`- ${u.file}: ${u.reason}`);
  }
  return out.join("\n") + "\n";
}
```

```ts
// generate.ts (thin CLI — reads disk, writes the file)
import { writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { extractTables } from "./extract-tables";
import { extractWrites } from "./extract-writes";
import { rpcCallSites, rpcWriteTargets, resolveRpcWrites } from "./extract-rpc";
import { extractRoutes } from "./extract-routes";
import { buildMap } from "./build-map";

const root = process.cwd();
function walk(dir: string, hit: (p: string) => void) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, hit);
    else hit(full);
  }
}
const sql: string[] = [];
walk(join(root, "supabase/migrations"), p => { if (p.endsWith(".sql")) sql.push(readFileSync(p, "utf8")); });
const codeFiles: { path: string; source: string }[] = [];
for (const base of ["app", "lib"]) {
  walk(join(root, base), p => {
    if (!p.endsWith(".ts") || p.endsWith(".test.ts")) return;
    // Exclude the adapter files that call the DB verbs with a parameter, not a
    // real table name: sheets_db (the adapter) and shared-actions (the generic
    // wrapper). Including them only produces permanent, meaningless "unresolved"
    // noise (Sonnet round-4 review). lib/historical is dead code.
    if (p.includes("sheets_db") || p.includes(join("lib", "shared-actions")) || p.includes(join("lib", "historical"))) return;
    codeFiles.push({ path: relative(root, p).split(sep).join("/"), source: readFileSync(p, "utf8") });
  });
}
const tables = extractTables(sql);
const direct = extractWrites(codeFiles);
const rpc = resolveRpcWrites(rpcCallSites(codeFiles), rpcWriteTargets(sql));
// Merge and dedupe direct + RPC write-sites.
const key = (w: { file: string; table: string }) => `${w.file}|${w.table}`;
const writes = [...new Map([...direct.writes, ...rpc.writes].map(w => [key(w), w])).values()]
  .sort((a, b) => a.file.localeCompare(b.file) || a.table.localeCompare(b.table));
const unresolved = [...direct.unresolved, ...rpc.unresolved];
const map = buildMap({ tables, writes, unresolved, routes: extractRoutes([]) });
mkdirSync(join(root, "docs/generated"), { recursive: true });
writeFileSync(join(root, "docs/generated/system-map.md"), map);
console.log(`[system-map] ${tables.length} tables, ${writes.length} writes, ${unresolved.length} unresolved`);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/system-map/build-map.test.ts scripts/system-map/extract-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Generate the real map and eyeball it**

Run: `npx vite-node scripts/system-map/generate.ts && head -40 docs/generated/system-map.md`
Expected: prints the counts line; the file exists with a `relations` block that includes RPC-derived writes such as `lib/manual-issue-transaction.ts -> stock_issues (write)` and `lib/manual-issue-transaction.ts -> issue_slips (write)`, plus a `## Tables` section listing real tables like `orders_v2`, `stock_issues`. Confirm `stock_issues` appears in the relations block (not only in Tables) — the seed in Task 6 depends on it.

- [ ] **Step 6: Commit**

```bash
git add scripts/system-map/ docs/generated/system-map.md
git commit -m "feat(systemmap): compose and generate docs/generated/system-map.md"
```

---

## Task 5: Map-drift check (spec §3.6)

Red when the generated map has a write relation the hand `SYSTEM-MAP.md` block does not list. Pure core + fixtures now; wired into the hook in Task 10.

**Files:**
- Create: `scripts/check-result.ts`, `scripts/doc-checks/map-drift-core.ts`
- Test: `scripts/doc-checks/map-drift-core.test.ts`

**Interfaces:**
- Consumes: `parseRelationBlock` (Task 1), `CheckResult` (`{ check, ok, problems }`).
- Produces: `scripts/check-result.ts` re-exporting `CheckResult`; `checkMapDrift(generatedMarkdown: string, handMarkdown: string): CheckResult`. A relation present in generated but absent from hand → a problem. (One direction only, per spec §3.6: generated is ground truth; the hand map may intentionally omit reads, but must not miss a write relation.)

- [ ] **Step 0: Create the shared `CheckResult` re-export**

`CheckResult` is defined at `scripts/check-rules-current-core.ts:14`. Tasks 5, 7, and 8 all import it from `../check-result`, so create that shared module once here:

```ts
// scripts/check-result.ts
export type { CheckResult } from "./check-rules-current-core";
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { checkMapDrift } from "./map-drift-core";

const gen = "```relations\napp/pos/actions.ts -> orders_v2 (write)\napp/pos/actions.ts -> order_payments (write)\n```";

describe("checkMapDrift", () => {
  it("passes when the hand block lists every generated write relation", () => {
    const r = checkMapDrift(gen, gen);
    expect(r.ok).toBe(true);
  });

  it("fails naming the relation the hand map is missing", () => {
    const hand = "```relations\napp/pos/actions.ts -> orders_v2 (write)\n```";
    const r = checkMapDrift(gen, hand);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([
      "hand SYSTEM-MAP.md is missing write relation: app/pos/actions.ts -> order_payments",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/doc-checks/map-drift-core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { parseRelationBlock } from "../doc-map/relation-block";
import type { CheckResult } from "../check-result";

export function checkMapDrift(generatedMarkdown: string, handMarkdown: string): CheckResult {
  const gen = parseRelationBlock(generatedMarkdown).filter(r => r.kind === "write");
  const hand = new Set(parseRelationBlock(handMarkdown).map(r => `${r.from} -> ${r.to} (${r.kind})`));
  const problems = gen
    .filter(r => !hand.has(`${r.from} -> ${r.to} (write)`))
    .map(r => `hand SYSTEM-MAP.md is missing write relation: ${r.from} -> ${r.to}`);
  return { check: "map-drift", ok: problems.length === 0, problems };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/doc-checks/map-drift-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-checks/map-drift-core.ts scripts/doc-checks/map-drift-core.test.ts scripts/check-result.ts
git commit -m "feat(docchecks): map-drift check (generated vs hand relation block)"
```

---

## Task 6: Seed slice — prove the drift check catches a real removal (spec §6 exit bar)

The Phase-1 "done" bar is a real catch, not a synthetic fixture. Seed = `stock-issue`, whose real write path is the RPC `create_issue_slip_atomic` (called from `lib/manual-issue-transaction.ts`), so with Task 3b the generator emits real write relations `lib/manual-issue-transaction.ts -> issue_slips (write)` and `-> stock_issues (write)`. Write the hand map block to match the generated one for that flow, confirm the check passes, then delete one real relation from the hand block and confirm it fails.

**Files:**
- Create: `docs/generated/README.md`, `docs/01-system/SYSTEM-MAP.md`, `docs/03-workflows/stock-issue.md`
- Create: `scripts/doc-checks/seed-proof.test.ts`

**Interfaces:**
- Consumes: `checkMapDrift` (Task 5), the generated `docs/generated/system-map.md` (Task 4).

- [ ] **Step 1: Write `docs/generated/README.md`**

```markdown
# Generated files — DO NOT EDIT BY HAND

Everything in this folder is produced by tools under `scripts/`. Re-running the
tool is the source of truth; hand edits are overwritten. To refresh:
`vite-node scripts/system-map/generate.ts`.
```

- [ ] **Step 2: Write the seed hand map, copying only the stock-issue write relations from the generated file**

Run first: `grep "stock_issues" docs/generated/system-map.md`
Then create `docs/01-system/SYSTEM-MAP.md` with prose plus a `relations` block containing exactly the write relations whose target is `stock_issues` (and any other tables the issue-slip actions write). Example shape (fill from the grep output — do not invent relations):

```markdown
# System map (hand-drawn overview)

Concise map for humans. The full machine-derived map lives in
`docs/generated/system-map.md` (do not hand-edit that one).

Note: `lib/sheets_db.ts` is the DB adapter — the name says Google Sheets but the
implementation is Supabase (spec §3.2c).

## Stock-issue write relations
```

Followed by a `relations` fenced block with the real lines from the grep.

- [ ] **Step 3: Write a minimal seed workflow doc with a `flow-decl` block**

Create `docs/03-workflows/stock-issue.md`. It MUST open with a fenced `flow-decl` block in exactly this shape (the format Task 7 parses — keys are fixed, values are comma-separated), filled from real files. Fill `tables` with what the generated map actually shows for these files (from Step 2's grep), and `files` with the real write-path file (`lib/manual-issue-transaction.ts`, the RPC caller — NOT the actions.ts, which only reads and delegates):

````markdown
# Luồng xuất kho

```flow-decl
routes: /admin/inventory/issue-slips
files: lib/manual-issue-transaction.ts
tables: issue_slips, stock_issues
brCodes: BR-COGS-005
```

(Prose describing the five questions follows — keep the whole file under 200 lines.)
````

Verify `BR-COGS-005` actually exists in `docs/BUSINESS-RULES.md` before using it (`grep BR-COGS-005 docs/BUSINESS-RULES.md`); if not, pick a real COGS rule code that does. Keep it under the 200-line ceiling.

- [ ] **Step 4: Write the proof test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { checkMapDrift } from "./map-drift-core";

// Scope the generated side to the SEED FLOW's file, not to a table name:
// stock_issues is written by both lib/manual-issue-transaction.ts (this flow)
// and lib/stocktake-transaction.ts (a different flow). Filtering by table would
// pull the stocktake relation in and make the seed hand map look incomplete.
const FLOW_FILE = "lib/manual-issue-transaction.ts";

describe("seed proof: drift check catches a real removed relation", () => {
  const generated = readFileSync("docs/generated/system-map.md", "utf8");
  const hand = readFileSync("docs/01-system/SYSTEM-MAP.md", "utf8");
  const genFlowOnly = generated.split("\n")
    .filter(l => l.includes(FLOW_FILE) || l.includes("```")).join("\n");

  it("passes on the committed seed", () => {
    expect(checkMapDrift(genFlowOnly, hand).ok).toBe(true);
  });

  it("fails when a real relation is dropped from the hand map", () => {
    const brokenHand = hand.split("\n").filter(l => !l.includes("stock_issues")).join("\n");
    const r = checkMapDrift(genFlowOnly, brokenHand);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("stock_issues");
  });
});
```

- [ ] **Step 5: Run the proof**

Run: `npx vitest run scripts/doc-checks/seed-proof.test.ts`
Expected: PASS — both the clean case and the real-removal catch. This is the Phase-1 exit bar (spec §6): a real relation, really caught.

- [ ] **Step 6: Commit**

```bash
git add docs/generated/README.md docs/01-system/SYSTEM-MAP.md docs/03-workflows/stock-issue.md scripts/doc-checks/seed-proof.test.ts
git commit -m "feat(docs): seed stock-issue map + workflow doc; prove drift catch"
```

---

## Task 7: Flow-doc declaration check (spec §3.7)

Two properties: (a) the declaration block's facts match reality (routes exist, source files exist, declared tables match what those files actually write per the generated map, `BR-*` codes exist); (b) if a staged change touches a flow's declared source file, the flow doc must be staged too. (a) is pure and testable now; (b) reads `git diff --cached --name-only` and is exercised in Task 10.

**Files:**
- Create: `scripts/doc-checks/flow-doc-core.ts`
- Test: `scripts/doc-checks/flow-doc-core.test.ts`

**Interfaces:**
- Consumes: generated write relations (Task 4), `CheckResult`.
- Produces: `type FlowDecl = { doc: string; routes: string[]; files: string[]; tables: string[]; brCodes: string[] }`; `parseFlowDecl(markdown: string, docPath: string): FlowDecl | null`; `checkFlowFacts(decl: FlowDecl, world: { routes: Set<string>; files: Set<string>; writesByFile: Map<string, Set<string>>; brCodes: Set<string> }): CheckResult`; `checkFlowStagedCoupling(decls: FlowDecl[], stagedPaths: string[]): CheckResult`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { checkFlowFacts, checkFlowStagedCoupling, type FlowDecl } from "./flow-doc-core";

const decl: FlowDecl = {
  doc: "docs/03-workflows/stock-issue.md",
  routes: ["/admin/inventory/issue-slips"],
  files: ["lib/manual-issue-transaction.ts"],
  tables: ["stock_issues"],
  brCodes: ["BR-COGS-005"],
};

describe("checkFlowFacts", () => {
  it("passes when every declared fact matches reality", () => {
    const r = checkFlowFacts(decl, {
      routes: new Set(["/admin/inventory/issue-slips"]),
      files: new Set(["lib/manual-issue-transaction.ts"]),
      writesByFile: new Map([["lib/manual-issue-transaction.ts", new Set(["stock_issues"])]]),
      brCodes: new Set(["BR-COGS-005"]),
    });
    expect(r.ok).toBe(true);
  });

  it("fails when a declared table is not actually written by the declared files", () => {
    const r = checkFlowFacts(decl, {
      routes: new Set(["/admin/inventory/issue-slips"]),
      files: new Set(["lib/manual-issue-transaction.ts"]),
      writesByFile: new Map([["lib/manual-issue-transaction.ts", new Set()]]),
      brCodes: new Set(["BR-COGS-005"]),
    });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("stock_issues");
  });
});

describe("checkFlowStagedCoupling", () => {
  it("fails when a flow's source file is staged but its doc is not", () => {
    const r = checkFlowStagedCoupling([decl], ["lib/manual-issue-transaction.ts"]);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("stock-issue.md");
  });

  it("passes when both the source file and its doc are staged", () => {
    const r = checkFlowStagedCoupling([decl],
      ["lib/manual-issue-transaction.ts", "docs/03-workflows/stock-issue.md"]);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/doc-checks/flow-doc-core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { CheckResult } from "../check-result";

export type FlowDecl = {
  doc: string; routes: string[]; files: string[]; tables: string[]; brCodes: string[];
};

export function checkFlowFacts(
  decl: FlowDecl,
  world: { routes: Set<string>; files: Set<string>; writesByFile: Map<string, Set<string>>; brCodes: Set<string> },
): CheckResult {
  const problems: string[] = [];
  for (const r of decl.routes) if (!world.routes.has(r)) problems.push(`${decl.doc}: route '${r}' does not exist`);
  for (const f of decl.files) if (!world.files.has(f)) problems.push(`${decl.doc}: file '${f}' does not exist`);
  for (const code of decl.brCodes) if (!world.brCodes.has(code)) problems.push(`${decl.doc}: rule '${code}' does not exist`);
  const actuallyWritten = new Set<string>();
  for (const f of decl.files) for (const t of world.writesByFile.get(f) ?? []) actuallyWritten.add(t);
  for (const t of decl.tables) {
    if (!actuallyWritten.has(t)) problems.push(`${decl.doc}: declares writing '${t}' but no declared file writes it`);
  }
  return { check: "flow-doc-facts", ok: problems.length === 0, problems };
}

export function checkFlowStagedCoupling(decls: FlowDecl[], stagedPaths: string[]): CheckResult {
  const staged = new Set(stagedPaths);
  const problems: string[] = [];
  for (const decl of decls) {
    const touched = decl.files.some(f => staged.has(f));
    if (touched && !staged.has(decl.doc)) {
      problems.push(`${decl.doc}: a declared source file changed but the flow doc was not updated ` +
        `(if truly behaviour-neutral, add a "reviewed, no behaviour change — <date>" line and stage the doc)`);
    }
  }
  return { check: "flow-doc-staged", ok: problems.length === 0, problems };
}
```

Also implement `parseFlowDecl` matching the exact `flow-decl` block Task 6 writes — a fenced ```` ```flow-decl ```` block with four fixed keys (`routes`, `files`, `tables`, `brCodes`), each a comma-separated value list; the `doc` field is filled from the `docPath` argument. Same fenced-block reading technique as Task 1's `parseRelationBlock`. Add this focused test:

```ts
import { parseFlowDecl } from "./flow-doc-core";

it("parses a flow-decl block into a FlowDecl", () => {
  const md = [
    "# Luồng xuất kho",
    "```flow-decl",
    "routes: /admin/inventory/issue-slips",
    "files: lib/manual-issue-transaction.ts",
    "tables: issue_slips, stock_issues",
    "brCodes: BR-COGS-005",
    "```",
  ].join("\n");
  expect(parseFlowDecl(md, "docs/03-workflows/stock-issue.md")).toEqual({
    doc: "docs/03-workflows/stock-issue.md",
    routes: ["/admin/inventory/issue-slips"],
    files: ["lib/manual-issue-transaction.ts"],
    tables: ["issue_slips", "stock_issues"],
    brCodes: ["BR-COGS-005"],
  });
});
```

Implementation sketch: scan lines between ```` ```flow-decl ```` and the closing fence; for each `key: v1, v2` line, split on the first colon, trim, and split the value on commas (dropping empties). Return `null` if no `flow-decl` fence is present (a doc without one is simply not a flow doc).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/doc-checks/flow-doc-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-checks/flow-doc-core.ts scripts/doc-checks/flow-doc-core.test.ts
git commit -m "feat(docchecks): flow-doc declaration facts + staged-coupling check"
```

---

## Task 8: Line-ceiling check with exemption allowlist (spec §3.3, §6b items 3-4)

**Files:**
- Create: `scripts/doc-checks/line-ceiling-core.ts`
- Test: `scripts/doc-checks/line-ceiling-core.test.ts`

**Interfaces:**
- Produces: `checkLineCeiling(files: { path: string; lineCount: number }[], ceiling: number, exempt: Set<string>): CheckResult`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { checkLineCeiling } from "./line-ceiling-core";

describe("checkLineCeiling", () => {
  it("fails a doc over the ceiling", () => {
    const r = checkLineCeiling([{ path: "docs/03-workflows/sales.md", lineCount: 260 }], 200, new Set());
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("sales.md");
  });

  it("passes an over-ceiling file that is exempt", () => {
    const r = checkLineCeiling([{ path: "CLAUDE.md", lineCount: 316 }], 200, new Set(["CLAUDE.md"]));
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/doc-checks/line-ceiling-core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { CheckResult } from "../check-result";

export function checkLineCeiling(
  files: { path: string; lineCount: number }[],
  ceiling: number,
  exempt: Set<string>,
): CheckResult {
  const problems = files
    .filter(f => !exempt.has(f.path) && f.lineCount > ceiling)
    .map(f => `${f.path} is ${f.lineCount} lines, over the ${ceiling}-line ceiling — split by concern`);
  return { check: "line-ceiling", ok: problems.length === 0, problems };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/doc-checks/line-ceiling-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the CLI scoped to the governed doc set only**

**Scope by ALLOWLIST, not blocklist.** The ceiling governs the new doc set, not
process artifacts. Scanning all of `docs/**` sweeps in ~72 files under
`docs/superpowers/`, `docs/audits/`, `docs/handoffs/` and legacy top-level docs —
all history/process artifacts (CLAUDE.md §11) or files Phase 5 deletes, none of
them the doc set. An allowlist is also forward-safe: a new plan file under
`docs/superpowers/` will never trip the gate.

Create `scripts/doc-checks/line-ceiling.ts` that scans ONLY these governed
locations for `*.md`: `docs/01-system/`, `docs/02-rules/`, `docs/03-workflows/`,
`docs/04-operations/` (recursively; skip any that don't exist yet — `02-rules`
and `04-operations` arrive in later phases), plus the two root files `CLAUDE.md`
and `README.md`. **Never** scan `docs/generated/` (machine output). Pass this
exemption set with reasons in comments:

```ts
// CLAUDE.md: the one file the machine auto-loads every session; splitting it
// into must-open files is the exact anti-pattern spec §1b forbids (§3.3).
// docs/BUSINESS-RULES.md: 478 lines today; its by-domain split lands in the
// Phase 3 plan. Exempt UNTIL then so the gate is not red on a kept file in
// the Phase-1..Phase-3 window (spec §6b item 4). REMOVE this entry in the
// Phase 3 plan once business-rules/ exists.
const EXEMPT = new Set(["CLAUDE.md", "docs/BUSINESS-RULES.md"]);
```

Run it and confirm it reports GREEN (the current governed doc set —
`docs/01-system/SYSTEM-MAP.md`, `docs/03-workflows/stock-issue.md`, `README.md`,
and exempt `CLAUDE.md` — is all under the ceiling). Note: `docs/BUSINESS-RULES.md`
sits at the repo `docs/` root, not inside the four governed subfolders, so it is
not scanned yet anyway; keep it in EXEMPT so that when Phase 3 moves rules under
`docs/02-rules/` the exemption is already documented for removal.

- [ ] **Step 6: Commit**

```bash
git add scripts/doc-checks/line-ceiling-core.ts scripts/doc-checks/line-ceiling-core.test.ts scripts/doc-checks/line-ceiling.ts
git commit -m "feat(docchecks): 200-line ceiling with documented exemptions"
```

---

## Task 9: Open-items generator from vitest todos (spec §3.8)

`OPEN-ITEMS.md` is generated from `vitest run --reporter=json`, filtered to `status === "todo"`. Verified in the spec's round-2 review: a `.todo` test does not fail `vitest run` (exit 0), so `CLAUDE.md` §9 survives.

**Files:**
- Create: `scripts/doc-checks/open-items.ts`
- Test: `scripts/doc-checks/open-items-core.test.ts`

**Interfaces:**
- Produces: `renderOpenItems(todos: { title: string; file: string }[]): string` (pure — the JSON parsing is in the thin CLI); the CLI shells out to vitest, parses `assertionResults[].status === "todo"`, and writes `docs/04-operations/OPEN-ITEMS.md`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { renderOpenItems } from "./open-items";

describe("renderOpenItems", () => {
  it("lists todos grouped as markdown, empty-state when none", () => {
    expect(renderOpenItems([])).toContain("Không có việc treo");
    const md = renderOpenItems([{ title: "phai co nut ngung ban", file: "app/x.test.ts" }]);
    expect(md).toContain("phai co nut ngung ban");
    expect(md).toContain("app/x.test.ts");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/doc-checks/open-items-core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation (pure renderer)**

```ts
export function renderOpenItems(todos: { title: string; file: string }[]): string {
  const head = "# Việc đang làm (sinh tự động từ it.todo — đừng sửa tay)\n";
  if (todos.length === 0) return head + "\nKhông có việc treo.\n";
  const rows = todos
    .sort((a, b) => a.file.localeCompare(b.file) || a.title.localeCompare(b.title))
    .map(t => `- ${t.title} (${t.file})`)
    .join("\n");
  return head + "\n" + rows + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/doc-checks/open-items-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the CLI and verify against a real `.todo`**

Create `scripts/doc-checks/open-items.ts` that runs `npx vitest run --reporter=json --outputFile=<tmp>`, reads that JSON file, parses `testResults[].assertionResults[]` for `status === "todo"`, maps to `{ title: assertion.title, file: path.relative(process.cwd(), testResult.name) }`, and writes `docs/04-operations/OPEN-ITEMS.md` via `renderOpenItems`. **`testResults[].name` is an ABSOLUTE path in vitest 4.1.10 (verified by Sonnet round-4) — convert it with `path.relative(process.cwd(), name)` so the generated doc does not leak a machine-specific local path.** Then add a temporary probe test `lib/__todo_probe.test.ts` with `it.todo("probe")`, run the CLI, confirm the probe appears in the output file, then delete the probe.

Run: `printf 'import { it } from "vitest";\nit.todo("probe open item");\n' > lib/__todo_probe.test.ts && npx vite-node scripts/doc-checks/open-items.ts && grep "probe open item" docs/04-operations/OPEN-ITEMS.md && rm lib/__todo_probe.test.ts && npx vite-node scripts/doc-checks/open-items.ts`
Expected: the probe appears after the first run; after deleting it and regenerating, `OPEN-ITEMS.md` returns to the empty-state line.

- [ ] **Step 6: Commit**

```bash
git add scripts/doc-checks/open-items.ts scripts/doc-checks/open-items-core.test.ts docs/04-operations/OPEN-ITEMS.md
git commit -m "feat(docchecks): generate OPEN-ITEMS.md from vitest todos"
```

---

## Task 10: Wire the blocking checks into pre-commit and prove the whole gate

**Files:**
- Modify: `.husky/pre-commit`
- Create: `scripts/doc-checks/run-blocking.ts` (one entry the hook calls: regenerates the map, runs map-drift + flow-doc-facts + flow-doc-staged + line-ceiling; exits non-zero on any failure)

**Interfaces:**
- Consumes: every core check (Tasks 5, 7, 8), the generator (Task 4), `git diff --cached --name-only` for staged paths.

- [ ] **Step 1: Write `scripts/doc-checks/run-blocking.ts`**

It: (a) runs the generator to refresh `docs/generated/system-map.md`; (b) loads generated relations, the hand map, all `docs/03-workflows/*.md` decls, the route/file/BR worlds; (c) runs `checkMapDrift`, `checkFlowFacts` per decl, `checkFlowStagedCoupling` against `execSync("git diff --cached --name-only")`, `checkLineCeiling`; (d) prints `[docs] PASS/FAIL <check>` like `check-rules-current.ts` and sets `process.exitCode = 1` on any failure.

- [ ] **Step 2: Run it on the clean tree**

Run: `npx vite-node scripts/doc-checks/run-blocking.ts`
Expected: all `[docs] PASS`. Exit 0.

- [ ] **Step 3: Prove it blocks a real drift (manual, then revert)**

Run: edit `docs/01-system/SYSTEM-MAP.md` to delete one `stock_issues` relation line, then `npx vite-node scripts/doc-checks/run-blocking.ts`
Expected: `[docs] FAIL map-drift` naming the missing relation, exit 1. Then `git checkout docs/01-system/SYSTEM-MAP.md` to restore.

- [ ] **Step 4: Append to `.husky/pre-commit`**

Add after the existing `check-rules-current` block:

```sh
echo "[pre-commit] Running documentation gates..."
npx vite-node scripts/doc-checks/run-blocking.ts
if [ $? -ne 0 ]; then
  echo "[pre-commit] FAIL: a document disagrees with the code. Fix the doc, or add a reviewed-no-change line."
  exit 1
fi
echo "[pre-commit] PASS: docs current."
```

- [ ] **Step 5: Full verification (CLAUDE.md §9 gates)**

Run: `npx tsc --noEmit && npx vitest run && npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts`
Expected: `tsc` 0 errors; `vitest` all green (exit 0, todos counted separately); rules PASS; docs PASS. This is the Phase-1 completion gate.

- [ ] **Step 6: Commit**

```bash
git add .husky/pre-commit scripts/doc-checks/run-blocking.ts
git commit -m "feat(docchecks): wire documentation gates into pre-commit"
```

---

## Self-Review

**Spec coverage:**
- §3.5b write extraction: three paths — `sheets_db` calls + direct `supabase.from` → Task 3; **RPC function bodies → Task 3b** (the dominant path, added after the plan critique). ✓
- §3.6 two-layer map + drift check → Tasks 1, 4, 5. ✓
- §3.7 flow-doc declaration + staged coupling, pre-commit gate → Tasks 7, 10. ✓
- §3.8 open items from `it.todo` → Task 9. ✓
- §3.2d `docs/generated/` quarantine + README → Tasks 4, 6. ✓
- §3.3 200-line ceiling with CLAUDE.md exemption → Task 8. ✓
- §6 Phase-1 exit bar (real catch on a seed) → Task 6, re-proven Task 10. ✓
- §6b item 1 (build order) → task sequence. §6b item 2 (micro-format) → Task 1. §6b item 3 (ceiling gate = pre-commit) → Tasks 8, 10. §6b item 4 (ceiling vs BR split sequencing) → Task 8 exemption with removal noted for Phase 3. ✓
- §6b item 5 (BUSINESS-RULES orphan lines) is explicitly a Phase-3 item, not in this plan. ✓ (correctly deferred)

**Plan-critique round (Sonnet, 2026-09-02) — resolved before execution:** the seed flow writes via Postgres RPC, invisible to the original three-shape extractor (spec §2.27) → added Task 3b and merged RPC writes in Task 4; `lib/shared-actions.ts` added to `generate.ts` exclusions; the `glob` census one-liner replaced with a `walk`-based temp script (Windows backslash bug); `scripts/check-result.ts` now has an explicit creation step (Task 5 Step 0); `OPEN-ITEMS.md` paths made repo-relative (Task 9); the `flow-decl` block given a concrete worked example (Tasks 6, 7).

**Placeholder scan:** No "TBD"/"handle appropriately". Task 6 steps 2-3 intentionally say "fill from the grep output — do not invent relations," which is a data-entry instruction with the exact command to get the data, not a placeholder.

**Type consistency:** `CheckResult` is the shared shape (`scripts/check-result.ts`, created in Task 5 Step 0, re-exporting from `check-rules-current-core.ts`); `Relation`, `TableInfo`, `WriteSite`/`UnresolvedWrite`, `RouteActions`, `FlowDecl` are each defined once and consumed by name in later tasks. `WriteSite`/`UnresolvedWrite` are defined in Task 3 (`extract-writes.ts`) and reused by Task 3b (`extract-rpc.ts`). `checkMapDrift`, `checkFlowFacts`, `checkFlowStagedCoupling`, `checkLineCeiling`, `renderOpenItems`, `buildMap`, `extractTables`, `extractWrites`, `rpcCallSites`/`rpcWriteTargets`/`resolveRpcWrites`, `extractRoutes`, `parseRelationBlock`/`serializeRelations`, `parseFlowDecl` — names match across tasks.

**Known limitation carried forward (not a plan gap):** `extract-routes.ts` (Task 4) ships as a thin pass-through; wiring real route→action import parsing is only needed once workflow docs declare routes to check, which is Phase 2. The declaration `checkFlowFacts` route existence is validated against the page-route set (from `nav-completeness`'s `listAdminPageRoutes`, reused), which is sufficient for Phase 1's seed.
