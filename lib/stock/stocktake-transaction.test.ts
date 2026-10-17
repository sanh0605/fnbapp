import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));

vi.mock("@/lib/db/supabase", () => ({
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

  // Plan D D5 (S2): an ingredient with a partial count is reported
  // separately from rows, since it writes nothing -- rows' own contract
  // (ledgerCount + issueCount === rows.length) would break if a skipped
  // ingredient were folded in there instead.
  it("parses skippedIngredients separately from rows, and defaults to empty when absent", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        session_id: "STK-001",
        status: "OPEN",
        dry_run: true,
        ledger_count: 0,
        issue_count: 0,
        rows: [],
        ledger_ids: [],
        issue_ids: [],
        skipped_ingredients: [{ ingredient_id: "ING-003", reason: "not_every_purchased_item_counted" }],
        plan_hash: "skip-hash",
      },
      error: null,
    });

    const result = await stocktakeTransaction.applyStocktakeSessionAtomic({
      sessionId: "STK-001",
      confirmedById: "admin-1",
      confirmedByName: "Admin",
      dryRun: true,
    });

    expect(result.skippedIngredients).toEqual([
      { ingredientId: "ING-003", reason: "not_every_purchased_item_counted" },
    ]);
  });

  it("parses an ingredient-correction row (from an aggregated purchased-item count) like any other row", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        session_id: "STK-001",
        status: "OPEN",
        dry_run: true,
        ledger_count: 1,
        issue_count: 1,
        rows: [
          {
            line_id: "SKL-00001",
            item_reference: "SPM-033",
            counted_qty: 1000,
            theoretical_at_count: 4100,
            current_theoretical_qty: 4100,
            count_variance: -3100,
            projected_qty: 1000,
          },
          {
            line_id: null,
            item_reference: "ING-028",
            counted_qty: 1000,
            theoretical_at_count: 4100,
            current_theoretical_qty: 4100,
            count_variance: -3100,
            projected_qty: 1000,
          },
        ],
        ledger_ids: ["STK-004"],
        issue_ids: ["ISS-00001"],
        skipped_ingredients: [],
        plan_hash: "dau-say-hash",
      },
      error: null,
    });

    const result = await stocktakeTransaction.applyStocktakeSessionAtomic({
      sessionId: "STK-001",
      confirmedById: "admin-1",
      confirmedByName: "Admin",
      dryRun: true,
    });

    expect(result.ledgerCount + result.issueCount).toBe(result.rows.length);
    const ingredientRow = result.rows.find(r => r.itemReference === "ING-028");
    expect(ingredientRow?.countVariance).toBe(-3100);
    expect(ingredientRow?.projectedQty).toBe(1000);
  });
});

describe("recomputed book on confirm (BR-INV-017)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  // Sữa tươi counted 8 at 15:00, frozen book 10; a slip of 2 dated 14:00 was entered afterwards.
  it("passes through the lines whose book figure changed since the count (Sữa tươi 10 -> 8, nothing written)", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        session_id: "STK-001",
        status: "CONFIRMED",
        dry_run: false,
        ledger_count: 0,
        issue_count: 0,
        rows: [],
        issue_ids: [],
        skipped_ingredients: [],
        recomputed_lines: [
          { line_id: "SKL-00001", item_reference: "SPM-001", frozen_qty: 10, recomputed_qty: 8 },
        ],
        plan_hash: "recompute-hash",
      },
      error: null,
    });

    const result = await stocktakeTransaction.applyStocktakeSessionAtomic({
      sessionId: "STK-001",
      confirmedById: "admin-1",
      confirmedByName: "Admin",
      dryRun: false,
      expectedPlanHash: "recompute-hash",
    });

    expect(result.rows).toEqual([]);
    expect(result.recomputedLines).toEqual([
      { lineId: "SKL-00001", itemReference: "SPM-001", frozenQty: 10, recomputedQty: 8 },
    ]);
  });

  it("defaults recomputedLines to empty when the function does not send them (the old function)", async () => {
    mocks.rpc.mockResolvedValue({
      data: { session_id: "STK-001", status: "OPEN", dry_run: true, ledger_count: 0, issue_count: 0, rows: [], plan_hash: "h" },
      error: null,
    });
    const result = await stocktakeTransaction.applyStocktakeSessionAtomic({
      sessionId: "STK-001", confirmedById: "admin-1", confirmedByName: "Admin", dryRun: true,
    });
    expect(result.recomputedLines).toEqual([]);
  });
});

describe("reverseStocktakeSessionAtomic (Plan D D14, U1-U8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("parses a reversal with an issue-level compensating row", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        session_id: "STK-004",
        status: "REVERSED",
        reason: "Đếm nhầm, đã đếm lại",
        reversed_by_id: "admin-1",
        reversed_by_name: "Admin",
        reversed_at: "2026-08-09T10:00:00Z",
        issue_count: 1,
        issue_ids: ["ISS-00002"],
      },
      error: null,
    });

    const result = await stocktakeTransaction.reverseStocktakeSessionAtomic({
      sessionId: "STK-004",
      reason: "Đếm nhầm, đã đếm lại",
      reversedById: "admin-1",
      reversedByName: "Admin",
    });

    expect(result.status).toBe("REVERSED");
    expect(result.issueIds).toEqual(["ISS-00002"]);
    expect(mocks.rpc).toHaveBeenCalledWith("reverse_stocktake_session_atomic", {
      p_session_id: "STK-004",
      p_reason: "Đếm nhầm, đã đếm lại",
      p_reversed_by_id: "admin-1",
      p_reversed_by_name: "Admin",
    });
  });

  it("rejects an RPC result that is not actually REVERSED", async () => {
    mocks.rpc.mockResolvedValue({
      data: { session_id: "STK-004", status: "CONFIRMED" },
      error: null,
    });

    await expect(stocktakeTransaction.reverseStocktakeSessionAtomic({
      sessionId: "STK-004",
      reason: "test",
      reversedById: "admin-1",
      reversedByName: "Admin",
    })).rejects.toThrow("invalid result");
  });

  it("propagates the RPC's own refusal message (e.g. U2/U3/U4/U5 guards) rather than swallowing it", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Chi phien da ap dung gan nhat (STK-005) moi duoc huy, khong phai STK-004" },
    });

    await expect(stocktakeTransaction.reverseStocktakeSessionAtomic({
      sessionId: "STK-004",
      reason: "test",
      reversedById: "admin-1",
      reversedByName: "Admin",
    })).rejects.toThrow("STK-005");
  });
});

describe("editConfirmedStocktakeAtomic (BR-INV-012)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends snake_case lines and maps the result to camelCase", async () => {
    mocks.rpc.mockResolvedValue({
      data: { session_id: "STK-001", changed_count: 1, issue_ids: ["ISS-00004"] },
      error: null,
    });

    const result = await stocktakeTransaction.editConfirmedStocktakeAtomic({
      sessionId: "STK-001",
      lines: [{ lineId: "SKL-00004", countedQty: 5000 }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith("edit_confirmed_stocktake_atomic", {
      p_session_id: "STK-001",
      p_lines: [{ line_id: "SKL-00004", counted_qty: 5000 }],
    });
    expect(result).toEqual({ sessionId: "STK-001", changedCount: 1, issueIds: ["ISS-00004"] });
  });

  it("keeps the database message on an rpc error, prefixed like the other adapters", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Chỉ sửa được phiếu kiểm kê mới nhất (STK-002), không phải STK-001" } });

    await expect(stocktakeTransaction.editConfirmedStocktakeAtomic({
      sessionId: "STK-001",
      lines: [{ lineId: "SKL-00004", countedQty: 5000 }],
    })).rejects.toThrow(/^Chỉ sửa được phiếu kiểm kê mới nhất \(STK-002\), không phải STK-001$/);
  });
});

describe("openStocktakeSessionAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends only item_reference per line (no item_type) and an empty p_notes", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "STK-001", status: "OPEN" }, error: null });
    await stocktakeTransaction.openStocktakeSessionAtomic({
      createdById: "u1", createdByName: "Admin", items: [{ itemReference: "SPM-001" }],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("open_stocktake_session_atomic", {
      p_created_by_id: "u1", p_created_by_name: "Admin",
      p_items: [{ item_reference: "SPM-001" }], p_notes: "",
    });
  });
});
