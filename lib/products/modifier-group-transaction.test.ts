import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { saveModifierGroupAtomic } from "./modifier-group-transaction";

const group = { id: "MG-001", name: "Thêm Topping", selection_mode: "MANY", max_total: 3, allow_standalone: true, sort_order: 50 };

describe("saveModifierGroupAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends the group and its dish ticks to one RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: { group_id: "MG-001", product_count: 2 }, error: null });
    await expect(saveModifierGroupAtomic({ isEdit: false, group, productIds: ["PROD-001", "PROD-002"] })).resolves.toEqual({ groupId: "MG-001", productCount: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("save_modifier_group_atomic", {
      p_is_edit: false,
      p_group: group,
      p_product_ids: ["PROD-001", "PROD-002"],
    });
  });

  it("refuses a result with fewer ticks than were sent", async () => {
    mocks.rpc.mockResolvedValue({ data: { group_id: "MG-001", product_count: 1 }, error: null });
    await expect(saveModifierGroupAtomic({ isEdit: true, group, productIds: ["PROD-001", "PROD-002"] }))
      .rejects.toThrow("save_modifier_group_atomic persisted row count mismatch");
  });

  it("surfaces a rollback error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "forced rollback" } });
    await expect(saveModifierGroupAtomic({ isEdit: true, group, productIds: [] })).rejects.toThrow("save_modifier_group_atomic: forced rollback");
  });
});
