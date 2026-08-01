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
