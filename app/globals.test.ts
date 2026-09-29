import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Owner decision 2026-09-29 (spec 2026-09-29-menu-va-khuon-trang-design.md
// section 3.2): Be Vietnam Pro for every text, POS included; Outfit (no
// Vietnamese glyphs) and Plus Jakarta Sans are gone.
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

describe("app font", () => {
  it("loads Be Vietnam Pro with the Vietnamese subset from the root layout", () => {
    const layout = read("app", "layout.tsx");
    expect(layout).toMatch(/Be_Vietnam_Pro\(/);
    expect(layout).toMatch(/subsets:\s*\[[^\]]*"vietnamese"/);
  });
  it("no longer references Outfit or Plus Jakarta Sans", () => {
    for (const file of [read("app", "globals.css"), read("tailwind.config.ts")]) {
      expect(file).not.toMatch(/Outfit|Plus Jakarta/);
    }
  });
});
