import { describe, expect, it } from "vitest";
import { filterOutEquipmentIssues } from "./issue-costing-inputs";

// docs/superpowers/plans/2026-08-31-equipment-out-of-issue-slips.md section
// 4: the costing-engine block has its own test, not dependent on the
// issue-slip picker having already filtered equipment out. Feeds
// filterOutEquipmentIssues an equipment-tagged row directly -- exactly the
// shape of "a slip recorded before the screen changed" the plan names as
// what this layer protects, independent of whether the picker ever let one
// through.
describe("filterOutEquipmentIssues", () => {
  const categories = [
    { id: "NHH-001", system_type: "RAW" },
    { id: "NHH-002", system_type: "CONSUMABLE" },
    { id: "NHH-003", system_type: "EQUIPMENT" },
  ];
  const items = [
    { id: "SPM-COFFEE", item_category_id: "NHH-001" },
    { id: "SPM-CUP", item_category_id: "NHH-002" },
    { id: "SPM-MACHINE", item_category_id: "NHH-003" },
  ];

  it("drops a stock_issues row naming an equipment item, keeps everything else", () => {
    const issues = [
      { id: "ISS-001", purchased_item_id: "SPM-COFFEE", base_quantity: 500 },
      { id: "ISS-002", purchased_item_id: "SPM-CUP", base_quantity: 50 },
      { id: "ISS-003", purchased_item_id: "SPM-MACHINE", base_quantity: 1 },
    ];

    const result = filterOutEquipmentIssues(issues, items, categories);

    expect(result.map(r => r.id)).toEqual(["ISS-001", "ISS-002"]);
  });

  it("does nothing when no issue names an equipment item", () => {
    const issues = [{ id: "ISS-001", purchased_item_id: "SPM-COFFEE", base_quantity: 500 }];
    expect(filterOutEquipmentIssues(issues, items, categories)).toHaveLength(1);
  });

  it("an empty issues list stays empty", () => {
    expect(filterOutEquipmentIssues([], items, categories)).toEqual([]);
  });
});
