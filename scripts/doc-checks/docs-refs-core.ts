import type { CheckResult } from "../check-result";

// Any docs/ path token, plus root-level doc filenames removed in the reset.
const DOCS_TOKEN = /docs\/[A-Za-z0-9._/-]+\.(?:md|json|ts|tsx)/g;
const ROOT_DOC_TOKEN = /\b(?:DEVELOPMENT-TRACKING|CONTEXT|ARCHITECTURE)\.md\b/g;
const ALLOW_MARKER = "docs-ref-allow";

export function checkDocsRefs(
  files: { path: string; content: string }[],
  exists: (repoPath: string) => boolean,
): CheckResult {
  const problems: string[] = [];
  for (const file of files) {
    file.content.split("\n").forEach((line, i) => {
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
