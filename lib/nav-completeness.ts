// Checks that every static page under app/admin has a way in: either a
// navItems entry in app/admin/layout.tsx, or an explicit allowlist entry
// with a reason.
//
// docs/superpowers/plans/2026-08-25-outlet-screen-and-nav-guard.md section 3:
// "nothing mechanical checks whether a screen the plan promised exists and
// is reachable, so the only detector is the owner." This is that check.
// Not folded into scripts/check-rules-current.ts -- that script verifies a
// *documentation file's claims* against reality over a fixed list of prose
// docs; this checks a structural property of the app itself, unrelated to
// any doc's claims. It runs as an ordinary vitest test instead
// (app/admin/nav-guard.test.ts), which is already a CLAUDE.md section 9
// gate, so no coverage is lost either way.
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface AllowlistEntry {
  route: string;
  reason: string;
}

export interface NavCompletenessResult {
  ok: boolean;
  // A page exists but is reachable through neither navItems nor the allowlist.
  unreachablePages: string[];
  // A navItems href points at a route with no page.tsx behind it.
  danglingNavEntries: string[];
}

// The decision logic, pure and independently testable with synthetic
// fixtures -- see lib/nav-completeness.test.ts for both failure modes
// exercised directly, since the real filesystem currently has zero
// dangling-nav-entry cases and that half would otherwise never run.
export function checkNavCompleteness(
  pageRoutes: string[],
  navHrefs: string[],
  allowlist: AllowlistEntry[],
): NavCompletenessResult {
  const navHrefSet = new Set(navHrefs);
  const allowedSet = new Set(allowlist.map(a => a.route));
  const pageRouteSet = new Set(pageRoutes);

  const unreachablePages = pageRoutes.filter(
    route => !navHrefSet.has(route) && !allowedSet.has(route),
  );
  const danglingNavEntries = navHrefs.filter(href => !pageRouteSet.has(href));

  return {
    ok: unreachablePages.length === 0 && danglingNavEntries.length === 0,
    unreachablePages,
    danglingNavEntries,
  };
}

// Walks app/admin/**/page.tsx and returns each one as its URL route,
// skipping any subtree under a dynamic segment ([id]) -- a route requiring
// a param has no single nav href to point at it; it is reached through
// whatever list page led to it instead, per the plan's own scope.
export function listAdminPageRoutes(repoRoot: string): string[] {
  const adminDir = join(repoRoot, "app", "admin");
  const appDir = join(repoRoot, "app");
  const routes: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith("[")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry === "page.tsx") {
        const rel = relative(appDir, dir).split(sep).join("/");
        routes.push(`/${rel}`);
      }
    }
  }

  walk(adminDir);
  return routes;
}

// Extracts every `href: "/admin/..."` literal out of layout.tsx's navItems
// array. navItems is a plain array built inside the component function, not
// a module-level export, so this reads the source text rather than
// importing it -- the same text-extraction approach
// scripts/check-rules-current-core.ts already uses for backticked paths.
const HREF_PATTERN = /href:\s*"(\/admin[^"]*)"/g;

export function extractNavHrefs(layoutSource: string): string[] {
  return Array.from(layoutSource.matchAll(HREF_PATTERN)).map(m => m[1]);
}
