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
  it.each(links)("$href is titled \"$name\"", ({ name, href }) => {
    const dir = join(process.cwd(), "app", ...href.split("/").filter(Boolean));
    const src = screenSources(dir);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const heading = new RegExp(`<h1[^>]*>\\s*${escaped}\\s*</h1>|title="${escaped}"`);
    expect(src).toMatch(heading);
  });

  it.each(links)('$href loading skeleton shows "$name"', ({ name, href }) => {
    const dir = join(process.cwd(), "app", ...href.split("/").filter(Boolean));
    const loadingPath = join(dir, "loading.tsx");
    if (!existsSync(loadingPath)) {
      return;
    }

    const src = readFileSync(loadingPath, "utf8");

    const titles = Array.from(src.matchAll(/(?<![\w-])title="([^"]*)"/g), m => m[1]);
    for (const title of titles) {
      expect(title).toBe(name);
    }

    const h1s = Array.from(src.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g), m => m[1].trim());
    for (const h1 of h1s) {
      expect(h1).toBe(name);
    }
  });
});
