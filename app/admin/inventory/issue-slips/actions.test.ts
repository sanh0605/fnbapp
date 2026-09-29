import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  revalidatePath: vi.fn(),
  createIssueSlipAtomic: vi.fn(),
  cancelIssueSlipAtomic: vi.fn(),
  editIssueSlipAtomic: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/stock/manual-issue-transaction", () => ({
  createIssueSlipAtomic: mocks.createIssueSlipAtomic,
  cancelIssueSlipAtomic: mocks.cancelIssueSlipAtomic,
  editIssueSlipAtomic: mocks.editIssueSlipAtomic,
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
    // section 4: on-hand now gates the picker, so this test (about package
    // lines, not stock) needs a real purchase behind it to survive that
    // filter -- otherwise it silently tests nothing, exactly the failure
    // mode section 5's own tests exist to prove doesn't happen quietly.
    mocks.findAllNoCache.mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([{ purchase_order_id: "PO-1", purchased_item_id: "SPM-033", base_quantity: 1000 }]);
      }
      if (sheet === "Purchase_Orders") return Promise.resolve([{ id: "PO-1", status: "COMPLETED" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const items = await issueSlipActions.getIssueSlipFormData();

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("SPM-033");
    expect(items[0].packageLines.map(p => p.sizeLabel)).toEqual(["Túi 100 g", "Túi 500 g"]); // C8: inactive excluded
  });

  // section 1.3/1.7: this screen used to check the linked base_ingredient's
  // own flag, which a bag or a plastic spoon has no way to carry (they have
  // no base_ingredient_id at all) -- so all 7 of them stayed offered here
  // despite being excluded from stocktake. On-hand is given deliberately
  // (matching "drops an item with zero on-hand" below): without it every
  // item here reads onHand=0 and gets filtered by that unrelated check
  // regardless of is_non_inventory, which would make this test pass for the
  // wrong reason. Confirmed red against the pre-fix code before this task
  // started -- Túi rác appeared in the returned list, a wrong VALUE (the
  // list already existed and already excluded other things), not a missing
  // function.
  it("excludes an item flagged is_non_inventory on itself, with no linked ingredient group at all -- a bag or a spoon", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-BAG", name: "Túi rác", base_ingredient_id: "", default_unit_id: "U-CAI", status: "ACTIVE", is_non_inventory: true },
          { id: "SPM-CUP", name: "Ly giấy", base_ingredient_id: "", default_unit_id: "U-CAI", status: "ACTIVE", is_non_inventory: false },
        ]);
      }
      if (sheet === "UOM_Conversions") {
        return Promise.resolve([
          { id: "CONV-BAG", purchased_item_id: "SPM-BAG", purchased_unit: "U-CAI", base_unit: "U-CAI", conversion_rate: 1, status: "ACTIVE" },
          { id: "CONV-CUP", purchased_item_id: "SPM-CUP", purchased_unit: "U-CAI", base_unit: "U-CAI", conversion_rate: 1, status: "ACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([{ id: "U-CAI", name: "Cái" }]);
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAllNoCache.mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([
          { purchase_order_id: "PO-1", purchased_item_id: "SPM-BAG", base_quantity: 500 },
          { purchase_order_id: "PO-1", purchased_item_id: "SPM-CUP", base_quantity: 500 },
        ]);
      }
      if (sheet === "Purchase_Orders") return Promise.resolve([{ id: "PO-1", status: "COMPLETED" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const items = await issueSlipActions.getIssueSlipFormData();

    expect(items.map(i => i.id)).toEqual(["SPM-CUP"]);
  });

  // The group flag alone (no item flag, no linked purchased item at all in
  // this test) is no longer read by this screen -- replaced, not merely
  // supplemented, per plan section 1.4's own distinction from the stocktake
  // screen. Base_Ingredients is not even fetched anymore (see
  // getIssueSlipFormData), so this is really asserting the source read.
  it("no longer reads Base_Ingredients at all", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    expect(source).not.toContain("Base_Ingredients");
    expect(source).not.toContain("nonInventoryBaseIngredientIds");
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

  // section 4: offering a zero-stock item offers something the RPC will
  // always refuse. Filtered here, in the issue-slip screen itself -- see
  // the stocktake side of this same test in
  // app/admin/inventory/stocktake/actions.test.ts, which must NOT filter
  // the same way.
  it("drops an item with zero on-hand, keeps a sibling that still has stock", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-HAS", name: "Còn tồn", base_ingredient_id: "ING-A", default_unit_id: "U-G", status: "ACTIVE" },
          { id: "SPM-EMPTY", name: "Hết tồn", base_ingredient_id: "ING-B", default_unit_id: "U-G", status: "ACTIVE" },
        ]);
      }
      if (sheet === "UOM_Conversions") {
        return Promise.resolve([
          { id: "CONV-HAS", purchased_item_id: "SPM-HAS", purchased_unit: "U-G", base_unit: "U-G", conversion_rate: 1, status: "ACTIVE" },
          { id: "CONV-EMPTY", purchased_item_id: "SPM-EMPTY", purchased_unit: "U-G", base_unit: "U-G", conversion_rate: 1, status: "ACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([{ id: "U-G", name: "g" }]);
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAllNoCache.mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([{ purchase_order_id: "PO-1", purchased_item_id: "SPM-HAS", base_quantity: 500 }]);
      }
      if (sheet === "Purchase_Orders") return Promise.resolve([{ id: "PO-1", status: "COMPLETED" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const items = await issueSlipActions.getIssueSlipFormData();

    expect(items.map(i => i.id)).toEqual(["SPM-HAS"]);
  });

  // section 3.1/4: equipment leaves through the asset register, never
  // through a stock issue. Today (pre-fix) this list has 65 equipment
  // items in it -- this test is a wrong VALUE (the list still contains
  // "May danh bot"), not a missing function, since getIssueSlipFormData
  // already existed and already returned a list.
  it("excludes an EQUIPMENT item, keeps a RAW and a CONSUMABLE sibling (section 3.1)", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-COFFEE", name: "Bột cà phê", base_ingredient_id: "ING-A", item_category_id: "NHH-001", status: "ACTIVE" },
          { id: "SPM-CUP", name: "Ly giấy", base_ingredient_id: "", item_category_id: "NHH-002", status: "ACTIVE" },
          { id: "SPM-MACHINE", name: "Máy đánh bọt", base_ingredient_id: "", item_category_id: "NHH-003", status: "ACTIVE" },
        ]);
      }
      if (sheet === "UOM_Conversions") {
        return Promise.resolve([
          { id: "CONV-1", purchased_item_id: "SPM-COFFEE", purchased_unit: "U-G", base_unit: "U-G", conversion_rate: 1, status: "ACTIVE" },
          { id: "CONV-2", purchased_item_id: "SPM-CUP", purchased_unit: "U-CAI", base_unit: "U-CAI", conversion_rate: 1, status: "ACTIVE" },
          { id: "CONV-3", purchased_item_id: "SPM-MACHINE", purchased_unit: "U-CAI", base_unit: "U-CAI", conversion_rate: 1, status: "ACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([{ id: "U-G", name: "g" }, { id: "U-CAI", name: "Cái" }]);
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Item_Categories") {
        return Promise.resolve([
          { id: "NHH-001", name: "Nguyên liệu", system_type: "RAW" },
          { id: "NHH-002", name: "Vật tư tiêu hao", system_type: "CONSUMABLE" },
          { id: "NHH-003", name: "Dụng cụ", system_type: "EQUIPMENT" },
        ]);
      }
      return Promise.resolve([]);
    });
    mocks.findAllNoCache.mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([
          { purchase_order_id: "PO-1", purchased_item_id: "SPM-COFFEE", base_quantity: 5000 },
          { purchase_order_id: "PO-1", purchased_item_id: "SPM-CUP", base_quantity: 500 },
          { purchase_order_id: "PO-1", purchased_item_id: "SPM-MACHINE", base_quantity: 1 },
        ]);
      }
      if (sheet === "Purchase_Orders") return Promise.resolve([{ id: "PO-1", status: "COMPLETED" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const items = await issueSlipActions.getIssueSlipFormData();

    const ids = items.map(i => i.id);
    expect(ids).not.toContain("SPM-MACHINE");
    expect(ids).toContain("SPM-COFFEE");
    expect(ids).toContain("SPM-CUP");
    expect(ids).toEqual(["SPM-COFFEE", "SPM-CUP"]);
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/issue-slips/ISL-00003");
  });
});

// Real numbers from ISL-00076 (plan 2026-09-29-phieu-xuat, worked example),
// cut down to the two lines the spec edit example touches.
function mockSlipTables() {
  const tables: Record<string, any[]> = {
    Issue_Slips: [
      { id: "ISL-00076", issued_at: "2026-09-28T11:20:00+00:00", note: "Khác", created_by_id: "u1", created_by_name: "tuyen2612", created_at: "2026-09-28T11:21:00+00:00" },
    ],
    Stock_Issues: [
      { id: "ISS-00192", purchased_item_id: "SPM-038", issued_at: "2026-09-28T11:20:00+00:00", base_quantity: 2000, source: "MANUAL", session_id: null, note: "Khác", reverses_issue_id: null, issue_slip_id: "ISL-00076" },
      { id: "ISS-00196", purchased_item_id: "SPM-050", issued_at: "2026-09-28T11:20:00+00:00", base_quantity: 1, source: "MANUAL", session_id: null, note: "Khác", reverses_issue_id: null, issue_slip_id: "ISL-00076" },
    ],
    stocktake_sessions: [],
    Purchase_Orders: [{ id: "PO-1", status: "COMPLETED", transaction_date: "2026-09-01T00:00:00+00:00" }],
    Purchase_Order_Lines: [
      { id: "POL-1", purchase_order_id: "PO-1", purchased_item_id: "SPM-038", base_quantity: 40000, subtotal: 1472123 },
      { id: "POL-2", purchase_order_id: "PO-1", purchased_item_id: "SPM-050", base_quantity: 5, subtotal: 182023 },
    ],
    Purchased_Items: [
      { id: "SPM-038", name: "Sữa yến mạch Oatside", is_non_inventory: false },
      { id: "SPM-050", name: "Giấy lót chống tràn", is_non_inventory: false },
    ],
    Item_Categories: [],
    UOM_Conversions: [
      { id: "C1", purchased_item_id: "SPM-038", purchased_unit: "U-HOP", base_unit: "U-ML", conversion_rate: 1000, status: "ACTIVE" },
      { id: "C2", purchased_item_id: "SPM-050", purchased_unit: "U-XAP", base_unit: "U-XAP", conversion_rate: 1, status: "ACTIVE" },
    ],
    Units: [
      { id: "U-HOP", name: "Hộp" }, { id: "U-ML", name: "ml" }, { id: "U-XAP", name: "Xấp" },
    ],
  };
  mocks.findAll.mockImplementation((t: string) => Promise.resolve(tables[t] ?? []));
  mocks.findAllNoCache.mockImplementation((t: string) => Promise.resolve(tables[t] ?? []));
  return tables;
}

describe("getIssueSlipsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("lists the slip with its reason and creator", async () => {
    mockSlipTables();
    const page = await issueSlipActions.getIssueSlipsPage({});
    expect(page.total).toBe(1);
    expect(page.rows[0]).toMatchObject({ id: "ISL-00076", kind: "SLIP", reason: "Khác", createdByName: "tuyen2612" });
  });

  it("throws when the caller is not allowed", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Không có quyền" });
    await expect(issueSlipActions.getIssueSlipsPage({})).rejects.toThrow("Không có quyền");
  });
});

describe("getIssueSlipDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("returns null for a slip that does not exist", async () => {
    mockSlipTables();
    expect(await issueSlipActions.getIssueSlipDetail("ISL-99999")).toBeNull();
  });

  it("returns the slip's active lines in package units", async () => {
    mockSlipTables();
    const detail = await issueSlipActions.getIssueSlipDetail("ISL-00076");
    expect(detail?.lines.map(l => [l.issueId, l.name, l.quantityText])).toEqual([
      ["ISS-00192", "Sữa yến mạch Oatside", "2 Hộp (2.000 ml)"],
      ["ISS-00196", "Giấy lót chống tràn", "1 Xấp"],
    ]);
    expect(detail?.canEdit).toBe(true);
  });

  it("throws when the caller is not allowed", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Không có quyền" });
    await expect(issueSlipActions.getIssueSlipDetail("ISL-00076")).rejects.toThrow("Không có quyền");
  });
});

describe("editIssueSlip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
    mockSlipTables();
  });

  const unchangedDraft = [
    { issueId: "ISS-00192", purchasedItemId: "SPM-038", baseQuantity: 2000, removed: false },
    { issueId: "ISS-00196", purchasedItemId: "SPM-050", baseQuantity: 1, removed: false },
  ];

  it("refuses an unchanged draft without calling the RPC", async () => {
    const res = await issueSlipActions.editIssueSlip({ slipId: "ISL-00076", draft: unchangedDraft });
    expect(res.error).toBe("Chưa có thay đổi nào.");
    expect(mocks.editIssueSlipAtomic).not.toHaveBeenCalled();
  });

  it("spec example: drop Giấy lót, Oatside 2.000 -> 1.000 ml sends remove, replace and add", async () => {
    mocks.editIssueSlipAtomic.mockResolvedValue({ slipId: "ISL-00076", removed: [], added: [] });
    const res = await issueSlipActions.editIssueSlip({
      slipId: "ISL-00076",
      draft: [
        { issueId: "ISS-00192", purchasedItemId: "SPM-038", baseQuantity: 1000, removed: false },
        { issueId: "ISS-00196", purchasedItemId: "SPM-050", baseQuantity: 1, removed: true },
      ],
    });
    expect(res.error).toBeUndefined();
    expect(mocks.editIssueSlipAtomic).toHaveBeenCalledWith({
      slipId: "ISL-00076",
      removeIssueIds: ["ISS-00196"],
      replaceIssueIds: ["ISS-00192"],
      addLines: [{ purchasedItemId: "SPM-038", baseQuantity: 1000 }],
      createdById: "admin-1",
      createdByName: "Admin",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/issue-slips");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/issue-slips/ISL-00076");
  });

  it("does not trust a line the slip does not own", async () => {
    const res = await issueSlipActions.editIssueSlip({
      slipId: "ISL-00076",
      draft: [{ issueId: "ISS-00001", purchasedItemId: "SPM-038", baseQuantity: 5, removed: false }],
    });
    expect(res.error).toContain("không thuộc phiếu này");
    expect(mocks.editIssueSlipAtomic).not.toHaveBeenCalled();
  });

  it("refuses a slip with no active line (unknown or cancelled) before the RPC", async () => {
    const res = await issueSlipActions.editIssueSlip({ slipId: "ISL-99999", draft: unchangedDraft });
    expect(res.error).toBeTruthy();
    expect(mocks.editIssueSlipAtomic).not.toHaveBeenCalled();
  });

  it("relays a stock-headroom refusal from the RPC verbatim", async () => {
    mocks.editIssueSlipAtomic.mockRejectedValue(
      new Error("edit_issue_slip_atomic: Không đủ tồn kho cho Sữa yến mạch Oatside: từ ngày phiếu tới nay có lúc kho chỉ còn 500 ml."),
    );
    const res = await issueSlipActions.editIssueSlip({
      slipId: "ISL-00076",
      draft: [
        { issueId: "ISS-00192", purchasedItemId: "SPM-038", baseQuantity: 9000, removed: false },
        { issueId: "ISS-00196", purchasedItemId: "SPM-050", baseQuantity: 1, removed: false },
      ],
    });
    expect(res.error).toContain("có lúc kho chỉ còn 500 ml");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns fail for a caller without permission and never writes", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Không có quyền" });
    const res = await issueSlipActions.editIssueSlip({ slipId: "ISL-00076", draft: unchangedDraft });
    expect(res.error).toBe("Không có quyền");
    expect(mocks.editIssueSlipAtomic).not.toHaveBeenCalled();
  });
});

it.todo("Danh sách lý do xuất do chủ quán tự thêm, sửa, ngừng dùng (spec 2026-09-29 mục 0; 72 trên 78 phiếu chọn Khác)");
