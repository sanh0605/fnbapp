import { describe, expect, it } from "vitest";
import { selectRebuildableOrders } from "./phase4-rebuild-scope";

describe("selectRebuildableOrders", () => {
  it("includes every order that replayed without error", () => {
    const scope = selectRebuildableOrders({
      allOrderIds: ["ORD-1", "ORD-2"],
      replayErrors: [],
      computedRowsByOrder: new Map([
        ["ORD-1", [{ item_reference: "ING-001" }]],
        ["ORD-2", [{ item_reference: "ING-002" }]],
      ]),
    });
    expect(scope.rebuildOrderIds).toEqual(["ORD-1", "ORD-2"]);
    expect(scope.excludedOrderIds).toEqual([]);
  });

  it("excludes an entire order when any of its lines failed to replay", () => {
    const scope = selectRebuildableOrders({
      allOrderIds: ["ORD-1", "ORD-2"],
      replayErrors: ["ORD-2/LINE-9: no recipe snapshot"],
      computedRowsByOrder: new Map([
        ["ORD-1", [{ item_reference: "ING-001" }]],
        ["ORD-2", [{ item_reference: "ING-002" }]],
      ]),
    });
    expect(scope.rebuildOrderIds).toEqual(["ORD-1"]);
    expect(scope.excludedOrderIds).toEqual(["ORD-2"]);
    expect(scope.exclusionReasons.get("ORD-2")).toContain("no recipe snapshot");
  });

  it("excludes an order that produced no computed rows at all", () => {
    const scope = selectRebuildableOrders({
      allOrderIds: ["ORD-1"],
      replayErrors: [],
      computedRowsByOrder: new Map(),
    });
    expect(scope.rebuildOrderIds).toEqual([]);
    expect(scope.excludedOrderIds).toEqual(["ORD-1"]);
  });
});
