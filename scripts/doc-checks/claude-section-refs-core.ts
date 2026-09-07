import type { CheckResult } from "../check-result";

// CLAUDE.md gets reordered and rewritten; its section NUMBERS are not stable, so
// a pointer that carries one is dead the next time the file is trimmed. Name the
// heading instead -- that is a claim this gate can actually verify.
const NUMBERED = /CLAUDE\.md`?,?\s*(?:[Ss]ection|[Rr]ule|m[uụ]c|§)\s*\d/;
const QUOTED = /CLAUDE\.md[`,\s]+(?:m[uụ]c\s+)?"([^"]{1,60})"/g;
const ALLOW_MARKER = "claude-section-allow";

export function checkClaudeSectionRefs(
  files: { path: string; content: string }[],
  headings: Set<string>,
): CheckResult {
  const problems: string[] = [];
  for (const file of files) {
    file.content.split("\n").forEach((line, i) => {
      if (line.includes(ALLOW_MARKER)) return; // reasoned inline exemption
      if (NUMBERED.test(line)) {
        problems.push(
          `${file.path}:${i + 1} points at a CLAUDE.md section number, which does not survive a rewrite — name the section heading in quotes instead`,
        );
      }
      for (const match of line.matchAll(QUOTED)) {
        if (!headings.has(match[1])) {
          problems.push(
            `${file.path}:${i + 1} quotes CLAUDE.md heading "${match[1]}", which is not a heading in CLAUDE.md — fix it or mark the line "${ALLOW_MARKER}: <reason>"`,
          );
        }
      }
    });
  }
  return { check: "claude-section-refs", ok: problems.length === 0, problems };
}
