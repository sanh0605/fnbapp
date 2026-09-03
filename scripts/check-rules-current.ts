/**
 * CLI for the rule drift checks. Logic and tests live in
 * check-rules-current-core.ts; this file only runs it and reports.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { checkRulesCurrent } from "./check-rules-current-core";

// Living runbooks join the fixed set. Read from disk rather than listed, so a
// new one is covered the day it appears -- this directory was missed three
// times in two days precisely because it lived in nobody's list.
const OPERATIONS_DIR = "docs/operations";
const operationsDocs = readdirSync(join(process.cwd(), OPERATIONS_DIR))
  .filter(name => name.endsWith(".md"))
  .map(name => `${OPERATIONS_DIR}/${name}`);

// The by-domain business rules replaced the single docs/BUSINESS-RULES.md
// (Phase 3 split). Read the directory the same way as docs/operations so a new
// domain file is covered the day it appears.
const BUSINESS_RULES_DIR = "docs/02-rules/business-rules";
const businessRulesDocs = readdirSync(join(process.cwd(), BUSINESS_RULES_DIR))
  .filter(name => name.endsWith(".md"))
  .map(name => `${BUSINESS_RULES_DIR}/${name}`);

// Documents that make claims about the present. Chronicles are deliberately
// absent: DEVELOPMENT-TRACKING.md cites hundreds of paths inside dated entries,
// many pointing at files correctly deleted since, and a chronicle entry is a
// record of what was true then -- not a claim about now. Measured 2026-08-01:
// checking it would fire on ~230 paths, essentially none of them defects.
const RULE_DOCS = [
  "CLAUDE.md",
  // docs/OPEN-ITEMS.md dropped: superseded by docs/04-operations/OPEN-ITEMS.md
  // and slated for Phase-5 deletion, so it is no longer a governed rule doc.
  ...businessRulesDocs,
  ...operationsDocs,
];

// docs/superpowers/plans/2026-08-26-undated-data-claims.md section 3 measured
// its false-positive budget (3 lines) against CLAUDE.md alone, but section 4
// scopes the check to all of RULE_DOCS. Run for real: 16 lines, not 3 --
// almost all of them in docs/BUSINESS-RULES.md and docs/operations/*.md,
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
