import type { CheckResult } from "../check-result";

const ALLOW = "orphan-allow";

export function checkOrphanModules(
  modules: { path: string; content: string }[],
  imported: Set<string>,
): CheckResult {
  const problems = modules
    .filter(m => !imported.has(m.path) && !m.content.includes(ALLOW))
    .map(m => `${m.path} is a lib module imported by nothing but (at most) its own test — delete it or mark it "${ALLOW}: <reason>"`);
  return { check: "orphan-modules", ok: problems.length === 0, problems };
}
