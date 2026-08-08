import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import { createManualIssueAtomic, reverseManualIssueAtomic } from "./manual-issue-transaction";

describe("createManualIssueAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("calls the RPC with the exact fields the migration expects, and parses its result", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        issue_id: "ISS-00001",
        ledger_id: "STK-021",
        purchased_item_id: "SPM-033",
        base_ingredient_id: "ING-028",
        base_quantity: 500,
        issued_at: "2026-08-08T09:00:00+07:00",
        on_hand_before: 4100,
        on_hand_after: 3600,
        created_by_id: "admin-1",
        created_by_name: "Admin",
      },
      error: null,
    });

    const issuedAt = new Date("2026-08-08T09:00:00+07:00");
    const result = await createManualIssueAtomic({
      purchasedItemId: "SPM-033",
      baseQuantity: 500,
      issuedAt,
      note: "Hao hụt",
      createdById: "admin-1",
      createdByName: "Admin",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_manual_issue_atomic", {
      p_purchased_item_id: "SPM-033",
      p_base_quantity: 500,
      p_issued_at: issuedAt.toISOString(),
      p_note: "Hao hụt",
      p_created_by_id: "admin-1",
      p_created_by_name: "Admin",
    });
    expect(result).toEqual({
      issueId: "ISS-00001",
      ledgerId: "STK-021",
      purchasedItemId: "SPM-033",
      baseIngredientId: "ING-028",
      baseQuantity: 500,
      issuedAt: "2026-08-08T09:00:00+07:00",
      onHandBefore: 4100,
      onHandAfter: 3600,
      createdById: "admin-1",
      createdByName: "Admin",
    });
  });

  it("throws when the RPC reports an error, carrying the RPC's own message", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Xuất 5000 g vượt tồn kho 3600 g" } });

    await expect(createManualIssueAtomic({
      purchasedItemId: "SPM-033",
      baseQuantity: 5000,
      issuedAt: new Date("2026-08-08T09:30:00+07:00"),
      note: "",
      createdById: "admin-1",
      createdByName: "Admin",
    })).rejects.toThrow("vượt tồn kho");
  });

  it("rejects a malformed result rather than returning a half-built object", async () => {
    mocks.rpc.mockResolvedValue({ data: { purchased_item_id: "SPM-033" }, error: null });

    await expect(createManualIssueAtomic({
      purchasedItemId: "SPM-033",
      baseQuantity: 1,
      issuedAt: new Date("2026-08-08T09:00:00+07:00"),
      note: "",
      createdById: "admin-1",
      createdByName: "Admin",
    })).rejects.toThrow("invalid result");
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
        ledger_id: "STK-022",
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
      ledgerId: "STK-022",
      reversesIssueId: "ISS-00001",
      purchasedItemId: "SPM-033",
      baseIngredientId: "ING-028",
      baseQuantity: -500,
      issuedAt: "2026-08-08T11:21:17+07:00",
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
