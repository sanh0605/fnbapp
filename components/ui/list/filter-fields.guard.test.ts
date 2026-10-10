import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// A filter box's field wrapper must take the whole width on a phone and drop
// to its own line. `w-full` alone does that inside FilterCard's flex-wrap row;
// adding `flex-1` (flex-basis 0) cancels it, so three boxes squeeze onto one
// phone line and their texts are cut ("Tất c", "Đang b" on Món, Khuyến mãi,
// Sổ thu chi — found 2026-10-10 while checking every page on a phone).
//
// Scanned: every .tsx under app/admin, tests excluded. The till screen
// (app/pos) is its own layout and is not scanned.

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) return [];
    return [full];
  });
}

const root = process.cwd();
const files = sources(join(root, "app", "admin")).map(f => ({
  path: relative(root, f).split(sep).join("/"),
  src: readFileSync(f, "utf8"),
}));

function offenders(): string[] {
  const out: string[] = [];
  for (const f of files) {
    for (const m of f.src.matchAll(/className="([^"]*)"/g)) {
      const classes = m[1].split(/\s+/);
      if (classes.includes("flex-1") && classes.includes("w-full")) out.push(`${f.path}: "${m[1]}"`);
    }
  }
  return out.sort();
}

describe("filter fields take a whole phone line", () => {
  it("no admin element pairs flex-1 with w-full (flex-1 cancels the full width)", () => {
    expect(offenders()).toEqual([]);
  });

  it("the scan reads real files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(f => f.path === "app/admin/products/ProductsClient.tsx")).toBe(true);
  });
});
