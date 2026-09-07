// The machine check for spec 2026-09-07 §3.3: lib/ root holds no source files;
// every module lives in a domain folder. it.todo until Phase 3 finishes moving
// them (OPEN-ITEMS.md is generated from it.todo, so this is the open item).
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

export function strayLibRootFiles(): string[] {
  return readdirSync("lib", { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

describe("lib/ root", () => {
  it.todo("holds no source files -- every module lives in a domain folder", () => {
    expect(strayLibRootFiles()).toEqual([]);
  });
});
