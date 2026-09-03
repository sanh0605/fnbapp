// The guard itself, run against the real repository tree.
// section 3.
//
// This is deliberately a thin wrapper: the decision logic and both failure
// modes are unit-tested with synthetic fixtures in lib/nav-completeness.test.ts.
// This file only wires that logic to the real filesystem and the real
// layout.tsx, so a future page added without a nav entry (or a nav entry
// added without a page) fails an actual CLAUDE.md section 9 gate
// (`npx vitest run`), not just a fixture.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkNavCompleteness, extractNavHrefs, listAdminPageRoutes } from "@/lib/nav-completeness";
import { NAV_ALLOWLIST } from "./nav-allowlist";

describe("app/admin nav completeness", () => {
  it("every static page is reachable from navItems or the allowlist, and every nav entry has a page", () => {
    const repoRoot = process.cwd();
    const pageRoutes = listAdminPageRoutes(repoRoot);
    const layoutSource = readFileSync(join(repoRoot, "app", "admin", "layout.tsx"), "utf8");
    const navHrefs = extractNavHrefs(layoutSource);

    const result = checkNavCompleteness(pageRoutes, navHrefs, NAV_ALLOWLIST);

    if (!result.ok) {
      const lines: string[] = [];
      if (result.unreachablePages.length) {
        lines.push(
          "Pages with no nav entry and no allowlist entry (add a navItems link or a reason in app/admin/nav-allowlist.ts):",
          ...result.unreachablePages.map(r => `  ${r}`),
        );
      }
      if (result.danglingNavEntries.length) {
        lines.push(
          "Nav entries pointing at a route with no page.tsx:",
          ...result.danglingNavEntries.map(r => `  ${r}`),
        );
      }
      throw new Error(lines.join("\n"));
    }

    expect(result.ok).toBe(true);
  });
});
