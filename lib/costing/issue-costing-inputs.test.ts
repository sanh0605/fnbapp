import { describe, expect, it } from "vitest";
import { filterOutEquipmentIssues, buildClassifiedIssues, isNonInventoryItem, selectCostedIssues } from "./issue-costing-inputs";

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

  // Opus code review on 730bc42, 2026-09-08: Boolean(undefined) === false,
  // so a session row present in the array but missing (or null) is_shrinkage
  // -- production today, before migration 0099 runs -- resolved to isShrinkage
  // false instead of the unresolvable-id fallback's true. Two flavours of
  // "I don't know" must fail in the same, visible direction (BR-COGS-007
  // exists precisely so shrinkage is never silently hidden inside Giá vốn).
  it("a STOCKTAKE row whose session is found but carries no is_shrinkage field resolves to isShrinkage true, same as an unresolvable session_id", () => {
    const sessionsMissingField = [{ id: "STK-100" }]; // no is_shrinkage key at all
    const rows = [{ purchased_item_id: "SPM-X", issued_at: "2026-09-01T00:00:00Z", base_quantity: 4, source: "STOCKTAKE", session_id: "STK-100" }];
    const result = buildClassifiedIssues(rows, sessionsMissingField);
    expect(result[0].isShrinkage).toBe(true);
  });

  it("a STOCKTAKE row whose session carries is_shrinkage: null resolves to isShrinkage true", () => {
    const sessionsNullField = [{ id: "STK-100", is_shrinkage: null }];
    const rows = [{ purchased_item_id: "SPM-X", issued_at: "2026-09-01T00:00:00Z", base_quantity: 4, source: "STOCKTAKE", session_id: "STK-100" }];
    const result = buildClassifiedIssues(rows, sessionsNullField);
    expect(result[0].isShrinkage).toBe(true);
  });
});

describe("isNonInventoryItem", () => {
  it("reads the item's own flag, as a boolean or the legacy 'TRUE' string", () => {
    expect(isNonInventoryItem({ is_non_inventory: true })).toBe(true);
    expect(isNonInventoryItem({ is_non_inventory: "TRUE" })).toBe(true);
    expect(isNonInventoryItem({ is_non_inventory: false })).toBe(false);
    expect(isNonInventoryItem({ is_non_inventory: null })).toBe(false);
    expect(isNonInventoryItem({})).toBe(false);
  });
});

// Real shape, 2026-09-11: Khăn lau đa năng (SPM-057) carries is_non_inventory
// and was issued +1 then -1 on 02/09/2026 (ISS-00120, ISS-00121).
describe("selectCostedIssues", () => {
  const categories = [
    { id: "NHH-001", system_type: "RAW" },
    { id: "NHH-002", system_type: "CONSUMABLE" },
    { id: "NHH-003", system_type: "EQUIPMENT" },
  ];
  const items = [
    { id: "SPM-001", item_category_id: "NHH-001", is_non_inventory: false },
    { id: "SPM-057", item_category_id: "NHH-002", is_non_inventory: true },
    { id: "SPM-090", item_category_id: "NHH-003", is_non_inventory: false },
  ];

  it("drops issues of items bought for immediate use and of equipment, keeps stocked goods", () => {
    const issues = [
      { id: "ISS-00001", purchased_item_id: "SPM-001" },
      { id: "ISS-00120", purchased_item_id: "SPM-057" },
      { id: "ISS-00121", purchased_item_id: "SPM-057" },
      { id: "ISS-00200", purchased_item_id: "SPM-090" },
    ];
    expect(selectCostedIssues(issues, items, categories).map(r => r.id)).toEqual(["ISS-00001"]);
  });

  it("keeps an issue whose item is missing from the list -- unknown is not assumed bought-for-use", () => {
    const issues = [{ id: "ISS-00300", purchased_item_id: "SPM-999" }];
    expect(selectCostedIssues(issues, items, categories).map(r => r.id)).toEqual(["ISS-00300"]);
  });
});
