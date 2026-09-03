import type { CheckResult } from "../check-result";

export function checkRouteCoverage(
  routes: string[],
  coveredRoutes: Set<string>,
  isRedirectOnly: (route: string) => boolean,
): CheckResult {
  const problems = routes
    .filter(r => !coveredRoutes.has(r) && !isRedirectOnly(r))
    .map(r => `${r} is a page route with no flow doc — add it to a docs/03-workflows/*.md routes: block, or (if it is a redirect) it is exempt automatically`);
  return { check: "route-coverage", ok: problems.length === 0, problems };
}
