import { describe, expect, it } from "vitest";
import { batchIds } from "./reset-cost-at-sale-core";

describe("batchIds", () => {
  it("splits evenly divisible input into equal batches", () => {
    expect(batchIds([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it("puts the remainder in a shorter final batch", () => {
    expect(batchIds([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single batch when batchSize exceeds the input length", () => {
    expect(batchIds([1, 2, 3], 100)).toEqual([[1, 2, 3]]);
  });

  it("returns no batches for empty input", () => {
    expect(batchIds([], 100)).toEqual([]);
  });

  it("matches the real volume this bug was found at: 2590 ids into batches of 100", () => {
    const ids = Array.from({ length: 2590 }, (_, i) => `id-${i}`);
    const batches = batchIds(ids, 100);
    // 25 full batches of 100, plus a 90-item remainder -- not a round number,
    // the exact production count the unbatched .in() query broke at.
    expect(batches).toHaveLength(26);
    expect(batches.slice(0, 25).every(b => b.length === 100)).toBe(true);
    expect(batches[25]).toHaveLength(90);
    expect(batches.flat()).toEqual(ids);
  });

  it("rejects a non-positive batch size instead of looping forever", () => {
    expect(() => batchIds([1, 2, 3], 0)).toThrow();
    expect(() => batchIds([1, 2, 3], -1)).toThrow();
  });
});
