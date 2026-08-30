import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import { createIssueSlipAtomic, reverseManualIssueAtomic, cancelIssueSlipAtomic } from "./manual-issue-transaction";

describe("createIssueSlipAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("calls the RPC with every line, and parses a multi-line result", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        slip_id: "ISL-00001",
        issued_at: "2026-08-08T12:34:38+07:00",
        note: "Don dep cuoi ngay",
        created_by_id: "admin-1",
        created_by_name: "Admin",
        lines: [
          {
            issue_id: "ISS-00001",
            purchased_item_id: "SPM-033", base_ingredient_id: "ING-028",
            base_quantity: 1000, on_hand_after: 3100,
          },
          {
            issue_id: "ISS-00002",
            purchased_item_id: "SPM-014", base_ingredient_id: "ING-009",
            base_quantity: 200, on_hand_after: 1300,
          },
        ],
      },
      error: null,
    });

    const issuedAt = new Date("2026-08-08T12:34:38+07:00");
    const result = await createIssueSlipAtomic({
      issuedAt,
      note: "Don dep cuoi ngay",
      createdById: "admin-1",
      createdByName: "Admin",
      lines: [
        { purchasedItemId: "SPM-033", baseQuantity: 1000 },
        { purchasedItemId: "SPM-014", baseQuantity: 200 },
      ],
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_issue_slip_atomic", {
      p_issued_at: issuedAt.toISOString(),
      p_note: "Don dep cuoi ngay",
      p_created_by_id: "admin-1",
      p_created_by_name: "Admin",
      p_lines: [
        { purchased_item_id: "SPM-033", base_quantity: 1000 },
        { purchased_item_id: "SPM-014", base_quantity: 200 },
      ],
    });
    expect(result.slipId).toBe("ISL-00001");
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toEqual({
      issueId: "ISS-00001",
      purchasedItemId: "SPM-033", baseIngredientId: "ING-028",
      baseQuantity: 1000, onHandAfter: 3100,
    });
  });

  // docs/superpowers/plans/2026-08-30-issue-slips-for-consumables.md section 5:
  // an issue slip naming a consumable succeeds. Today (pre-fix) the RPC
  // itself raises "chưa gắn với nguyên liệu gốc, không thể ghi phiếu xuất"
  // before ever returning -- this test is at the parser boundary, one layer
  // up, and proves the other half: once the RPC does return a line with no
  // base_ingredient_id and no ledger_id (a consumable, after the fix), the
  // parser accepts it rather than throwing "invalid line result".
  it("parses a consumable's line -- no base_ingredient_id, no ledger_id, RPC succeeds", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        slip_id: "ISL-00002",
        issued_at: "2026-08-30T09:00:00+07:00",
        note: "Ly + nap ban combo",
        created_by_id: "admin-1",
        created_by_name: "Admin",
        lines: [
          {
            issue_id: "ISS-00003",
            purchased_item_id: "SPM-CUP", base_ingredient_id: null,
            base_quantity: 50, on_hand_after: 450,
          },
        ],
      },
      error: null,
    });

    const result = await createIssueSlipAtomic({
      issuedAt: new Date("2026-08-30T09:00:00+07:00"),
      note: "Ly + nap ban combo",
      createdById: "admin-1",
      createdByName: "Admin",
      lines: [{ purchasedItemId: "SPM-CUP", baseQuantity: 50 }],
    });

    expect(result.lines[0]).toEqual({
      issueId: "ISS-00003",
      purchasedItemId: "SPM-CUP", baseIngredientId: "",
      baseQuantity: 50, onHandAfter: 450,
    });
  });

  it("relays the RPC's own refusal (I10's cumulative check, I4, I5) verbatim, naming the line", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Dòng 2 (Dâu sấy): yêu cầu xuất 1500 g, chỉ còn 1100 g tính tới thời điểm ..." },
    });

    await expect(createIssueSlipAtomic({
      issuedAt: new Date("2026-08-08T12:34:38+07:00"),
      note: "",
      createdById: "admin-1",
      createdByName: "Admin",
      lines: [
        { purchasedItemId: "SPM-033", baseQuantity: 1500 },
        { purchasedItemId: "SPM-033", baseQuantity: 1500 },
      ],
    })).rejects.toThrow("Dòng 2");
  });

  it("rejects a result with no lines rather than returning a half-built slip", async () => {
    mocks.rpc.mockResolvedValue({ data: { slip_id: "ISL-00001", lines: [] }, error: null });

    await expect(createIssueSlipAtomic({
      issuedAt: new Date("2026-08-08T12:34:38+07:00"),
      note: "",
      createdById: "admin-1",
      createdByName: "Admin",
      lines: [{ purchasedItemId: "SPM-033", baseQuantity: 1 }],
    })).rejects.toThrow("invalid result");
  });

  it("rejects a malformed line rather than returning a half-built result", async () => {
    mocks.rpc.mockResolvedValue({
      data: { slip_id: "ISL-00001", lines: [{ purchased_item_id: "SPM-033" }] },
      error: null,
    });

    await expect(createIssueSlipAtomic({
      issuedAt: new Date("2026-08-08T12:34:38+07:00"),
      note: "",
      createdById: "admin-1",
      createdByName: "Admin",
      lines: [{ purchasedItemId: "SPM-033", baseQuantity: 1 }],
    })).rejects.toThrow("invalid line result");
  });
});

describe("reverseManualIssueAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("calls the RPC with the exact fields the migration expects, and parses its result", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        reversal_issue_id: "ISS-00002",
        reverses_issue_id: "ISS-00001",
        purchased_item_id: "SPM-033",
        base_ingredient_id: "ING-028",
        base_quantity: -500,
        issued_at: "2026-08-08T11:21:17+07:00",
        created_by_id: "admin-1",
        created_by_name: "Admin",
      },
      error: null,
    });

    const result = await reverseManualIssueAtomic({
      issueId: "ISS-00001",
      note: "Ghi nhầm",
      createdById: "admin-1",
      createdByName: "Admin",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("reverse_manual_issue_atomic", {
      p_issue_id: "ISS-00001",
      p_note: "Ghi nhầm",
      p_created_by_id: "admin-1",
      p_created_by_name: "Admin",
    });
    expect(result).toEqual({
      reversalIssueId: "ISS-00002",
      reversesIssueId: "ISS-00001",
      purchasedItemId: "SPM-033",
      baseIngredientId: "ING-028",
      baseQuantity: -500,
      issuedAt: "2026-08-08T11:21:17+07:00",
      createdById: "admin-1",
      createdByName: "Admin",
    });
  });

  // docs/superpowers/plans/2026-08-30-issue-slips-for-consumables.md section 5:
  // reversal tested on a consumable, not only creation -- and its RPC
  // response no longer carries ledger_id either.
  it("parses a consumable's reversal -- no base_ingredient_id, no ledger_id, RPC succeeds", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        reversal_issue_id: "ISS-00004",
        reverses_issue_id: "ISS-00003",
        purchased_item_id: "SPM-CUP",
        base_ingredient_id: null,
        base_quantity: -50,
        issued_at: "2026-08-30T10:00:00+07:00",
        created_by_id: "admin-1",
        created_by_name: "Admin",
      },
      error: null,
    });

    const result = await reverseManualIssueAtomic({
      issueId: "ISS-00003",
      note: "Ghi nhầm",
      createdById: "admin-1",
      createdByName: "Admin",
    });

    expect(result).toEqual({
      reversalIssueId: "ISS-00004",
      reversesIssueId: "ISS-00003",
      purchasedItemId: "SPM-CUP",
      baseIngredientId: "",
      baseQuantity: -50,
      issuedAt: "2026-08-30T10:00:00+07:00",
      createdById: "admin-1",
      createdByName: "Admin",
    });
  });

  it("relays the RPC's own refusal (already reversed, or not a MANUAL slip) verbatim", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Phiếu ISS-00001 đã được đảo bởi ISS-00002 trước đó, không đảo hai lần" },
    });

    await expect(reverseManualIssueAtomic({
      issueId: "ISS-00001",
      note: "",
      createdById: "admin-1",
      createdByName: "Admin",
    })).rejects.toThrow("không đảo hai lần");
  });

  it("rejects a malformed result rather than returning a half-built object", async () => {
    mocks.rpc.mockResolvedValue({ data: { purchased_item_id: "SPM-033" }, error: null });

    await expect(reverseManualIssueAtomic({
      issueId: "ISS-00001",
      note: "",
      createdById: "admin-1",
      createdByName: "Admin",
    })).rejects.toThrow("invalid result");
  });
});

describe("cancelIssueSlipAtomic (Plan D D14, U9-U12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("calls the RPC and parses every line reversal in the result", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        slip_id: "ISL-00003",
        reason: "Ghi nhầm cả phiếu",
        reversed_count: 2,
        reversals: [
          {
            reversal_issue_id: "ISS-00010",
            reverses_issue_id: "ISS-00005",
            purchased_item_id: "SPM-033",
            base_ingredient_id: "ING-028",
            base_quantity: -300,
            issued_at: "2026-08-09T09:00:00Z",
            created_by_id: "admin-1",
            created_by_name: "Admin",
          },
          {
            reversal_issue_id: "ISS-00011",
            reverses_issue_id: "ISS-00006",
            purchased_item_id: "SPM-034",
            base_ingredient_id: "ING-029",
            base_quantity: -50,
            issued_at: "2026-08-09T09:00:00Z",
            created_by_id: "admin-1",
            created_by_name: "Admin",
          },
        ],
      },
      error: null,
    });

    const result = await cancelIssueSlipAtomic({
      slipId: "ISL-00003",
      reason: "Ghi nhầm cả phiếu",
      createdById: "admin-1",
      createdByName: "Admin",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("cancel_issue_slip_atomic", {
      p_slip_id: "ISL-00003",
      p_reason: "Ghi nhầm cả phiếu",
      p_created_by_id: "admin-1",
      p_created_by_name: "Admin",
    });
    expect(result.reversedCount).toBe(2);
    expect(result.reversals).toHaveLength(2);
    expect(result.reversals[0].reversalIssueId).toBe("ISS-00010");
    expect(result.reversals[1].reversalIssueId).toBe("ISS-00011");
  });

  it("relays the RPC's own refusal when nothing is left to cancel (U11)", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Phiếu ISL-00003 không còn dòng nào để huỷ -- có thể đã được đảo toàn bộ trước đó" },
    });

    await expect(cancelIssueSlipAtomic({
      slipId: "ISL-00003",
      reason: "test",
      createdById: "admin-1",
      createdByName: "Admin",
    })).rejects.toThrow("không còn dòng nào để huỷ");
  });

  it("rejects a malformed result rather than returning a half-built object", async () => {
    mocks.rpc.mockResolvedValue({ data: { slip_id: "ISL-00003" }, error: null });

    await expect(cancelIssueSlipAtomic({
      slipId: "ISL-00003",
      reason: "test",
      createdById: "admin-1",
      createdByName: "Admin",
    })).rejects.toThrow("invalid result");
  });
});
