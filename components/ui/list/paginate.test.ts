import { describe, it, expect } from "vitest";
import { paginate, pageWindow, ROWS_PER_PAGE } from "./paginate";

describe("paginate", () => {
  const items46 = Array.from({ length: 46 }, (_, i) => ({ id: `ID-${i + 1}` }));

  it("handles 46 items with rawPage '3'", () => {
    const result = paginate(items46, "3");
    expect(result.page).toBe(3);
    expect(result.pageCount).toBe(3);
    expect(result.firstIndex).toBe(41);
    expect(result.lastIndex).toBe(46);
    expect(result.total).toBe(46);
    expect(result.rows).toHaveLength(6);
    expect(result.rows[0].id).toBe("ID-41");
    expect(result.rows[5].id).toBe("ID-46");
  });

  it("clamps rawPage '99' to the last page (page 3)", () => {
    const result = paginate(items46, "99");
    expect(result.page).toBe(3);
    expect(result.pageCount).toBe(3);
    expect(result.firstIndex).toBe(41);
    expect(result.lastIndex).toBe(46);
    expect(result.rows).toHaveLength(6);
  });

  it("falls back to page 1 for invalid or undefined rawPage values", () => {
    const values = ["abc", "0", "1.5", undefined];
    for (const val of values) {
      const result = paginate(items46, val);
      expect(result.page).toBe(1);
      expect(result.firstIndex).toBe(1);
      expect(result.lastIndex).toBe(20);
      expect(result.rows).toHaveLength(ROWS_PER_PAGE);
    }
  });

  it("handles empty list", () => {
    const result = paginate([], "1");
    expect(result).toEqual({
      rows: [],
      page: 1,
      pageCount: 1,
      firstIndex: 0,
      lastIndex: 0,
      total: 0,
    });
  });

  it("supports custom perPage parameter", () => {
    const result = paginate(items46, 2, 10);
    expect(result.page).toBe(2);
    expect(result.pageCount).toBe(5);
    expect(result.firstIndex).toBe(11);
    expect(result.lastIndex).toBe(20);
    expect(result.rows).toHaveLength(10);
  });
});

describe("pageWindow", () => {
  it("returns at most 5 page numbers around the current page", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(pageWindow(8, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it("handles pageCount <= 5", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(3, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 0)).toEqual([1]);
  });
});
