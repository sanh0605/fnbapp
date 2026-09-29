import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "./nav-items";

// Spec 2026-09-29-menu-va-khuon-trang-design.md section 2: tapping a menu
// item lands on a page titled with the same words.
function screenSources(routeDir: string): string {
  const own = readdirSync(routeDir).filter(f => f.endsWith(".tsx") && !f.endsWith(".test.tsx")).map(f => join(routeDir, f));
  const componentsDir = join(routeDir, "components");
  const nested = existsSync(componentsDir) && statSync(componentsDir).isDirectory()
    ? readdirSync(componentsDir).filter(f => f.endsWith(".tsx") && !f.endsWith(".test.tsx")).map(f => join(componentsDir, f))
    : [];
  return [...own, ...nested].map(f => readFileSync(f, "utf8")).join("\n");
}

const links = NAV_GROUPS.flatMap(g => (g.href ? [{ name: g.name, href: g.href }] : g.children ?? []));

describe("page headings match the menu", () => {
  const activeLinks = links.filter(l => l.href !== "/admin/inventory/purchase-orders");
  it.each(activeLinks)("$href is titled \"$name\"", ({ name, href }) => {
    const dir = join(process.cwd(), "app", ...href.split("/").filter(Boolean));
    const src = screenSources(dir);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const heading = new RegExp(`<h1[^>]*>\\s*${escaped}\\s*</h1>|title="${escaped}"`);
    expect(src).toMatch(heading);
  });

  // green in Task 8
  it.skip("/admin/inventory/purchase-orders is titled \"Phiếu nhập\"", () => {});
});
