import { describe, it, expect } from "vitest";
import { auditDuplicateItems } from "./duplicate-item-audit";

describe("auditDuplicateItems", () => {
  it("flags an item consumed with zero purchase history", () => {
    const result = auditDuplicateItems({
      itemIds: ["ING-003"],
      nameOf: () => "Sữa đặc",
      purchasedByItem: new Map(),
      consumedByItem: new Map([["ING-003", 6651]]),
    });
    expect(result.consumedNeverPurchased.map(r => r.item)).toEqual(["ING-003"]);
    expect(result.purchasedNeverConsumed).toHaveLength(0);
    expect(result.nameTwins).toHaveLength(0);
  });

  it("flags an item purchased but never consumed by any recipe", () => {
    const result = auditDuplicateItems({
      itemIds: ["ING-099"],
      nameOf: () => "Bột trân châu dự phòng",
      purchasedByItem: new Map([["ING-099", 500]]),
      consumedByItem: new Map(),
    });
    expect(result.purchasedNeverConsumed.map(r => r.item)).toEqual(["ING-099"]);
    expect(result.consumedNeverPurchased).toHaveLength(0);
    expect(result.nameTwins).toHaveLength(0);
  });

  it("flags a name twin: a consumed-never-purchased id and a purchased-never-consumed id sharing a normalised name", () => {
    const nameOf = (id: string) => ({ "ING-003": "Sữa đặc", "ING-050": "  SUA DAC  " }[id] || id);
    const result = auditDuplicateItems({
      itemIds: ["ING-003", "ING-050"],
      nameOf,
      purchasedByItem: new Map([["ING-050", 500]]),
      consumedByItem: new Map([["ING-003", 6651]]),
    });
    expect(result.nameTwins).toHaveLength(1);
    expect(result.nameTwins[0].consumedItem.item).toBe("ING-003");
    expect(result.nameTwins[0].purchasedItem.item).toBe("ING-050");
  });

  it("does not flag similarly-named items that both have purchases and consumption", () => {
    const nameOf = (id: string) => ({ "ING-002": "Đường trắng", "ING-060": "duong trang" }[id] || id);
    const result = auditDuplicateItems({
      itemIds: ["ING-002", "ING-060"],
      nameOf,
      purchasedByItem: new Map([["ING-002", 1000], ["ING-060", 300]]),
      consumedByItem: new Map([["ING-002", 500], ["ING-060", 100]]),
    });
    expect(result.consumedNeverPurchased).toHaveLength(0);
    expect(result.purchasedNeverConsumed).toHaveLength(0);
    expect(result.nameTwins).toHaveLength(0);
  });
});
