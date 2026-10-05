import { describe, expect, it } from "vitest";
import { planAssetRetirement, summarizeAfterRetire } from "./retire-misfiled-assets-core";

const categories = [
  { id: "NHH-009", system_type: "EQUIPMENT" },
  { id: "NHH-002", system_type: "CONSUMABLE" },
];
const items = [
  { id: "SPM-134", name: "Hộp đựng topping liền nắp", item_category_id: "NHH-002" },
  { id: "SPM-010", name: "Máy xay", item_category_id: "NHH-009" },
  { id: "SPM-020", name: "Kẹp gắp", item_category_id: "NHH-002" },
  { id: "SPM-030", name: "Khay cũ", item_category_id: "NHH-002" },
];
const mk = (id: string, itemId: string, status = "ACTIVE", quantity = 1, total = 1000) => ({
  id, purchased_item_id: itemId, name_snapshot: `snap ${id}`, quantity, total_cost: total, status,
});

describe("planAssetRetirement", () => {
  it("retires only active assets of items no longer equipment; refuses those with a disposal; skips equipment and INACTIVE", () => {
    const assets = [
      mk("TS-067", "SPM-134", "ACTIVE", 200, 80352), // misfiled -> retire
      mk("TS-001", "SPM-010"),                        // still equipment -> untouched
      mk("TS-050", "SPM-020"),                        // misfiled but disposed -> refuse
      mk("TS-060", "SPM-030", "INACTIVE"),            // already retired
    ];
    const plan = planAssetRetirement({ items, categories, assets, disposals: [{ asset_id: "TS-050" }] });

    expect(plan.assetsTotal).toBe(4);
    expect(plan.toRetire).toEqual([
      { assetId: "TS-067", itemId: "SPM-134", itemName: "Hộp đựng topping liền nắp", quantity: 200, totalCost: 80352 },
    ]);
    expect(plan.refused).toEqual([{ assetId: "TS-050", itemId: "SPM-020", itemName: "Kẹp gắp" }]);
  });

  it("refusing one asset of an item refuses all of that item's assets, retires none of them", () => {
    const assets = [mk("TS-050", "SPM-020"), mk("TS-051", "SPM-020")];
    const plan = planAssetRetirement({ items, categories, assets, disposals: [{ asset_id: "TS-051" }] });
    expect(plan.toRetire).toEqual([]);
    expect(plan.refused.map(r => r.assetId)).toEqual(["TS-051"]);
  });

  it("returns nothing when every asset belongs to an equipment item", () => {
    const plan = planAssetRetirement({ items, categories, assets: [mk("TS-001", "SPM-010")], disposals: [] });
    expect(plan).toEqual({ assetsTotal: 1, toRetire: [], refused: [] });
  });
});

describe("summarizeAfterRetire", () => {
  it("counts INACTIVE assets over the real total and checks the planned ids are all INACTIVE", () => {
    const after = [mk("TS-067", "SPM-134", "INACTIVE"), mk("TS-001", "SPM-010")];
    expect(summarizeAfterRetire(after, ["TS-067"])).toEqual({
      assetsTotal: 2, inactive: 1, plannedStillActive: [],
    });
    expect(summarizeAfterRetire(after, ["TS-001"]).plannedStillActive).toEqual(["TS-001"]);
  });
});
