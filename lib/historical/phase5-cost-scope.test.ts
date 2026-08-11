import { describe, expect, it } from "vitest";
import { groupCostChangesByMonth } from "./phase5-cost-scope";

describe("groupCostChangesByMonth", () => {
  it("groups by the calendar month of the sale, in Saigon time", () => {
    const batches = groupCostChangesByMonth([
      { line_id: "L1", sale_time: "2026-06-03T09:45:44.554+00:00", old_cost_at_sale: 11273, new_cost_at_sale: 10522 },
      { line_id: "L2", sale_time: "2026-06-28T02:00:00.000+00:00", old_cost_at_sale: 500, new_cost_at_sale: 400 },
      { line_id: "L3", sale_time: "2026-07-01T01:00:00.000+00:00", old_cost_at_sale: 900, new_cost_at_sale: 800 },
    ]);
    expect(batches.map(b => b.month)).toEqual(["2026-06", "2026-07"]);
    expect(batches[0].changes).toHaveLength(2);
    expect(batches[0].net_delta).toBe(-851);
  });

  it("drops only true no-op changes (delta at or under 1e-6 dong)", () => {
    const batches = groupCostChangesByMonth([
      { line_id: "L1", sale_time: "2026-06-03T09:45:44.554+00:00", old_cost_at_sale: 1000, new_cost_at_sale: 1000 },
    ]);
    expect(batches).toEqual([]);
  });

  it("keeps a sub-1-dong change (owner correction 2026-07-30: cost_at_sale is numeric(18,6) now, the exact-cost-precision residual this threshold must not silently discard is always < 0.5 dong)", () => {
    const batches = groupCostChangesByMonth([
      { line_id: "L1", sale_time: "2026-06-03T09:45:44.554+00:00", old_cost_at_sale: 1000, new_cost_at_sale: 1000.3 },
    ]);
    expect(batches).toHaveLength(1);
    expect(batches[0].changes).toHaveLength(1);
    expect(batches[0].net_delta).toBeCloseTo(0.3, 9);
  });

  it("never emits an empty batch, which the RPC rejects", () => {
    const batches = groupCostChangesByMonth([]);
    expect(batches).toEqual([]);
  });
});
