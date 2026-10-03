import { describe, it, expect } from "vitest";
import { sortRows, parseSort, type SortDir } from "./sort";

describe("BR-DATA-008: List sorting (sortRows & parseSort)", () => {
  describe("sortRows", () => {
    it("returns a new array and does not mutate the original array", () => {
      const original = [{ id: 2 }, { id: 1 }];
      const result = sortRows(original, (r) => r.id, "asc");
      expect(result).not.toBe(original);
      expect(original[0].id).toBe(2);
      expect(original[1].id).toBe(1);
      expect(result.map((r) => r.id)).toEqual([1, 2]);
    });

    it("sorts numbers by numeric value in both directions", () => {
      const rows = [
        { id: 1, val: 100 },
        { id: 2, val: 5 },
        { id: 3, val: 25 },
        { id: 4, val: 0 },
        { id: 5, val: -10 },
      ];

      const asc = sortRows(rows, (r) => r.val, "asc");
      expect(asc.map((r) => r.val)).toEqual([-10, 0, 5, 25, 100]);

      const desc = sortRows(rows, (r) => r.val, "desc");
      expect(desc.map((r) => r.val)).toEqual([100, 25, 5, 0, -10]);
    });

    it("sorts Vietnamese text correctly (e.g. 'Dâu' before 'Đá' in asc)", () => {
      const rows = [
        { id: 1, name: "Đá" },
        { id: 2, name: "Dâu" },
        { id: 3, name: "Cà phê" },
        { id: 4, name: "Đường" },
      ];

      const asc = sortRows(rows, (r) => r.name, "asc");
      expect(asc.map((r) => r.name)).toEqual(["Cà phê", "Dâu", "Đá", "Đường"]);

      const desc = sortRows(rows, (r) => r.name, "desc");
      expect(desc.map((r) => r.name)).toEqual(["Đường", "Đá", "Dâu", "Cà phê"]);
    });

    it("sorts numeric codes using natural numeric collation ('TS-2' < 'TS-10')", () => {
      const rows = [
        { code: "TS-10" },
        { code: "TS-1" },
        { code: "TS-2" },
        { code: "TS-20" },
        { code: "TS-03" },
      ];

      const asc = sortRows(rows, (r) => r.code, "asc");
      expect(asc.map((r) => r.code)).toEqual([
        "TS-1",
        "TS-2",
        "TS-03",
        "TS-10",
        "TS-20",
      ]);

      const desc = sortRows(rows, (r) => r.code, "desc");
      expect(desc.map((r) => r.code)).toEqual([
        "TS-20",
        "TS-10",
        "TS-03",
        "TS-2",
        "TS-1",
      ]);
    });

    it("places null, undefined, and empty string last in BOTH directions (asc and desc)", () => {
      const rows = [
        { id: 1, val: "Banana" },
        { id: 2, val: null },
        { id: 3, val: "Apple" },
        { id: 4, val: "" },
        { id: 5, val: undefined },
        { id: 6, val: "Cherry" },
      ];

      const asc = sortRows(rows, (r) => r.val, "asc");
      expect(asc.slice(0, 3).map((r) => r.val)).toEqual(["Apple", "Banana", "Cherry"]);
      expect(asc.slice(3).map((r) => r.id)).toEqual([2, 4, 5]);

      const desc = sortRows(rows, (r) => r.val, "desc");
      expect(desc.slice(0, 3).map((r) => r.val)).toEqual(["Cherry", "Banana", "Apple"]);
      expect(desc.slice(3).map((r) => r.id)).toEqual([2, 4, 5]);
    });

    it("places null/undefined last when sorting numbers in both directions", () => {
      const rows = [
        { id: 1, val: 50 },
        { id: 2, val: null },
        { id: 3, val: 10 },
        { id: 4, val: undefined },
        { id: 5, val: 100 },
      ];

      const asc = sortRows(rows, (r) => r.val, "asc");
      expect(asc.slice(0, 3).map((r) => r.val)).toEqual([10, 50, 100]);
      expect(asc.slice(3).map((r) => r.id)).toEqual([2, 4]);

      const desc = sortRows(rows, (r) => r.val, "desc");
      expect(desc.slice(0, 3).map((r) => r.val)).toEqual([100, 50, 10]);
      expect(desc.slice(3).map((r) => r.id)).toEqual([2, 4]);
    });

    it("is stable when sort values are identical or both empty", () => {
      const rows = [
        { id: 1, group: "A", order: 1 },
        { id: 2, group: "B", order: 2 },
        { id: 3, group: "A", order: 3 },
        { id: 4, group: null, order: 4 },
        { id: 5, group: "A", order: 5 },
        { id: 6, group: null, order: 6 },
      ];

      const asc = sortRows(rows, (r) => r.group, "asc");
      const groupA_asc = asc.filter((r) => r.group === "A");
      expect(groupA_asc.map((r) => r.id)).toEqual([1, 3, 5]);
      const nulls_asc = asc.filter((r) => r.group === null);
      expect(nulls_asc.map((r) => r.id)).toEqual([4, 6]);

      const desc = sortRows(rows, (r) => r.group, "desc");
      expect(desc[0].id).toBe(2);
      const groupA_desc = desc.filter((r) => r.group === "A");
      expect(groupA_desc.map((r) => r.id)).toEqual([1, 3, 5]);
      const nulls_desc = desc.filter((r) => r.group === null);
      expect(nulls_desc.map((r) => r.id)).toEqual([4, 6]);
    });
  });

  describe("parseSort", () => {
    const validKeys = ["id", "name", "price", "date"];
    const defaultKey = "id";

    it("returns key and dir when both are valid", () => {
      expect(parseSort("name", "asc", validKeys, defaultKey)).toEqual({
        key: "name",
        dir: "asc",
      });
      expect(parseSort("price", "desc", validKeys, defaultKey)).toEqual({
        key: "price",
        dir: "desc",
      });
    });

    it("falls back to defaultKey and desc when rawKey is unknown or missing", () => {
      expect(parseSort("unknown_column", "desc", validKeys, defaultKey)).toEqual({
        key: "id",
        dir: "desc",
      });
      expect(parseSort("unknown_column", "asc", validKeys, defaultKey)).toEqual({
        key: "id",
        dir: "desc",
      });
      expect(parseSort("", "desc", validKeys, defaultKey)).toEqual({
        key: "id",
        dir: "desc",
      });
      expect(parseSort(null, "desc", validKeys, defaultKey)).toEqual({
        key: "id",
        dir: "desc",
      });
      expect(parseSort(undefined, "desc", validKeys, defaultKey)).toEqual({
        key: "id",
        dir: "desc",
      });
    });

    it("falls back to 'asc' when rawDir is anything other than 'desc'", () => {
      expect(parseSort("name", "asc", validKeys, defaultKey)).toEqual({
        key: "name",
        dir: "asc",
      });
      expect(parseSort("name", "invalid", validKeys, defaultKey)).toEqual({
        key: "name",
        dir: "asc",
      });
      expect(parseSort("name", null, validKeys, defaultKey)).toEqual({
        key: "name",
        dir: "asc",
      });
      expect(parseSort("name", undefined, validKeys, defaultKey)).toEqual({
        key: "name",
        dir: "asc",
      });
      expect(parseSort("name", "", validKeys, defaultKey)).toEqual({
        key: "name",
        dir: "asc",
      });
      expect(parseSort("name", "DESC", validKeys, defaultKey)).toEqual({
        key: "name",
        dir: "asc",
      });
    });
  });
});
