import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  revalidatePath: vi.fn(),
  createManualIssueAtomic: vi.fn(),
  reverseManualIssueAtomic: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/manual-issue-transaction", () => ({
  createManualIssueAtomic: mocks.createManualIssueAtomic,
  reverseManualIssueAtomic: mocks.reverseManualIssueAtomic,
}));

import * as issueSlipActions from "./actions";

describe("getIssueSlipFormData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
    mocks.findAllNoCache.mockResolvedValue([]);
  });

  it("attaches package lines built from UOM_Conversions, one per active conversion", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-033", name: "Dâu sấy", base_ingredient_id: "ING-028", default_unit_id: "U-G", status: "ACTIVE" },
        ]);
      }
      if (sheet === "UOM_Conversions") {
        return Promise.resolve([
          { id: "CONV-1", purchased_item_id: "SPM-033", purchased_unit: "U-TUI", base_unit: "U-G", conversion_rate: 100, status: "ACTIVE" },
          { id: "CONV-2", purchased_item_id: "SPM-033", purchased_unit: "U-TUI", base_unit: "U-G", conversion_rate: 500, status: "ACTIVE" },
          { id: "CONV-3", purchased_item_id: "SPM-033", purchased_unit: "U-TUI", base_unit: "U-G", conversion_rate: 1000, status: "INACTIVE" },
        ]);
      }
      if (sheet === "Units") {
        return Promise.resolve([{ id: "U-G", name: "g" }, { id: "U-TUI", name: "Túi" }]);
      }
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const items = await issueSlipActions.getIssueSlipFormData();

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("SPM-033");
    expect(items[0].packageLines.map(p => p.sizeLabel)).toEqual(["Túi 100 g", "Túi 500 g"]); // C8: inactive excluded
  });

  it("excludes daily-expense (is_non_inventory) items, same as the stocktake screen", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-ICE", name: "Đá viên", base_ingredient_id: "NNL-012", default_unit_id: "U-G", status: "ACTIVE" },
        ]);
      }
      if (sheet === "UOM_Conversions") {
        return Promise.resolve([
          { id: "CONV-ICE", purchased_item_id: "SPM-ICE", purchased_unit: "U-BAO", base_unit: "U-G", conversion_rate: 5000, status: "ACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([{ id: "U-G", name: "g" }, { id: "U-BAO", name: "Bao" }]);
      if (sheet === "Base_Ingredients") {
        return Promise.resolve([{ id: "NNL-012", name: "Khoai lang", is_non_inventory: true }]);
      }
      return Promise.resolve([]);
    });

    const items = await issueSlipActions.getIssueSlipFormData();
    expect(items).toEqual([]);
  });

  it("drops an item with no active conversion left to select", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-X", name: "Không còn quy cách", base_ingredient_id: "ING-X", default_unit_id: "U-G", status: "ACTIVE" },
        ]);
      }
      if (sheet === "UOM_Conversions") return Promise.resolve([]);
      if (sheet === "Units") return Promise.resolve([]);
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const items = await issueSlipActions.getIssueSlipFormData();
    expect(items).toEqual([]);
  });
});

describe("createIssueSlip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("refuses a non-positive quantity before ever calling the RPC", async () => {
    const res = await issueSlipActions.createIssueSlip({
      purchasedItemId: "SPM-033",
      baseQuantity: 0,
      issuedAtIso: "2026-08-08T09:00:00.000Z",
      note: "Hao hụt",
    });
    expect(res).toEqual({ error: "Số lượng xuất phải lớn hơn 0" });
    expect(mocks.createManualIssueAtomic).not.toHaveBeenCalled();
  });

  it("refuses an unparseable timestamp before ever calling the RPC", async () => {
    const res = await issueSlipActions.createIssueSlip({
      purchasedItemId: "SPM-033",
      baseQuantity: 500,
      issuedAtIso: "not-a-date",
      note: "Hao hụt",
    });
    expect(res).toEqual({ error: "Thời điểm xuất không hợp lệ" });
    expect(mocks.createManualIssueAtomic).not.toHaveBeenCalled();
  });

  it("forwards a valid slip to the RPC and revalidates on success", async () => {
    mocks.createManualIssueAtomic.mockResolvedValue({
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

    const res = await issueSlipActions.createIssueSlip({
      purchasedItemId: "SPM-033",
      baseQuantity: 500,
      issuedAtIso: "2026-08-08T09:00:00.000Z",
      note: "Hao hụt",
    });

    expect(res.error).toBeUndefined();
    expect(res.result?.issueId).toBe("ISS-00001");
    expect(mocks.createManualIssueAtomic).toHaveBeenCalledWith(expect.objectContaining({
      purchasedItemId: "SPM-033",
      baseQuantity: 500,
      note: "Hao hụt",
      createdById: "admin-1",
      createdByName: "Admin",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/issue-slips");
  });

  it("relays the RPC's own refusal (I4/I5) verbatim, in Vietnamese, naming the shop's own numbers", async () => {
    mocks.createManualIssueAtomic.mockRejectedValue(
      new Error("create_manual_issue_atomic: Xuất 5000 g vượt tồn kho 3600 g của Dâu sấy (SPM-033)"),
    );

    const res = await issueSlipActions.createIssueSlip({
      purchasedItemId: "SPM-033",
      baseQuantity: 5000,
      issuedAtIso: "2026-08-08T09:00:00.000Z",
      note: "",
    });

    expect(res.error).toContain("vượt tồn kho");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("getRecentIssueSlips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
    mocks.findAll.mockResolvedValue([{ id: "SPM-033", name: "Dâu sấy" }]);
  });

  it("derives both directions of the reversal link from the same fetched window, without mutating either row", async () => {
    mocks.findAllWhere.mockResolvedValue([
      { id: "ISS-00002", purchased_item_id: "SPM-033", base_quantity: -500, issued_at: "2026-01-10T09:00:00Z", note: "Đảo phiếu ISS-00001", reverses_issue_id: "ISS-00001" },
      { id: "ISS-00001", purchased_item_id: "SPM-033", base_quantity: 500, issued_at: "2026-01-03T09:00:00Z", note: "Hao hụt", reverses_issue_id: null },
    ]);

    const rows = await issueSlipActions.getRecentIssueSlips();

    expect(mocks.findAllWhere).toHaveBeenCalledWith("Stock_Issues", expect.objectContaining({
      eq: { source: "MANUAL" },
    }));
    const original = rows.find(r => r.id === "ISS-00001")!;
    const reversal = rows.find(r => r.id === "ISS-00002")!;
    expect(original.reversedByIssueId).toBe("ISS-00002");
    expect(original.reversesIssueId).toBeNull();
    expect(reversal.reversesIssueId).toBe("ISS-00001");
    expect(reversal.reversedByIssueId).toBeNull();
  });

  it("a slip with no reversal in either direction shows neither link", async () => {
    mocks.findAllWhere.mockResolvedValue([
      { id: "ISS-00003", purchased_item_id: "SPM-033", base_quantity: 200, issued_at: "2026-01-11T09:00:00Z", note: "", reverses_issue_id: null },
    ]);

    const [row] = await issueSlipActions.getRecentIssueSlips();
    expect(row.reversesIssueId).toBeNull();
    expect(row.reversedByIssueId).toBeNull();
  });
});

describe("reverseIssueSlip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("forwards to reverseManualIssueAtomic and revalidates on success", async () => {
    mocks.reverseManualIssueAtomic.mockResolvedValue({
      reversalIssueId: "ISS-00002",
      ledgerId: "STK-022",
      reversesIssueId: "ISS-00001",
      purchasedItemId: "SPM-033",
      baseIngredientId: "ING-028",
      baseQuantity: -500,
      issuedAt: "2026-01-10T09:00:00Z",
      createdById: "admin-1",
      createdByName: "Admin",
    });

    const res = await issueSlipActions.reverseIssueSlip({ issueId: "ISS-00001", note: "Ghi nhầm" });

    expect(res.error).toBeUndefined();
    expect(mocks.reverseManualIssueAtomic).toHaveBeenCalledWith({
      issueId: "ISS-00001",
      note: "Ghi nhầm",
      createdById: "admin-1",
      createdByName: "Admin",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/issue-slips");
  });

  it("relays the RPC's own refusal (already reversed, or not MANUAL) verbatim", async () => {
    mocks.reverseManualIssueAtomic.mockRejectedValue(
      new Error("reverse_manual_issue_atomic: Phiếu ISS-00001 đã được đảo bởi ISS-00002 trước đó, không đảo hai lần"),
    );

    const res = await issueSlipActions.reverseIssueSlip({ issueId: "ISS-00001", note: "" });
    expect(res.error).toContain("không đảo hai lần");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
