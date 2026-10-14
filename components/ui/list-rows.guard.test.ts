import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-003 (owner 2026-10-06): every row of a list looks the same, nothing
// bold. template.guard.test.ts already keeps <td> cells plain; this keeps the
// phone cards plain too, since a card is the phone's row. Screens that use
// DataList are scanned. Summary boxes above or below the list are not rows:
// their bold count is pinned here so a new bold row still turns this red.

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [full] : [];
  });
}

const SUMMARY_BOLD: Record<string, number> = {
  // opening/closing balance boxes (title + three figures) and the Tổng chi / Tổng thu boxes
  "app/admin/finance/components/CashBookClient.tsx": 6,
};

const root = process.cwd();
const listScreens = sources(join(root, "app", "admin"))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: readFileSync(f, "utf8") }))
  .filter(f => /<DataList\b/.test(f.src));

describe("BR-UI-003 list rows and phone cards are not bold", () => {
  it("finds the list screens", () => {
    expect(listScreens.length).toBeGreaterThanOrEqual(20);
  });

  it("no list screen makes text bold beyond its pinned summary boxes", () => {
    const offenders = listScreens
      .map(f => ({ path: f.path, count: (f.src.match(/\bfont-(?:bold|semibold)\b/g) ?? []).length }))
      .filter(f => f.count !== (SUMMARY_BOLD[f.path] ?? 0))
      .map(f => `${f.path}: ${f.count}`);
    expect(offenders).toEqual([]);
  });
});
