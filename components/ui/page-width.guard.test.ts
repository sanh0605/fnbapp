import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-012 (owner 2026-10-11, option b): every admin page sits in one frame
// at most 1,280 px wide, centred. On a laptop the space beside the menu is
// narrower than that, so pages fill it; on a 1,920 px screen they no longer
// spread to 1,584 px while others stop at 672.

const layout = readFileSync(join(process.cwd(), "app", "admin", "AdminFrame.tsx"), "utf8");

describe("BR-UI-012 one page frame", () => {
  it("the admin frame is at most 1,280 px and centred", () => {
    expect(layout).toMatch(/className="max-w-screen-xl mx-auto w-full[ "]/);
  });

  it("the old 1,920 px frame is gone", () => {
    expect(layout).not.toContain("max-w-[1920px]");
  });
});

// Every page fills the frame: no page, form or shared detail frame keeps a
// box of its own 672-1,280 px wide (BR-UI-012). Small caps (a note, a
// centred empty card, a truncated cell) are not page widths and stay.
const WIDE_CAP = /\bmax-w-(?:[2-7]xl|screen-[a-z0-9]+)\b/;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("BR-UI-012 no page keeps a narrower box", () => {
  const root = process.cwd();
  const posix = (f: string) => relative(root, f).split(sep).join("/");
  const files = [
    ...tsxFiles(join(root, "app", "admin")),
    join(root, "components", "ui", "detail", "DetailFrame.tsx"),
  ].filter(f => posix(f) !== "app/admin/AdminFrame.tsx");

  it("scans the admin pages", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("no file under app/admin but the layout sets a page-wide max width", () => {
    const offenders = files
      .filter(f => WIDE_CAP.test(readFileSync(f, "utf8")))
      .map(posix);
    expect(offenders).toEqual([]);
  });
});

// Measured 2026-10-11 at a 1,440 px laptop: the frame beside the menu is
// about 1,089 px and the Doanh số heat-map card about 1,040 inside, so a
// grid forced to 1,120 px scrolled sideways. 24 hours at 960 px still leave
// each hour about 37 px for its "12k" label.
describe("BR-UI-012 Doanh số fits a 1,440 px laptop", () => {
  it("the hour-by-day heat map asks for at most 1,000 px", () => {
    const sales = readFileSync(join(process.cwd(), "app", "admin", "reports", "sales", "page.tsx"), "utf8");
    const widths = Array.from(sales.matchAll(/min-w-\[(\d+)px\]/g), m => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.max(...widths)).toBeLessThanOrEqual(1000);
  });
});
