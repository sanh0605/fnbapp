import { describe, it, expect } from "vitest";
import { summariseItemBalances } from "./item-balance-summary";

const nameOf = (id: string) => ({ "ING-003": "Sữa đặc" }[id] || id);

describe("summariseItemBalances", () => {
  it("reports a negative item even when theoretical and recorded agree", () => {
    // The Sua dac case: -6651 on both sides, so it is NOT a mismatch,
    // but it IS negative. The old inline filter could never see this.
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-003", -6651]]),
      recordedByItem: new Map([["ING-003", -6651]]),
      nameOf,
    });
    expect(result.mismatches).toHaveLength(0);
    expect(result.negatives).toHaveLength(1);
    expect(result.negatives[0].item_name).toBe("Sữa đặc");
    expect(result.negatives[0].theoretical).toBe(-6651);
  });

  it("reports a mismatch that is not negative", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-002", 2000]]),
      recordedByItem: new Map([["ING-002", 1800]]),
      nameOf,
    });
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].delta).toBe(200);
    expect(result.negatives).toHaveLength(0);
  });

  it("reports an item that is both negative and mismatched, in both lists", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-009", -500]]),
      recordedByItem: new Map([["ING-009", -300]]),
      nameOf,
    });
    expect(result.mismatches).toHaveLength(1);
    expect(result.negatives).toHaveLength(1);
  });

  it("ignores differences and negatives within tolerance", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-004", -0.005]]),
      recordedByItem: new Map([["ING-004", 0]]),
      nameOf,
    });
    expect(result.mismatches).toHaveLength(0);
    expect(result.negatives).toHaveLength(0);
  });

  it("covers items present in only one of the two maps", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-005", -100]]),
      recordedByItem: new Map([["ING-006", 50]]),
      nameOf,
    });
    expect(result.negatives.map(r => r.item)).toEqual(["ING-005"]);
    expect(result.mismatches).toHaveLength(2);
  });

  it("sorts negatives most negative first", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["A", -10], ["B", -900], ["C", -50]]),
      recordedByItem: new Map([["A", -10], ["B", -900], ["C", -50]]),
      nameOf,
    });
    expect(result.negatives.map(r => r.item)).toEqual(["B", "C", "A"]);
  });

  it("excludes non-inventory ingredients from both lists", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-001", -112230], ["ING-003", -6651]]),
      recordedByItem: new Map([["ING-001", -112230], ["ING-003", -6651]]),
      nameOf: (id) => ({ "ING-001": "Nước sôi", "ING-003": "Sữa đặc" }[id] || id),
      nonInventoryItems: new Set(["ING-001"]),
    });
    expect(result.negatives.map(r => r.item_name)).toEqual(["Sữa đặc"]);
    expect(result.mismatches).toHaveLength(0);
  });

  it("treats an omitted nonInventoryItems set as excluding nothing", () => {
    const result = summariseItemBalances({
      theoreticalByItem: new Map([["ING-001", -5]]),
      recordedByItem: new Map([["ING-001", -5]]),
      nameOf: (id) => id,
    });
    expect(result.negatives).toHaveLength(1);
  });
});
