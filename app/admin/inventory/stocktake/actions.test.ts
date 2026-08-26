import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  revalidatePath: vi.fn(),
  openStocktakeSessionAtomic: vi.fn(),
  saveStocktakeLineAtomic: vi.fn(),
  cancelStocktakeSessionAtomic: vi.fn(),
  applyStocktakeSessionAtomic: vi.fn(),
  reverseStocktakeSessionAtomic: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/stocktake-transaction", () => ({
  openStocktakeSessionAtomic: mocks.openStocktakeSessionAtomic,
  saveStocktakeLineAtomic: mocks.saveStocktakeLineAtomic,
  cancelStocktakeSessionAtomic: mocks.cancelStocktakeSessionAtomic,
  applyStocktakeSessionAtomic: mocks.applyStocktakeSessionAtomic,
  reverseStocktakeSessionAtomic: mocks.reverseStocktakeSessionAtomic,
}));

import * as stocktakeActions from "./actions";

describe("stocktake confirmation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
  });

  it("exposes separate admin actions for preview and explicit confirmation", () => {
    expect(stocktakeActions).toHaveProperty("getStocktakeConfirmPreview");
    expect(stocktakeActions).toHaveProperty("confirmStocktakeSession");
  });

  it("rejects a preview response that is not a dry run", async () => {
    mocks.applyStocktakeSessionAtomic.mockResolvedValue({
      sessionId: "STK-001",
      status: "CONFIRMED",
      dryRun: false,
      ledgerCount: 0,
      rows: [],
      ledgerIds: [],
    });

    // docs/superpowers/plans/2026-08-26-errors-the-owner-can-act-on.md: an
    // internal English assertion is not written for the owner either --
    // wrapped the same as a raw technical exception, detail preserved.
    const result = await stocktakeActions.getStocktakeConfirmPreview("STK-001");
    expect(result.error).toMatch(/Có lỗi xảy ra/);
    expect(result.errorDetail).toBe("Stocktake preview did not return a dry run");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses confirmation without a preview hash before calling the RPC", async () => {
    await expect(stocktakeActions.confirmStocktakeSession("STK-001", "")).resolves.toEqual({
      error: "Stocktake preview is required before confirmation",
    });
    expect(mocks.applyStocktakeSessionAtomic).not.toHaveBeenCalled();
  });
});

describe("startStocktakeSession item list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
  });

  // Plan C Task 3, BR-INV-006 (docs/BUSINESS-RULES.md): semi-products carry
  // no stock and no value, so the count list must not offer them, even
  // though SEMI_PRODUCT stays a legal item_type at the database level
  // (Plan B migration 0052) -- checked by count here, not by eye.
  //
  // Plan D Gap 1 (2026-08-07): BASE_INGREDIENT lines are gone from new
  // sessions entirely -- counting by generic ingredient and counting by
  // purchased item fed different systems (stock_ledger vs stock_issues)
  // with nothing on screen telling them apart. Only PURCHASED_ITEM lines
  // remain.
  it("never includes SEMI_PRODUCT or BASE_INGREDIENT, only PURCHASED_ITEM", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") {
        return Promise.resolve([
          { id: "NNL-001", name: "Sữa tươi", base_unit: "U-ML", is_non_inventory: false },
        ]);
      }
      if (sheet === "Semi_Products") {
        return Promise.resolve([
          { id: "BTP-001", name: "Cốt cà phê", base_unit: "U-ML" },
        ]);
      }
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-001", name: "Sữa tươi TH", base_ingredient_id: "NNL-001", default_unit_id: "U-ML", status: "ACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.openStocktakeSessionAtomic.mockResolvedValue({
      id: "STK-001",
      status: "OPEN",
      created_by_id: "admin-1",
      created_by_name: "Admin",
      created_at: "2026-08-05T00:00:00Z",
      notes: "",
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ success: true });
    expect(mocks.openStocktakeSessionAtomic).toHaveBeenCalledTimes(1);
    const { items } = mocks.openStocktakeSessionAtomic.mock.calls[0][0];
    const itemTypes = items.map((item: { itemType: string }) => item.itemType);

    expect(itemTypes).not.toContain("SEMI_PRODUCT");
    expect(itemTypes).not.toContain("BASE_INGREDIENT");
    expect(itemTypes).toEqual(["PURCHASED_ITEM"]);
    expect(items).toHaveLength(1);
    // ACTIVE items never trigger the C17 purchase/issue lookup.
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
  });

  // 2026-08-21 (docs/superpowers/plans/2026-08-21-non-inventory-purchased-items.md):
  // a CONSUMABLE item has no base_ingredient_id, so the ingredient-side
  // is_non_inventory flag can never reach it -- every consumable was
  // offered for counting regardless of BR-INV-007. This is the item's own
  // flag, additive to the ingredient one already covered above.
  it("excludes a purchased item flagged is_non_inventory on itself, while an unflagged sibling stays offered", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Semi_Products") return Promise.resolve([]);
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-070", name: "Túi rác", base_ingredient_id: "", default_unit_id: "U-BAO", status: "ACTIVE", is_non_inventory: true },
          { id: "SPM-053", name: "Ống hút nhỏ", base_ingredient_id: "", default_unit_id: "U-BAO", status: "ACTIVE", is_non_inventory: false },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.openStocktakeSessionAtomic.mockResolvedValue({
      id: "STK-003", status: "OPEN", created_by_id: "admin-1", created_by_name: "Admin",
      created_at: "2026-08-21T00:00:00Z", notes: "",
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ success: true });
    const { items } = mocks.openStocktakeSessionAtomic.mock.calls[0][0];
    const references = items.map((item: { itemReference: string }) => item.itemReference);

    expect(references).not.toContain("SPM-070");
    expect(references).toContain("SPM-053");
    expect(references).toEqual(["SPM-053"]);
  });

  // C17: an inactive purchased item is not simply dropped -- if it still
  // has stock physically on the shelf, its ingredient's quantity could
  // never be corrected again (S1 needs every purchased item counted).
  it("C17: an inactive purchased item stays offered while its on-hand is still positive", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Semi_Products") return Promise.resolve([]);
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-OLD", name: "Sữa đặc La rosee (ngừng bán)", base_ingredient_id: "ING-003", default_unit_id: "U-ML", status: "INACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAllNoCache.mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([{ purchased_item_id: "SPM-OLD", purchase_order_id: "PO-1", base_quantity: 100 }]);
      }
      if (sheet === "Purchase_Orders") {
        return Promise.resolve([{ id: "PO-1", status: "COMPLETED" }]);
      }
      if (sheet === "Stock_Issues") {
        return Promise.resolve([{ purchased_item_id: "SPM-OLD", base_quantity: 40 }]); // 60 left on hand
      }
      return Promise.resolve([]);
    });
    mocks.openStocktakeSessionAtomic.mockResolvedValue({
      id: "STK-002", status: "OPEN", created_by_id: "admin-1", created_by_name: "Admin",
      created_at: "2026-08-07T00:00:00Z", notes: "",
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ success: true });
    const { items } = mocks.openStocktakeSessionAtomic.mock.calls[0][0];
    expect(items).toEqual([{ itemReference: "SPM-OLD", itemType: "PURCHASED_ITEM" }]);
  });

  it("C17: an inactive purchased item is dropped once its on-hand reaches zero", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Semi_Products") return Promise.resolve([]);
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-GONE", name: "Nguyên liệu đã hết", base_ingredient_id: "ING-999", default_unit_id: "U-ML", status: "INACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAllNoCache.mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([{ purchased_item_id: "SPM-GONE", purchase_order_id: "PO-1", base_quantity: 100 }]);
      }
      if (sheet === "Purchase_Orders") {
        return Promise.resolve([{ id: "PO-1", status: "COMPLETED" }]);
      }
      if (sheet === "Stock_Issues") {
        return Promise.resolve([{ purchased_item_id: "SPM-GONE", base_quantity: 100 }]); // fully issued
      }
      return Promise.resolve([]);
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ error: "Không có mặt hàng nào để kiểm kê" });
    expect(mocks.openStocktakeSessionAtomic).not.toHaveBeenCalled();
  });
});

describe("getStocktakeSessionData package lines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
  });

  // Plan D D6: a PURCHASED_ITEM line must carry one packageLine per ACTIVE
  // conversion, built by the same lib/stocktake-package-lines.ts (D3) the
  // screen renders from -- not a second label generator. Real Dau say
  // conversion shape (three, all named "Tui"), the case the whole
  // package-line model exists for.
  it("attaches one package line per ACTIVE conversion, reusing buildPackageLines", async () => {
    mocks.findAllWhere.mockImplementation((table: string) => {
      if (table === "stocktake_sessions") {
        return Promise.resolve([{ id: "STK-001", status: "OPEN", created_by_name: "Admin", created_at: "2026-08-08T00:00:00Z", notes: "" }]);
      }
      if (table === "stocktake_lines") {
        return Promise.resolve([
          { id: "SKL-00001", session_id: "STK-001", item_reference: "SPM-033", item_type: "PURCHASED_ITEM", counted_qty: null, theoretical_at_count: null, counted_at: null },
        ]);
      }
      return Promise.resolve([]);
    });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([{ id: "ING-028", name: "Dâu sấy", base_unit: "UNT-017", is_non_inventory: false }]);
      if (sheet === "Semi_Products") return Promise.resolve([]);
      if (sheet === "Purchased_Items") return Promise.resolve([{ id: "SPM-033", name: "Dâu sấy", base_ingredient_id: "ING-028", default_unit_id: "U-008", status: "ACTIVE" }]);
      if (sheet === "Units") return Promise.resolve([{ id: "UNT-017", name: "g" }, { id: "U-008", name: "Túi" }]);
      if (sheet === "UOM_Conversions") {
        return Promise.resolve([
          { id: "QD-038", purchased_item_id: "SPM-033", purchased_unit: "U-008", base_unit: "UNT-017", conversion_rate: 100, status: "ACTIVE" },
          { id: "QD-051", purchased_item_id: "SPM-033", purchased_unit: "U-008", base_unit: "UNT-017", conversion_rate: 500, status: "ACTIVE" },
          { id: "QD-043", purchased_item_id: "SPM-033", purchased_unit: "U-008", base_unit: "UNT-017", conversion_rate: 1000, status: "ACTIVE" },
          { id: "QD-999", purchased_item_id: "SPM-033", purchased_unit: "U-008", base_unit: "UNT-017", conversion_rate: 5000, status: "INACTIVE" },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await stocktakeActions.getStocktakeSessionData();

    expect(result?.lines).toHaveLength(1);
    const line = result!.lines[0];
    expect(line.packageLines.map(p => p.sizeLabel)).toEqual(["Túi 100 g", "Túi 500 g", "Túi 1.000 g"]);
    // Inactive conversion (C8) never shows up as a line to count.
    expect(line.packageLines.some(p => p.conversionId === "QD-999")).toBe(false);
  });

  it("gives a legacy BASE_INGREDIENT line an empty packageLines, not a crash", async () => {
    mocks.findAllWhere.mockImplementation((table: string) => {
      if (table === "stocktake_sessions") {
        return Promise.resolve([{ id: "STK-001", status: "OPEN", created_by_name: "Admin", created_at: "2026-08-08T00:00:00Z", notes: "" }]);
      }
      if (table === "stocktake_lines") {
        return Promise.resolve([
          { id: "SKL-legacy", session_id: "STK-001", item_reference: "ING-028", item_type: "BASE_INGREDIENT", counted_qty: null, theoretical_at_count: null, counted_at: null },
        ]);
      }
      return Promise.resolve([]);
    });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([{ id: "ING-028", name: "Dâu sấy", base_unit: "UNT-017", is_non_inventory: false }]);
      if (sheet === "Units") return Promise.resolve([{ id: "UNT-017", name: "g" }]);
      return Promise.resolve([]);
    });

    const result = await stocktakeActions.getStocktakeSessionData();

    expect(result?.lines[0].packageLines).toEqual([]);
  });
});

describe("reverseConfirmedStocktakeSession (Plan D D14, U1-U6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("U6: refuses a non-owner before ever calling the RPC", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" });

    const result = await stocktakeActions.reverseConfirmedStocktakeSession("STK-004", "Đếm nhầm");

    expect(result).toEqual({ error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" });
    expect(mocks.reverseStocktakeSessionAtomic).not.toHaveBeenCalled();
  });

  it("U5: refuses an empty reason before ever calling the RPC", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });

    const result = await stocktakeActions.reverseConfirmedStocktakeSession("STK-004", "   ");

    expect(result.error).toBe("Lý do huỷ phiên kiểm kê là bắt buộc");
    expect(mocks.reverseStocktakeSessionAtomic).not.toHaveBeenCalled();
  });

  it("calls the RPC as the resolved owner actor and relays the result", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
    mocks.reverseStocktakeSessionAtomic.mockResolvedValue({
      sessionId: "STK-004",
      status: "REVERSED",
      reason: "Đếm nhầm",
      reversedById: "admin-1",
      reversedByName: "Admin",
      reversedAt: "2026-08-09T10:00:00Z",
      issueCount: 1,
      ledgerCount: 1,
      issueIds: ["ISS-00002"],
      ledgerIds: ["STK-005"],
    });

    const result = await stocktakeActions.reverseConfirmedStocktakeSession("STK-004", "  Đếm nhầm  ");

    expect(mocks.reverseStocktakeSessionAtomic).toHaveBeenCalledWith({
      sessionId: "STK-004",
      reason: "Đếm nhầm",
      reversedById: "admin-1",
      reversedByName: "Admin",
    });
    expect(result.result?.status).toBe("REVERSED");
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("relays a guard refusal from the RPC itself (e.g. U2/U3/U4) as a plain error, not a thrown exception", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
    // Current RAISE EXCEPTION wording, post-0063 (0062's original was
    // diacritic-free -- fixed by 0063_fix_d14_vietnamese_diacritics.sql).
    // Also exercises docs/superpowers/plans/2026-08-26-errors-the-owner-can-act-on.md's
    // wrapper: a message with real Vietnamese diacritics must relay
    // verbatim, not collapse into the generic sentence.
    mocks.reverseStocktakeSessionAtomic.mockRejectedValue(
      new Error("Đang có một phiên kiểm kê đang mở -- xử lý xong phiên đó trước khi huỷ phiên đã áp dụng"),
    );

    const result = await stocktakeActions.reverseConfirmedStocktakeSession("STK-004", "Đếm nhầm");

    expect(result.error).toContain("đang mở");
  });
});

describe("getLastConfirmedStocktakeSession (Plan D D14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("returns null when there is no confirmed session at all", async () => {
    mocks.findAllWhere.mockResolvedValue([]);

    await expect(stocktakeActions.getLastConfirmedStocktakeSession()).resolves.toBeNull();
  });

  it("reports whether an OPEN session currently blocks reversal (U4)", async () => {
    mocks.findAllWhere.mockImplementation((table: string, opts: any) => {
      if (table === "stocktake_sessions" && opts?.eq?.status === "CONFIRMED") {
        return Promise.resolve([{
          id: "STK-004",
          confirmed_by_name: "Admin",
          confirmed_at: "2026-08-09T10:00:00Z",
          notes: "",
        }]);
      }
      if (table === "stocktake_sessions" && opts?.eq?.status === "OPEN") {
        return Promise.resolve([{ id: "STK-006" }]);
      }
      return Promise.resolve([]);
    });

    const result = await stocktakeActions.getLastConfirmedStocktakeSession();

    expect(result).toEqual({
      id: "STK-004",
      confirmedByName: "Admin",
      confirmedAt: "2026-08-09T10:00:00Z",
      notes: "",
      hasOpenSessionBlocking: true,
    });
  });
});
