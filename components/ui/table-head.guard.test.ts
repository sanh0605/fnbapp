import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// TableHead (components/ui/Table.tsx) already draws <thead><tr>. A TableRow
// put inside it nests a row in a row: the browser lays the titles out as one
// cell and the columns no longer line up with the body (Khuyến mãi detail,
// owner screenshot 2026-10-10). Its children are TableHeaderCells, directly.

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) return [];
    return [full];
  });
}

const root = process.cwd();
const files = ["app", "components"]
  .flatMap(dir => sources(join(root, dir)))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: readFileSync(f, "utf8") }));

describe("TableHead holds its title cells directly", () => {
  it("no TableRow sits inside a TableHead", () => {
    const offenders = files.filter(f => /<TableHead(\s[^>]*)?>\s*<TableRow[\s>]/.test(f.src)).map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it("the scan reads real files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(f => f.path === "components/ui/Table.tsx")).toBe(true);
  });
});
