/**
 * The single entry the pre-commit hook calls for the documentation gates.
 *
 * It regenerates the machine map from live source, then runs seven blocking
 * checks and reports each as `[docs] PASS/FAIL <check>` (same shape as
 * check-rules-current.ts). Any failure sets process.exitCode = 1.
 *
 * Checks:
 *  - map-drift (SCOPED to covered flows): the generated map has ~50 write
 *    relations; the hand SYSTEM-MAP.md is a Phase-1 seed covering one flow.
 *    Comparing the full generated map against the seed would fail every commit
 *    until Phase 2 documents all flows. So drift is checked only for generated
 *    relations whose `from` file is declared by some workflow doc. Coverage
 *    grows automatically as Phase 2 adds flow docs -- no code change needed.
 *  - flow-doc-facts: each flow doc's declaration block matches reality.
 *  - flow-doc-staged: a staged source file forces its flow doc to be staged too.
 *  - line-ceiling: governed docs stay under the 200-line ceiling.
 *  - docs-refs: every docs/... token in app/, lib/, components/, scripts/
 *    must point at a file that still exists, or carry an
 *    inline docs-ref-allow marker. No dead documentation pointer in code.
 *  - route-coverage: every page route from listAllPageRoutes must be declared
 *    in some flow doc's routes: block, unless its page.tsx is a pure redirect
 *    (detected from source -- no hand-maintained exempt list). Catches a new
 *    screen shipped with no flow doc.
 *  - orphan-modules: every lib/*.ts module (excluding *.test.ts) must be
 *    imported by some non-test file under app/, lib/, components/, scripts/,
 *    or supabase/, or carry an inline orphan-allow marker. A module reached
 *    only by its own test reds the build -- the machine check for "no dead
 *    points" in code.
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseRelationBlock, serializeRelations } from "../doc-map/relation-block";
import { checkMapDrift } from "./map-drift-core";
import { parseFlowDecl, checkFlowFacts, checkFlowStagedCoupling, type FlowDecl } from "./flow-doc-core";
import { checkLineCeiling } from "./line-ceiling-core";
import { checkDocsRefs } from "./docs-refs-core";
import { checkRouteCoverage } from "./route-coverage-core";
import { checkOrphanModules } from "./orphan-modules-core";
import { listAllPageRoutes } from "../../lib/nav-completeness";
import type { CheckResult } from "../check-result";

const root = process.cwd();

function toRepoPath(fullPath: string): string {
  return relative(root, fullPath).split(sep).join("/");
}

function walk(dir: string, hit: (fullPath: string) => void): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    // orphan-modules scans supabase/, which vendors a Deno function's
    // node_modules -- skip it everywhere so no walk pays that cost.
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, hit);
    else hit(full);
  }
}

// (a) Regenerate the map so docs/generated/system-map.md is fresh before any
// comparison. Inherit stdio so the generator's own count line stays visible.
execSync("npx vite-node scripts/system-map/generate.ts", { cwd: root, stdio: "inherit" });

// (b) Build the worlds from real sources.
const generatedMd = readFileSync(join(root, "docs/generated/system-map.md"), "utf8");
const handMd = readFileSync(join(root, "docs/01-system/SYSTEM-MAP.md"), "utf8");

const workflowsDir = join(root, "docs/03-workflows");
const decls: FlowDecl[] = [];
if (existsSync(workflowsDir)) {
  for (const name of readdirSync(workflowsDir)) {
    if (!name.endsWith(".md")) continue;
    const docPath = `docs/03-workflows/${name}`;
    const decl = parseFlowDecl(readFileSync(join(workflowsDir, name), "utf8"), docPath);
    if (decl) decls.push(decl);
  }
}

const coveredFiles = new Set<string>();
for (const decl of decls) for (const f of decl.files) coveredFiles.add(f);

const routes = new Set(listAllPageRoutes(root));

// Every .ts/.tsx path under app/ and lib/, repo-relative -- the file-existence
// world for the declaration check.
const files = new Set<string>();
for (const base of ["app", "lib"]) {
  walk(join(root, base), p => {
    if (p.endsWith(".ts") || p.endsWith(".tsx")) files.add(toRepoPath(p));
  });
}

// file -> tables it writes, from the generated map's write relations.
const writesByFile = new Map<string, Set<string>>();
for (const rel of parseRelationBlock(generatedMd)) {
  if (rel.kind !== "write") continue;
  const set = writesByFile.get(rel.from) ?? new Set<string>();
  set.add(rel.to);
  writesByFile.set(rel.from, set);
}

// Every BR-XXX-NNN code declared in the rules documents. The former single
// business-rules file was split by domain (Phase 3), so read and
// concatenate every file under docs/02-rules/business-rules.
const brCodes = new Set<string>();
const businessRulesDir = join(root, "docs/02-rules/business-rules");
for (const name of readdirSync(businessRulesDir)) {
  if (!name.endsWith(".md")) continue;
  const rulesText = readFileSync(join(businessRulesDir, name), "utf8");
  for (const m of rulesText.matchAll(/BR-[A-Z]+-\d+/g)) brCodes.add(m[0]);
}

// (c) Run the checks.
const results: CheckResult[] = [];

// map-drift, scoped to covered flows.
const coveredRelations = parseRelationBlock(generatedMd).filter(r => coveredFiles.has(r.from));
const coveredGeneratedMd = serializeRelations(coveredRelations);
results.push(checkMapDrift(coveredGeneratedMd, handMd));

// flow-doc-facts, merged across every declaration.
const factProblems: string[] = [];
for (const decl of decls) {
  const r = checkFlowFacts(decl, { routes, files, writesByFile, brCodes });
  factProblems.push(...r.problems);
}
results.push({ check: "flow-doc-facts", ok: factProblems.length === 0, problems: factProblems });

// flow-doc-staged, against the currently staged paths.
const stagedPaths = execSync("git diff --cached --name-only", { cwd: root })
  .toString()
  .split("\n")
  .filter(Boolean);
results.push(checkFlowStagedCoupling(decls, stagedPaths));

// line-ceiling: same allowlist scan as scripts/doc-checks/line-ceiling.ts.
const CEILING = 200;
const GOVERNED_DIRS = ["docs/01-system", "docs/02-rules", "docs/03-workflows", "docs/04-operations"];
const GOVERNED_ROOT_FILES = ["CLAUDE.md", "README.md"];
// CLAUDE.md is the auto-loaded session file (splitting it is the anti-pattern
// spec section 3.3 forbids). The former business-rules file's exemption ended
// with the Phase 3 by-domain split -- kept in lockstep with line-ceiling.ts.
const EXEMPT = new Set(["CLAUDE.md"]);

function countLines(content: string): number {
  if (content.length === 0) return 0;
  const newlines = content.split("\n").length - 1;
  return content.endsWith("\n") ? newlines : newlines + 1;
}

const governedTargets: string[] = [];
for (const dir of GOVERNED_DIRS) {
  walk(join(root, dir), p => { if (p.endsWith(".md")) governedTargets.push(p); });
}
for (const file of GOVERNED_ROOT_FILES) {
  const full = join(root, file);
  if (existsSync(full)) governedTargets.push(full);
}
const governedFiles = governedTargets.map(full => ({
  path: toRepoPath(full),
  lineCount: countLines(readFileSync(full, "utf8")),
}));
results.push(checkLineCeiling(governedFiles, CEILING, EXEMPT));

// docs-refs: every docs/... token in code must point at a surviving file.
// Scans app/, lib/, components/, scripts/ -- everywhere a comment or a
// string literal could cite a doc.
const docsRefFiles: { path: string; content: string }[] = [];
for (const base of ["app", "lib", "components", "scripts"]) {
  walk(join(root, base), p => {
    const repoPath = toRepoPath(p);
    if (!p.endsWith(".ts") && !p.endsWith(".tsx") && !p.endsWith(".js")) return;
    docsRefFiles.push({ path: repoPath, content: readFileSync(p, "utf8") });
  });
}
results.push(checkDocsRefs(docsRefFiles, token => existsSync(join(root, token))));

// route-coverage: every page route must be declared in some flow doc's
// routes: block, unless its page.tsx is a pure redirect (detected from
// source, not a hand-maintained exempt list).
const coveredRoutes = new Set<string>();
for (const decl of decls) for (const r of decl.routes) coveredRoutes.add(r);

const allRoutes = listAllPageRoutes(root);

// route -> page.tsx file, built the same way listAllPageRoutes walks app/.
const routeToPageFile = new Map<string, string>();
walk(join(root, "app"), p => {
  if (!p.endsWith("page.tsx")) return;
  const route = toRepoPath(p).replace(/^app/, "").replace(/\/page\.tsx$/, "") || "/";
  routeToPageFile.set(route, p);
});

function isRedirectOnly(route: string): boolean {
  const file = routeToPageFile.get(route);
  if (!file) return false;
  const source = readFileSync(file, "utf8");
  const hasRedirect = source.includes("redirect(");
  const hasJsxReturn = source.includes("return (") || source.includes("return <");
  return hasRedirect && !hasJsxReturn;
}

results.push(checkRouteCoverage(allRoutes, coveredRoutes, isRedirectOnly));

// orphan-modules: every lib/*.ts module must be reachable from a non-test
// file (import/require/dynamic import()/vi.mock), or carry an inline
// orphan-allow marker. Resolution handles the "@/" alias, relative ./ and
// ../ specifiers, extension-less specifiers, and index.ts re-exports --
// each resolved against the real filesystem so a false positive means the
// resolver is wrong, not that the module is actually dead.
const IMPORT_SPECIFIER = /(?:\bfrom\s+|\bimport\(\s*|\brequire\(\s*|vi\.mock\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

function dirOf(repoPath: string): string {
  const idx = repoPath.lastIndexOf("/");
  return idx === -1 ? "" : repoPath.slice(0, idx);
}

function resolveRelativeSpecifier(fromDir: string, spec: string): string {
  const parts = fromDir.split("/").filter(Boolean);
  for (const seg of spec.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

// Resolve one import specifier seen inside `fromFile` to a repo-relative
// lib/*.ts path, or null if it is external or does not land in lib/.
function resolveToLibModule(fromFile: string, spec: string): string | null {
  let raw: string;
  if (spec.startsWith("@/")) {
    raw = spec.slice(2);
  } else if (spec.startsWith(".")) {
    raw = resolveRelativeSpecifier(dirOf(fromFile), spec);
  } else {
    return null; // external package specifier, not a repo-local module
  }
  if (!raw.startsWith("lib/")) return null;
  for (const candidate of [raw, `${raw}.ts`, `${raw}.tsx`, `${raw}/index.ts`, `${raw}/index.tsx`]) {
    if (existsSync(join(root, candidate))) return candidate;
  }
  return null;
}

const libModules: { path: string; content: string }[] = [];
walk(join(root, "lib"), p => {
  if (!p.endsWith(".ts") || p.endsWith(".test.ts")) return;
  libModules.push({ path: toRepoPath(p), content: readFileSync(p, "utf8") });
});

const importedModules = new Set<string>();
for (const base of ["app", "lib", "components", "scripts", "supabase"]) {
  walk(join(root, base), p => {
    if (!p.endsWith(".ts") && !p.endsWith(".tsx")) return;
    const repoPath = toRepoPath(p);
    if (repoPath.endsWith(".test.ts") || repoPath.endsWith(".test.tsx")) return;
    const content = readFileSync(p, "utf8");
    for (const m of content.matchAll(IMPORT_SPECIFIER)) {
      const resolved = resolveToLibModule(repoPath, m[1]);
      if (resolved) importedModules.add(resolved);
    }
  });
}

results.push(checkOrphanModules(libModules, importedModules));

// Report and set the exit code.
let failed = false;
for (const result of results) {
  if (result.ok) {
    console.log(`[docs] PASS ${result.check}`);
    continue;
  }
  failed = true;
  console.error(`[docs] FAIL ${result.check}`);
  result.problems.forEach(problem => console.error(`  ${problem}`));
}
if (failed) {
  console.error("\n[docs] A document disagrees with the code.");
  // exitCode, not exit(): lets stdout flush before the process ends.
  process.exitCode = 1;
}
