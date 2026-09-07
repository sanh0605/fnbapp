// The machine check for spec 2026-09-07 §3.3: lib/ root holds no source files;
// every module lives in a domain folder.
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

export function strayLibRootFiles(): string[] {
  return readdirSync("lib", { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

describe("lib/ root", () => {
  it("holds no source files -- every module lives in a domain folder", () => {
    expect(strayLibRootFiles()).toEqual([]);
  });
});
