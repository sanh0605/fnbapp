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

// docs/superpowers/plans/2026-08-26-undated-data-claims.md. CLAUDE.md's own
// Rule 0 (top of file): a claim is only true at the moment it was written --
// a date next to a number is what lets a reader judge how stale it might be.
// A number with a data unit and no date nearby is exactly the shape of the
// defect this exists to catch: section 7 once carried "0d" (stock_issues
// giá vốn) with no date, true on 2026-08-07 and read as current fact until
// 2026-08-26.
//
// Two attachment styles appear in this document's own prose. "d" (dong) and
// "%" glue directly onto the number with no space -- "0d", "~95%" -- while
// every other unit is its own separate word with a required space before it
// -- "52 mon", "2.376 dong". Vietnamese does not fuse syllables into a
// single unspaced token the way English compounds sometimes do, so
// requiring the space for these is safe, not just a style guess.
const DIRECT_UNITS = ["đ", "%"];
const SPACED_UNITS = ["dòng", "đơn", "món", "file", "bảng", "phép kiểm", "MB"];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NUMBER = "[0-9][0-9.,~]*";

// (?!\p{L}) after a direct unit is load-bearing, not decorative: measuring
// this exact file by hand, a naive "digit, optional space, d" pattern read
// the date fragment "24/08 da" as "08 d" (8 dong) -- "da" (da roi, already)
// happens to start with the same letter as the currency unit. Requiring no
// letter follow "d" rules that out while still matching the real "0d"/
// "174.000d" currency notation this document actually uses.
const DATA_CLAIM_PATTERN = new RegExp(
  `(?:${NUMBER}(?:${DIRECT_UNITS.map(escapeRegExp).join("|")})(?!\\p{L}))` +
  `|(?:${NUMBER}[ \\t]+(?:${SPACED_UNITS.map(escapeRegExp).join("|")})\\b)`,
  "u",
);

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}/;

// "A small window of lines" (the plan's own words, not quantified further).
// 2 is a judgment call: wide enough to catch a date opening a short
// paragraph, tight enough that a date several sentences away in a different
// point does not silently cover an unrelated claim.
const NEARBY_WINDOW = 2;

// The plan requires an escape hatch or false positives get "fixed" by
// deleting useful sentences. Deliberately visible in raw markdown (so a
// reader sees it was a deliberate choice) and invisible when rendered as
// HTML (so it does not clutter a rendered view) -- ordinary HTML comment
// semantics, not a bespoke convention.
const ESCAPE_MARKER = "<!-- undated-ok -->";

function checkUndatedDataClaims(docs: string[], repoRoot: string): CheckResult {
  const problems: string[] = [];
  for (const doc of docs) {
    const docPath = join(repoRoot, doc);
    if (!existsSync(docPath)) continue;
    const lines = readFileSync(docPath, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!DATA_CLAIM_PATTERN.test(line)) return;
      if (line.includes(ESCAPE_MARKER)) return;
      const windowStart = Math.max(0, index - NEARBY_WINDOW);
      const windowEnd = Math.min(lines.length - 1, index + NEARBY_WINDOW);
      const nearby = lines.slice(windowStart, windowEnd + 1).join("\n");
      if (DATE_PATTERN.test(nearby)) return;
      problems.push(`${doc}:${index + 1} carries a number with a data unit and no date nearby: ${line.trim()}`);
    });
  }
  return { check: "undated-data-claims", ok: problems.length === 0, problems };
}

export function checkRulesCurrent(docs: string[], repoRoot: string): CheckResult[] {
  return [
    checkPathsExist(docs, repoRoot),
    checkNoRetiredAgents(docs, repoRoot),
    checkBusinessRuleTests(docs, repoRoot),
    checkUndatedDataClaims(docs, repoRoot),
  ];
}
