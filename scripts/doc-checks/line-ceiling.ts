/**
 * CLI for the 200-line documentation ceiling. Logic and tests live in
 * line-ceiling-core.ts; this file only gathers the governed doc set from disk
 * and reports.
 *
 * Scope by ALLOWLIST, not blocklist: the ceiling governs the new doc set only,
 * not history/process artifacts (CLAUDE.md section 11) under docs/superpowers/,
 * docs/audits/, docs/handoffs/, nor the machine output in docs/generated/. An
 * allowlist is also forward-safe -- a new plan file under docs/superpowers/ can
 * never trip the gate.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { checkLineCeiling } from "./line-ceiling-core";

const root = process.cwd();
const CEILING = 200;

// The four governed doc-set folders (scanned recursively). Some arrive in later
// phases -- 02-rules and 04-operations are empty or absent today -- so a missing
// folder is skipped, not an error.
const GOVERNED_DIRS = [
  "docs/01-system",
  "docs/02-rules",
  "docs/03-workflows",
  "docs/04-operations",
];

// The two root docs that are part of the governed set.
const GOVERNED_ROOT_FILES = ["CLAUDE.md", "README.md"];

// CLAUDE.md: the one file the machine auto-loads every session; splitting it
// into must-open files is the exact anti-pattern spec section 1b forbids (section 3.3).
// docs/BUSINESS-RULES.md was exempt until its Phase 3 by-domain split; now that
// docs/02-rules/business-rules/ exists, each domain file is ceiling-checked and
// the exemption is gone.
const EXEMPT = new Set(["CLAUDE.md"]);

function toRepoPath(fullPath: string): string {
  return relative(root, fullPath).split(sep).join("/");
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  const newlines = content.split("\n").length - 1;
  // wc -l semantics: count newline characters, plus one if the final line is
  // unterminated.
  return content.endsWith("\n") ? newlines : newlines + 1;
}

function collectMarkdown(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectMarkdown(full, out);
    } else if (full.endsWith(".md")) {
      out.push(full);
    }
  }
}

const targets: string[] = [];
for (const dir of GOVERNED_DIRS) {
  const full = join(root, dir);
  if (existsSync(full)) collectMarkdown(full, targets);
}
for (const file of GOVERNED_ROOT_FILES) {
  const full = join(root, file);
  if (existsSync(full)) targets.push(full);
}

const files = targets.map(full => ({
  path: toRepoPath(full),
  lineCount: countLines(readFileSync(full, "utf8")),
}));

const result = checkLineCeiling(files, CEILING, EXEMPT);
if (result.ok) {
  console.log(`[line-ceiling] PASS (${files.length} governed docs, ceiling ${CEILING})`);
} else {
  console.error(`[line-ceiling] FAIL ${result.check}`);
  result.problems.forEach(problem => console.error(`  ${problem}`));
  // exitCode, not exit(): lets stdout flush before the process ends.
  process.exitCode = 1;
}
