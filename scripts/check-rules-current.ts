/**
 * CLI for the rule drift checks. Logic and tests live in
 * check-rules-current-core.ts; this file only runs it and reports.
 */
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { checkRulesCurrent } from "./check-rules-current-core";

// Collect every *.md under a directory tree, returned as repo-root-relative
// paths with forward slashes. Read from disk rather than listed, so a new file
// is covered the day it appears -- the governed doc set was missed this way
// before, which is how SYSTEM-OVERVIEW.md carried three dead links unnoticed.
// Guarded with existsSync so a directory removed by a future phase does not
// throw the whole gate.
function collectMarkdown(dir: string): string[] {
  const abs = join(process.cwd(), dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const child = join(abs, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMarkdown(relative(process.cwd(), child).split("\\").join("/")));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(relative(process.cwd(), child).split("\\").join("/"));
    }
  }
  return out;
}

// The whole governed doc set makes claims about the present, so every one of
// these files is checked for dead links. docs/generated/ (machine-generated,
// regenerated on demand) and docs/superpowers/ (process artifacts and plans
// that intentionally cross-reference each other) are deliberately excluded.
// Chronicles are also absent: a dated tracking log cites hundreds of paths
// inside dated entries, many pointing at files correctly deleted since, and a
// chronicle entry is a record of what was true then -- not a claim about now.
const GOVERNED_DOC_DIRS = [
  "docs/01-system",
  "docs/02-rules", // recursive: includes GLOSSARY.md and business-rules/
  "docs/03-workflows",
  "docs/04-operations",
];

const RULE_DOCS = [
  "CLAUDE.md",
  "README.md",
  ...GOVERNED_DOC_DIRS.flatMap(collectMarkdown),
];

// section 3 measured
// its false-positive budget (3 lines) against CLAUDE.md alone, but section 4
// scopes the check to all of RULE_DOCS. Run for real: 16 lines, not 3 --
// almost all of them in the rules documents and docs/operations/*.md,
// neither of which the measurement looked at. Two real patterns account for
// most of them and were not in the original three: a runbook's own pass/fail
// thresholds ("Stop if drift > 5d/order" in orders-v2-cutover.md), and a
// figure whose canonical date sits in an earlier paragraph the window
// cannot reach (BR-COGS-006's 7,4% is dated where it is first stated, cited
// undated later in the same document).
//
// The plan's own instruction for exactly this case: "if it is worse than
// measured, say so and stop rather than shipping a noisy gate people learn
// to ignore." Marking 16 lines unilaterally to force a clean gate is the
// "tuning until it passes" the plan explicitly warns against -- five times
// the measured budget is a scope decision (all of RULE_DOCS vs. CLAUDE.md
// alone; whether runbook thresholds belong in a "data claim" check at all),
// not a false-positive count to silently absorb. So this check runs and
// reports, same as the other three, but does not fail the gate until that
// scope question is settled -- advisory, not blocking, until then.
const ADVISORY_CHECKS = new Set(["undated-data-claims"]);

const results = checkRulesCurrent(RULE_DOCS, process.cwd());
let failed = false;
for (const result of results) {
  const advisory = ADVISORY_CHECKS.has(result.check);
  if (result.ok) {
    console.log(`[rules] PASS ${result.check}`);
    continue;
  }
  if (advisory) {
    console.warn(`[rules] WARN ${result.check} (advisory, not blocking)`);
  } else {
    failed = true;
    console.error(`[rules] FAIL ${result.check}`);
  }
  result.problems.forEach(problem => console.error(`  ${problem}`));
}
if (failed) {
  console.error("\n[rules] A rule document disagrees with the repository.");
  // exitCode, not exit(): lets stdout flush before the process ends.
  process.exitCode = 1;
}
