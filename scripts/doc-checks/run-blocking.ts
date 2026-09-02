/**
 * The single entry the pre-commit hook calls for the documentation gates.
 *
 * It regenerates the machine map from live source, then runs four blocking
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
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseRelationBlock, serializeRelations } from "../doc-map/relation-block";
import { checkMapDrift } from "./map-drift-core";
import { parseFlowDecl, checkFlowFacts, checkFlowStagedCoupling, type FlowDecl } from "./flow-doc-core";
import { checkLineCeiling } from "./line-ceiling-core";
import { listAdminPageRoutes } from "../../lib/nav-completeness";
import type { CheckResult } from "../check-result";

const root = process.cwd();

function toRepoPath(fullPath: string): string {
  return relative(root, fullPath).split(sep).join("/");
}

function walk(dir: string, hit: (fullPath: string) => void): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
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

const routes = new Set(listAdminPageRoutes(root));

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

// Every BR-XXX-NNN code declared in the rules document.
const brCodes = new Set<string>();
const rulesText = readFileSync(join(root, "docs/BUSINESS-RULES.md"), "utf8");
for (const m of rulesText.matchAll(/BR-[A-Z]+-\d+/g)) brCodes.add(m[0]);

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
// spec section 3.3 forbids); docs/BUSINESS-RULES.md is exempt until the Phase 3
// split lands -- kept in lockstep with line-ceiling.ts.
const EXEMPT = new Set(["CLAUDE.md", "docs/BUSINESS-RULES.md"]);

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
