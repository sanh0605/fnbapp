import type { CheckResult } from "../check-result";

// Any docs/ path token, plus root-level doc filenames removed in the reset.
const DOCS_TOKEN = /docs\/[A-Za-z0-9._/-]+\.(?:md|json|ts|tsx)/g;
const ROOT_DOC_TOKEN = /\b(?:DEVELOPMENT-TRACKING|CONTEXT|ARCHITECTURE)\.md\b/g;
const ALLOW_MARKER = "docs-ref-allow";

// A long path wrapped across two comment lines is still one reference. Lines
// that end mid-path -- on a hyphen or a slash -- carry the next line's comment
// body appended before matching, so the wrap cannot hide a dead pointer.
const CONTINUATION_PREFIX = /^\s*(?:\/\/|\*|#)?\s*/;

function joinWrappedLines(lines: string[]): string[] {
  return lines.map((line, i) => {
    let joined = line.replace(/\s+$/, "");
    let next = i;
    while (/[-/]$/.test(joined) && next + 1 < lines.length) {
      next += 1;
      joined += lines[next].replace(CONTINUATION_PREFIX, "").replace(/\s+$/, "");
    }
    return joined;
  });
}

export function checkDocsRefs(
  files: { path: string; content: string }[],
  exists: (repoPath: string) => boolean,
): CheckResult {
  const problems: string[] = [];
  for (const file of files) {
    joinWrappedLines(file.content.split("\n")).forEach((line, i) => {
      if (line.includes(ALLOW_MARKER)) return; // reasoned inline exemption
      const tokens = [...line.matchAll(DOCS_TOKEN), ...line.matchAll(ROOT_DOC_TOKEN)].map(m => m[0]);
      for (const token of tokens) {
        if (!exists(token)) {
          problems.push(`${file.path}:${i + 1} points at ${token}, which no longer exists — fix it or mark the line "${ALLOW_MARKER}: <reason>"`);
        }
      }
    });
  }
  return { check: "docs-refs", ok: problems.length === 0, problems };
}
