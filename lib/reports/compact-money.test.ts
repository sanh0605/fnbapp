import { describe, expect, it } from "vitest";
import { formatCompact, pickCompactUnit } from "./compact-money";

// Owner decision 2026-09-12 (BR-DATA-005): chart money is shortened to "k"
// or "tr", one unit per chart. See "Ví dụ bằng số thật" in
// docs/superpowers/plans/2026-09-12-bao-cao-tai-chinh-giao-dien.md.
describe("pickCompactUnit", () => {
  it("picks tr when at least half the non-zero months are a million or more", () => {
    expect(pickCompactUnit([-49_226, 8_980_678, 6_085_470, 17_179_798, 13_523_541, -32_352_964, 697_353])).toBe("tr");
  });

  it("picks k when fewer than half the non-zero months are a million or more", () => {
    expect(pickCompactUnit([120_000, 340_000, 90_000, 2_500_000])).toBe("k"); // 1 of 4 is a million or more
  });

  it("picks k when every month is zero", () => {
    expect(pickCompactUnit([0, 0])).toBe("k");
  });
});

describe("formatCompact", () => {
  it.each([
    [8_980_678, "tr", "8,98tr"],
    [697_353, "tr", "0,7tr"],
    [-49_226, "tr", "-0,05tr"],
    [-32_352_964, "tr", "-32,35tr"],
    [100_000, "k", "100k"],
    [100_120, "k", "100,12k"],
    [100_000_000, "tr", "100tr"],
    [100_120_000, "tr", "100,12tr"],
    [1_234_500, "k", "1.234,5k"],
    [0, "tr", "0"],
    [-1_000, "tr", "0"],
  ] as const)("formatCompact(%s, %s) is %s", (value, unit, expected) => {
    expect(formatCompact(value, unit)).toBe(expected);
  });
});
