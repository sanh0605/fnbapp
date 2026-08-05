import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import * as stocktakeTransaction from "./stocktake-transaction";

describe("stocktake atomic adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("exposes one atomic apply adapter for both preview and confirmation", () => {
    expect(stocktakeTransaction).toHaveProperty("applyStocktakeSessionAtomic");
  });

  it("rejects an RPC result whose planned rows and ledger+issue count disagree", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        session_id: "STK-001",
        status: "CONFIRMED",
        dry_run: false,
        ledger_count: 2,
        issue_count: 0,
        rows: [{
          line_id: "SKL-00001",
          item_reference: "ING-001",
          item_type: "BASE_INGREDIENT",
          counted_qty: 8,
          theoretical_at_count: 10,
          current_theoretical_qty: 9,
          count_variance: -2,
          projected_qty: 7,
        }],
        ledger_ids: ["STK-001"],
        issue_ids: [],
        plan_hash: "mismatch-hash",
      },
      error: null,
    });

    await expect(stocktakeTransaction.applyStocktakeSessionAtomic({
      sessionId: "STK-001",
      confirmedById: "admin-1",
      confirmedByName: "Admin",
      dryRun: false,
    })).rejects.toThrow("row count mismatch");
  });

  it("rejects a result whose dry-run flag differs from the requested operation", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        session_id: "STK-001",
        status: "CONFIRMED",
        dry_run: false,
        ledger_count: 0,
        rows: [],
        ledger_ids: [],
        plan_hash: "dry-run-mismatch-hash",
      },
      error: null,
    });

    await expect(stocktakeTransaction.applyStocktakeSessionAtomic({
      sessionId: "STK-001",
      confirmedById: "admin-1",
      confirmedByName: "Admin",
      dryRun: true,
    })).rejects.toThrow("dry-run mismatch");
  });

  it("returns a stable preview hash and passes it back for an apply", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        session_id: "STK-001",
        status: "OPEN",
        dry_run: true,
        ledger_count: 0,
        rows: [],
        ledger_ids: [],
        plan_hash: "stable-preview-hash",
      },
      error: null,
    });

    const result = await stocktakeTransaction.applyStocktakeSessionAtomic({
      sessionId: "STK-001",
      confirmedById: "admin-1",
      confirmedByName: "Admin",
      dryRun: true,
    });

    expect(result.planHash).toBe("stable-preview-hash");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_stocktake_session_atomic", {
      p_session_id: "STK-001",
      p_confirmed_by_id: "admin-1",
      p_confirmed_by_name: "Admin",
      p_dry_run: true,
      p_expected_plan_hash: null,
    });
  });
});
