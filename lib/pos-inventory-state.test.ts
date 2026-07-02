import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { getPosInventoryState } from "@/lib/pos-inventory-state";

describe("getPosInventoryState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads compact balances and MAC unit costs in one database call", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        balances: { "ING-001": 125.5, "BTP-001": 20 },
        mac_unit_costs: { "ING-001": 28.25 },
      },
      error: null,
    });

    const result = await getPosInventoryState("2026-07-02T02:00:00.000Z");

    expect(mocks.rpc).toHaveBeenCalledWith("get_pos_inventory_state", {
      p_as_of: "2026-07-02T02:00:00.000Z",
    });
    expect(result.balances).toEqual(
      new Map([
        ["ING-001", 125.5],
        ["BTP-001", 20],
      ]),
    );
    expect(result.macUnitCosts).toEqual(new Map([["ING-001", 28.25]]));
  });

  it("rejects malformed state instead of silently pricing at zero", async () => {
    mocks.rpc.mockResolvedValue({
      data: { balances: null, mac_unit_costs: {} },
      error: null,
    });

    await expect(getPosInventoryState("2026-07-02T02:00:00.000Z"))
      .rejects.toThrow("invalid result");
  });
});
