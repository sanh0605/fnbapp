import { describe, expect, it } from "vitest";
import { filterOutEquipmentIssues, buildClassifiedIssues } from "./issue-costing-inputs";

// section
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

// docs/superpowers/plans/2026-09-08-tach-gia-von-va-hao-hut.md Task 2. Decides
// isShrinkage per row -- computeIssueCostingSplit never reads Issue.source
// itself, so this is the one place that classification is made.
describe("buildClassifiedIssues", () => {
  const sessions = [
    { id: "STK-001", is_shrinkage: false },
    { id: "STK-002", is_shrinkage: true },
  ];

  it("a MANUAL row is never shrinkage, regardless of session_id", () => {
    const rows = [{ purchased_item_id: "SPM-X", issued_at: "2026-08-02T00:00:00Z", base_quantity: 4, source: "MANUAL", session_id: null }];
    const result = buildClassifiedIssues(rows, sessions);
    expect(result).toEqual([{ purchased_item_id: "SPM-X", at: "2026-08-02T00:00:00Z", base_quantity: 4, source: "MANUAL", isShrinkage: false }]);
  });

  it("a STOCKTAKE row whose session is flagged not-shrinkage (STK-001's shape) resolves to isShrinkage false", () => {
    const rows = [{ purchased_item_id: "SPM-X", issued_at: "2026-08-09T15:00:00Z", base_quantity: 4, source: "STOCKTAKE", session_id: "STK-001" }];
    const result = buildClassifiedIssues(rows, sessions);
    expect(result[0].isShrinkage).toBe(false);
  });

  it("a STOCKTAKE row whose session is flagged shrinkage resolves to isShrinkage true", () => {
    const rows = [{ purchased_item_id: "SPM-X", issued_at: "2026-09-01T00:00:00Z", base_quantity: 4, source: "STOCKTAKE", session_id: "STK-002" }];
    const result = buildClassifiedIssues(rows, sessions);
    expect(result[0].isShrinkage).toBe(true);
  });

  it("a STOCKTAKE row whose session_id does not resolve to any session defaults to isShrinkage true, matching the column's own default", () => {
    const rows = [{ purchased_item_id: "SPM-X", issued_at: "2026-09-01T00:00:00Z", base_quantity: 4, source: "STOCKTAKE", session_id: "STK-999" }];
    const result = buildClassifiedIssues(rows, sessions);
    expect(result[0].isShrinkage).toBe(true);
  });
});
