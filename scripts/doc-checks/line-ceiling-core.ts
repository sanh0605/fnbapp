import type { CheckResult } from "../check-result";

export function checkLineCeiling(
  files: { path: string; lineCount: number }[],
  ceiling: number,
  exempt: Set<string>,
): CheckResult {
  const problems = files
    .filter(f => !exempt.has(f.path) && f.lineCount > ceiling)
    .map(f => `${f.path} is ${f.lineCount} lines, over the ${ceiling}-line ceiling — split by concern`);
  return { check: "line-ceiling", ok: problems.length === 0, problems };
}
