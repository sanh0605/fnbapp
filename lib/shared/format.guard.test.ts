import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-008 (owner 2026-10-07): every number on screen is written by
// lib/shared/format.ts, so the style is set in one place and binds every
// new feature. Dates are not numbers here: Intl.DateTimeFormat and
// toLocaleDateString/toLocaleTimeString stay allowed.
const ALLOWED = new Set(["lib/shared/format.ts"]);
const HAND_FORMAT = /\.toLocaleString\(|Intl\.NumberFormat|\.toFixed\(/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return [];
    return [full];
  });
}

const root = process.cwd();
const files = ["app", "components", "lib"].flatMap(d => sources(join(root, d))).map(f => ({
  path: relative(root, f).split(sep).join("/"),
  src: readFileSync(f, "utf8"),
}));

describe("BR-UI-008 one shared number formatter", () => {
  it("no file outside lib/shared/format.ts formats a number itself (chủ quán chốt 07/10/2026)", () => {
    const offenders = files
      .filter(f => !ALLOWED.has(f.path) && HAND_FORMAT.test(f.src))
      .map(f => f.path)
      .sort();
    expect(offenders).toEqual([]);
  });
});
