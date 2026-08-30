import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  revalidatePath: vi.fn(),
  createIssueSlipAtomic: vi.fn(),
  reverseManualIssueAtomic: vi.fn(),
  cancelIssueSlipAtomic: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/manual-issue-transaction", () => ({
  createIssueSlipAtomic: mocks.createIssueSlipAtomic,
  reverseManualIssueAtomic: mocks.reverseManualIssueAtomic,
  cancelIssueSlipAtomic: mocks.cancelIssueSlipAtomic,
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

  it("refuses an empty line list before ever calling the RPC", async () => {
    const res = await issueSlipActions.createIssueSlip({
      issuedAtIso: "2026-08-08T09:00:00.000Z",
      note: "",
      lines: [],
    });
    expect(res).toEqual({ error: "Phiếu cần ít nhất một dòng" });
    expect(mocks.createIssueSlipAtomic).not.toHaveBeenCalled();
  });

  it("refuses a non-positive quantity on any line, naming which one, before ever calling the RPC", async () => {
    const res = await issueSlipActions.createIssueSlip({
      issuedAtIso: "2026-08-08T09:00:00.000Z",
      note: "",
      lines: [
        { purchasedItemId: "SPM-033", baseQuantity: 500 },
        { purchasedItemId: "SPM-014", baseQuantity: 0 },
      ],
    });
    expect(res).toEqual({ error: "Dòng 2: số lượng phải lớn hơn 0" });
    expect(mocks.createIssueSlipAtomic).not.toHaveBeenCalled();
  });

  it("refuses a line with no item chosen, before ever calling the RPC", async () => {
    const res = await issueSlipActions.createIssueSlip({
      issuedAtIso: "2026-08-08T09:00:00.000Z",
      note: "",
      lines: [{ purchasedItemId: "", baseQuantity: 500 }],
    });
    expect(res).toEqual({ error: "Dòng 1: chưa chọn mặt hàng" });
    expect(mocks.createIssueSlipAtomic).not.toHaveBeenCalled();
  });

  it("refuses an unparseable timestamp before ever calling the RPC", async () => {
    const res = await issueSlipActions.createIssueSlip({
      issuedAtIso: "not-a-date",
      note: "Hao hụt",
      lines: [{ purchasedItemId: "SPM-033", baseQuantity: 500 }],
    });
    expect(res).toEqual({ error: "Thời điểm xuất không hợp lệ" });
    expect(mocks.createIssueSlipAtomic).not.toHaveBeenCalled();
  });

  it("forwards a valid multi-line slip to the RPC and revalidates on success", async () => {
    mocks.createIssueSlipAtomic.mockResolvedValue({
      slipId: "ISL-00001",
      issuedAt: "2026-08-08T09:00:00+07:00",
      note: "Hao hụt",
      createdById: "admin-1",
      createdByName: "Admin",
      lines: [
        { issueId: "ISS-00001", purchasedItemId: "SPM-033", baseIngredientId: "ING-028", baseQuantity: 500, onHandAfter: 3600 },
        { issueId: "ISS-00002", purchasedItemId: "SPM-014", baseIngredientId: "ING-009", baseQuantity: 200, onHandAfter: 1300 },
      ],
    });

    const res = await issueSlipActions.createIssueSlip({
      issuedAtIso: "2026-08-08T09:00:00.000Z",
      note: "Hao hụt",
      lines: [
        { purchasedItemId: "SPM-033", baseQuantity: 500 },
        { purchasedItemId: "SPM-014", baseQuantity: 200 },
      ],
    });

    expect(res.error).toBeUndefined();
    expect(res.result?.slipId).toBe("ISL-00001");
    expect(res.result?.lines).toHaveLength(2);
    expect(mocks.createIssueSlipAtomic).toHaveBeenCalledWith(expect.objectContaining({
      note: "Hao hụt",
      createdById: "admin-1",
      createdByName: "Admin",
      lines: [
        { purchasedItemId: "SPM-033", baseQuantity: 500 },
        { purchasedItemId: "SPM-014", baseQuantity: 200 },
      ],
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/issue-slips");
  });

  it("relays the RPC's own refusal (I4/I5/I10) verbatim, in Vietnamese, naming the line and the shop's own numbers", async () => {
    mocks.createIssueSlipAtomic.mockRejectedValue(
      new Error("create_issue_slip_atomic: Dòng 2 (Dâu sấy): yêu cầu xuất 5000 g, chỉ còn 3600 g tính tới thời điểm ..."),
    );

    const res = await issueSlipActions.createIssueSlip({
      issuedAtIso: "2026-08-08T09:00:00.000Z",
      note: "",
      lines: [
        { purchasedItemId: "SPM-033", baseQuantity: 500 },
        { purchasedItemId: "SPM-033", baseQuantity: 5000 },
      ],
    });

    expect(res.error).toContain("Dòng 2");
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
      { id: "ISS-00002", purchased_item_id: "SPM-033", base_quantity: -500, issued_at: "2026-01-10T09:00:00Z", note: "Đảo phiếu ISS-00001", reverses_issue_id: "ISS-00001", issue_slip_id: null },
      { id: "ISS-00001", purchased_item_id: "SPM-033", base_quantity: 500, issued_at: "2026-01-03T09:00:00Z", note: "Hao hụt", reverses_issue_id: null, issue_slip_id: "ISL-00001" },
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
      { id: "ISS-00003", purchased_item_id: "SPM-033", base_quantity: 200, issued_at: "2026-01-11T09:00:00Z", note: "", reverses_issue_id: null, issue_slip_id: "ISL-00002" },
    ]);

    const [row] = await issueSlipActions.getRecentIssueSlips();
    expect(row.reversesIssueId).toBeNull();
    expect(row.reversedByIssueId).toBeNull();
  });

  it("D9: carries slipId so the screen can group a multi-line slip's rows together", async () => {
    mocks.findAllWhere.mockResolvedValue([
      { id: "ISS-00001", purchased_item_id: "SPM-033", base_quantity: 500, issued_at: "2026-08-08T09:00:00Z", note: "Hao hụt", reverses_issue_id: null, issue_slip_id: "ISL-00001" },
      { id: "ISS-00002", purchased_item_id: "SPM-014", base_quantity: 200, issued_at: "2026-08-08T09:00:00Z", note: "Hao hụt", reverses_issue_id: null, issue_slip_id: "ISL-00001" },
    ]);

    const rows = await issueSlipActions.getRecentIssueSlips();
    expect(rows.every(r => r.slipId === "ISL-00001")).toBe(true);
  });

  it("D9: a legacy row with no issue_slip_id (written before this migration) still parses, slipId null", async () => {
    mocks.findAllWhere.mockResolvedValue([
      { id: "ISS-00000", purchased_item_id: "SPM-033", base_quantity: 100, issued_at: "2026-08-01T09:00:00Z", note: "", reverses_issue_id: null, issue_slip_id: null },
    ]);

    const [row] = await issueSlipActions.getRecentIssueSlips();
    expect(row.slipId).toBeNull();
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

describe("cancelIssueSlip (Plan D D14, U9-U12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("U12: MANAGER is accepted -- same requireAdmin() level as the per-line reversal, not owner-only", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "mgr-1", name: "Manager", role: "MANAGER" } });
    mocks.cancelIssueSlipAtomic.mockResolvedValue({
      slipId: "ISL-00003",
      reason: "Ghi nhầm cả phiếu",
      reversedCount: 2,
      reversals: [],
    });

    const res = await issueSlipActions.cancelIssueSlip({ slipId: "ISL-00003", reason: "Ghi nhầm cả phiếu" });

    expect(res.error).toBeUndefined();
    expect(mocks.cancelIssueSlipAtomic).toHaveBeenCalledWith({
      slipId: "ISL-00003",
      reason: "Ghi nhầm cả phiếu",
      createdById: "mgr-1",
      createdByName: "Manager",
    });
  });

  it("refuses an empty reason before ever calling the RPC", async () => {
    const res = await issueSlipActions.cancelIssueSlip({ slipId: "ISL-00003", reason: "   " });

    expect(res.error).toBe("Lý do huỷ phiếu là bắt buộc");
    expect(mocks.cancelIssueSlipAtomic).not.toHaveBeenCalled();
  });

  it("relays the RPC's own refusal when nothing is left to cancel (U11)", async () => {
    mocks.cancelIssueSlipAtomic.mockRejectedValue(
      new Error("cancel_issue_slip_atomic: Phiếu ISL-00003 không còn dòng nào để huỷ -- có thể đã được đảo toàn bộ trước đó"),
    );

    const res = await issueSlipActions.cancelIssueSlip({ slipId: "ISL-00003", reason: "test" });

    expect(res.error).toContain("không còn dòng nào để huỷ");
  });

  it("revalidates the page and returns the reversal count on success", async () => {
    mocks.cancelIssueSlipAtomic.mockResolvedValue({
      slipId: "ISL-00003",
      reason: "Ghi nhầm cả phiếu",
      reversedCount: 2,
      reversals: [],
    });

    const res = await issueSlipActions.cancelIssueSlip({ slipId: "ISL-00003", reason: "Ghi nhầm cả phiếu" });

    expect(res.result?.reversedCount).toBe(2);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/issue-slips");
  });
});
