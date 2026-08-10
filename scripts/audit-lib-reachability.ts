/**
 * Plan E, E1 (docs/superpowers/plans/2026-08-10-repo-restructure.md).
 * Classifies every lib/ module into exactly one of four groups, by proper
 * graph reachability from the repo's real entry points -- not by counting
 * direct importers (scripts/audit-lib-dependency-map.ts's 2026-08-10 run
 * did that, and it produced a wrong answer for lib/inventory-consumption.ts
 * that this plan initially quoted as verified fact).
 *
 * Two corrections layered on top of that first attempt, both found during
 * Plan E's challenge round and both necessary for a correct answer:
 *
 * 1. Reachability must be a graph walk (BFS from roots through lib-to-lib
 *    edges too), not a one-hop importer count. A module with zero DIRECT
 *    importers from app/ can still be reachable if something app/ imports
 *    itself imports it.
 * 2. Not every edge in that walk is equal. `import type { X } from "..."`
 *    is erased at compile time -- no runtime code from the target module
 *    executes because of it. A module reachable from a root only through
 *    type-only edges has dead runtime code and live type declarations; it
 *    is neither "live" nor safely "spent" (moving it would still need its
 *    types extracted first).
 *
 * Roots (the only things this repo's runtime or mandatory tooling actually
 * invokes directly -- corrected in the same challenge round; the first
 * draft wrongly treated all of app/** and components/** as roots):
 *   - Next.js special files under app/**: page.tsx, layout.tsx, route.ts,
 *     loading.tsx, error.tsx, not-found.tsx, global-error.tsx,
 *     template.tsx, default.tsx, manifest.ts.
 *   - middleware.ts.
 *   - supabase/functions/backup-to-drive/index.ts,
 *     supabase/functions/backup-to-sheets/index.ts,
 *     supabase/functions/user-admin/index.ts -- three Edge Functions, not
 *     one (the plan's first draft named only backup-to-drive, and wrongly
 *     asserted it imports lib/backup-restore.ts -- checked directly, the
 *     only occurrence of that path in the file is a comment).
 *   - scripts/check-rules-current.ts -- the one script with actual
 *     evidence of still running (wired into .husky/pre-commit). No other
 *     script/ file qualifies as a root: "the shop still runs it" needs
 *     evidence (package.json, .husky/, documented recurring job), not a
 *     plausible filename. Checked all 31 scripts-only lib/ modules from
 *     the prior audit against package.json and .husky/ -- exactly one
 *     script, check-rules-current.ts, is wired in anywhere.
 *   - components/** and non-special files under app/** (Server Actions,
 *     regular components) are NOT roots -- they are ordinary graph nodes,
 *     reached (or not) the same way a lib/ module is, through imports from
 *     an actual root. `npx vitest run` is deliberately not a root either:
 *     a module's own test proving it still compiles proves nothing about
 *     whether the shop uses it.
 *
 * Four output groups, every module in exactly one:
 *   - live: reachable from a root via at least one all-value-edge path.
 *   - type-only: reachable from a root, but every such path crosses at
 *     least one type-only edge -- runtime code is dead, declarations are
 *     not.
 *   - spent: not reachable from a root at all, but something (scripts/,
 *     or a lib-internal chain feeding only scripts/) still imports it.
 *   - orphan: nothing imports it, from anywhere.
 *
 * Run: npx vite-node scripts/audit-lib-reachability.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "lib", "components", "scripts", "types"];
const EXCLUDE_DIR_NAMES = new Set(["node_modules", ".next", ".git"]);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isTestFile(file: string): boolean {
  return /\.test\.(ts|tsx)$/.test(file);
}

function ownTestFileOf(file: string): string | null {
  if (isTestFile(file)) return null;
  const withoutExt = file.replace(/\.(ts|tsx)$/, "");
  const ext = file.endsWith(".tsx") ? ".tsx" : ".ts";
  const candidate = `${withoutExt}.test${ext}`;
  return fs.existsSync(candidate) ? candidate : null;
}

function resolveSpecifier(spec: string, importerFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    base = path.join(ROOT, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = path.resolve(path.dirname(importerFile), spec);
  } else {
    return null;
  }
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

type EdgeKind = "value" | "type";

interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
}

// Every named specifier inside `{ ... }` individually prefixed with `type`
// makes the whole clause type-only; even one bare specifier makes the
// whole edge a value edge (TypeScript itself works this way -- a mixed
// `import { type A, B }` still executes the module for B's sake).
function namedClauseIsTypeOnly(braceContent: string): boolean {
  const specifiers = braceContent
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (specifiers.length === 0) return false; // `import {} from "x"` -- side-effect-shaped, treat as value
  return specifiers.every(s => /^type\s+/.test(s));
}

// Returns every (specifier-path, kind) edge found in one file's source.
function extractEdges(content: string, file: string): Array<{ spec: string; kind: EdgeKind }> {
  const out: Array<{ spec: string; kind: EdgeKind }> = [];

  // import/export ... from "spec" -- captures the clause between the
  // keyword and `from` so named-specifier type-ness can be checked.
  const CLAUSE_RE = /\b(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = CLAUSE_RE.exec(content))) {
    const wholeStatementType = !!m[2];
    const clause = m[3].trim();
    const spec = m[4];
    let kind: EdgeKind = "value";
    if (wholeStatementType) {
      kind = "type";
    } else if (clause === "*") {
      kind = "value"; // export * from "x" -- re-exports values too
    } else if (clause.startsWith("{") && clause.endsWith("}")) {
      const inner = clause.slice(1, -1);
      kind = namedClauseIsTypeOnly(inner) ? "type" : "value";
    } else {
      kind = "value"; // default import, namespace import, side-effect import
    }
    out.push({ spec, kind });
  }

  // require("spec") and dynamic import("spec") -- always value: both
  // execute the target module and hand back a runtime object.
  const REQUIRE_RE = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = REQUIRE_RE.exec(content))) out.push({ spec: m[1], kind: "value" });
  const DYNAMIC_RE = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = DYNAMIC_RE.exec(content))) out.push({ spec: m[1], kind: "value" });

  return out;
}

const allFiles = SCAN_DIRS.flatMap(d => walk(path.join(ROOT, d)));
const allFileSet = new Set(allFiles);
const libDir = path.join(ROOT, "lib");
const libModules = allFiles.filter(f => f.startsWith(libDir + path.sep) && !isTestFile(f));

// Build every edge in the WHOLE scanned graph -- not just edges landing in
// lib/. The BFS needs to walk through intermediate non-lib files (a
// page.tsx importing an actions.ts, which imports a lib/ module) to reach
// anything past one hop; filtering to lib/-only targets here would silence
// every edge except "root imports lib/ directly", making the graph
// disconnected before the walk even starts. lib/-only filtering happens
// later, only when reporting.
const edges: Edge[] = [];
for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const { spec, kind } of extractEdges(content, file)) {
    const resolved = resolveSpecifier(spec, file);
    if (!resolved || !allFileSet.has(resolved)) continue;
    if (file === ownTestFileOf(resolved)) continue;
    edges.push({ from: file, to: resolved, kind });
  }
}

// Collapse to worst-case-strongest per (from, to) pair: if ANY edge
// between the same two files is a value edge, the pair counts as value
// overall (multiple import statements for the same module in one file).
const pairKind = new Map<string, EdgeKind>();
for (const e of edges) {
  const key = `${e.from} ${e.to}`;
  const existing = pairKind.get(key);
  if (existing !== "value") pairKind.set(key, e.kind);
}

// ---- Roots ----
const NEXT_SPECIAL_FILES = new Set([
  "page.tsx", "layout.tsx", "route.ts", "loading.tsx", "error.tsx",
  "not-found.tsx", "global-error.tsx", "template.tsx", "default.tsx", "manifest.ts",
]);

const appDir = path.join(ROOT, "app");
const appRootFiles = walk(appDir).filter(f => NEXT_SPECIAL_FILES.has(path.basename(f)));

const edgeFunctionRoots = [
  path.join(ROOT, "supabase", "functions", "backup-to-drive", "index.ts"),
  path.join(ROOT, "supabase", "functions", "backup-to-sheets", "index.ts"),
  path.join(ROOT, "supabase", "functions", "user-admin", "index.ts"),
].filter(f => fs.existsSync(f));

const otherRoots = [
  path.join(ROOT, "middleware.ts"),
  path.join(ROOT, "scripts", "check-rules-current.ts"),
].filter(f => fs.existsSync(f));

const roots = [...appRootFiles, ...edgeFunctionRoots, ...otherRoots];

// Non-lib/ files also need edges walked (a root -> a component -> a lib/
// module), so build adjacency for the WHOLE graph (any file -> any file),
// not just lib-to-lib.
function bfs(onlyValueEdges: boolean): { reached: Set<string>; parent: Map<string, string> } {
  const reached = new Set<string>(roots);
  const parent = new Map<string, string>();
  const queue = [...roots];
  // Index edges by source for traversal.
  const bySource = new Map<string, Array<{ to: string; kind: EdgeKind }>>();
  for (const [key, kind] of pairKind) {
    const [from, to] = key.split(" ");
    if (onlyValueEdges && kind !== "value") continue;
    const list = bySource.get(from) ?? [];
    list.push({ to, kind });
    bySource.set(from, list);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const { to } of bySource.get(cur) ?? []) {
      if (!reached.has(to)) {
        reached.add(to);
        parent.set(to, cur);
        queue.push(to);
      }
    }
  }
  return { reached, parent };
}

const valueReach = bfs(true);
const anyReach = bfs(false);

function pathTo(module: string, parent: Map<string, string>): string {
  const chain: string[] = [module];
  let cur = module;
  while (parent.has(cur)) {
    cur = parent.get(cur)!;
    chain.push(cur);
  }
  return chain.reverse().map(f => path.relative(ROOT, f).split(path.sep).join("/")).join(" -> ");
}

// ---- Classify ----
interface Row {
  module: string;
  group: "live" | "type-only" | "spent" | "orphan";
  path: string | null;
  importerCount: number;
}

// importerCount for spent/orphan distinction: any real importer at all
// (from the original wide scan, not just roots).
const importerCountByModule = new Map<string, number>();
for (const m of libModules) {
  const count = [...pairKind.keys()].filter(k => k.endsWith(" " + m)).length;
  importerCountByModule.set(m, count);
}

const rows: Row[] = libModules.map(m => {
  const rel = path.relative(ROOT, m).split(path.sep).join("/");
  if (valueReach.reached.has(m)) {
    return { module: rel, group: "live", path: pathTo(m, valueReach.parent), importerCount: importerCountByModule.get(m)! };
  }
  if (anyReach.reached.has(m)) {
    return { module: rel, group: "type-only", path: pathTo(m, anyReach.parent), importerCount: importerCountByModule.get(m)! };
  }
  const count = importerCountByModule.get(m)!;
  if (count === 0) {
    return { module: rel, group: "orphan", path: null, importerCount: 0 };
  }
  return { module: rel, group: "spent", path: null, importerCount: count };
});

rows.sort((a, b) => a.module.localeCompare(b.module));

console.log(`Roots: ${roots.length} (${appRootFiles.length} app/ special files, ${edgeFunctionRoots.length} edge functions, ${otherRoots.length} other)`);
for (const r of otherRoots) console.log(`  ${path.relative(ROOT, r)}`);
for (const r of edgeFunctionRoots) console.log(`  ${path.relative(ROOT, r)}`);

const counts = { live: 0, "type-only": 0, spent: 0, orphan: 0 };
for (const r of rows) counts[r.group]++;
console.log(`\nlive=${counts.live} type-only=${counts["type-only"]} spent=${counts.spent} orphan=${counts.orphan} total=${rows.length}`);

console.log("\n" + JSON.stringify(rows, null, 1));
