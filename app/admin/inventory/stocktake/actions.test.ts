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
  editConfirmedStocktakeAtomic: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/stock/stocktake-transaction", () => ({
  openStocktakeSessionAtomic: mocks.openStocktakeSessionAtomic,
  saveStocktakeLineAtomic: mocks.saveStocktakeLineAtomic,
  cancelStocktakeSessionAtomic: mocks.cancelStocktakeSessionAtomic,
  applyStocktakeSessionAtomic: mocks.applyStocktakeSessionAtomic,
  reverseStocktakeSessionAtomic: mocks.reverseStocktakeSessionAtomic,
  editConfirmedStocktakeAtomic: mocks.editConfirmedStocktakeAtomic,
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

    // Per that plan: an
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

  // Plan C Task 3, BR-INV-006 (docs/02-rules/business-rules/inventory.md):
  // the count list must offer only PURCHASED_ITEM lines, checked by count
  // here, not by eye.
  //
  // Plan D Gap 1 (2026-08-07): BASE_INGREDIENT lines are gone from new
  // sessions entirely -- counting by generic ingredient and counting by
  // purchased item fed different systems (stock_ledger vs stock_issues)
  // with nothing on screen telling them apart. Only PURCHASED_ITEM lines
  // remain.
  //
  // 2026-09-28 (migration 0105): semi_products was dropped along with its
  // table -- startStocktakeSession no longer reads it at all, so there is
  // no fixture branch to feed it here any more.
  it("never includes SEMI_PRODUCT or BASE_INGREDIENT, only PURCHASED_ITEM", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") {
        return Promise.resolve([
          { id: "NNL-001", name: "Sữa tươi", base_unit: "U-ML", is_non_inventory: false },
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
    // The dropped table must not even be queried any more.
    expect(mocks.findAll).not.toHaveBeenCalledWith("Semi_Products");
  });

  // section 4: the issue-slip screen was given a zero-stock filter, but
  // deliberately NOT here -- this is the "one test each side" the plan
  // asks for, guarding against that filter being copied into filterByC17
  // (shared with this screen) later. Counting exists precisely to find out
  // the system's zero is wrong, so a zero-stock ACTIVE item must stay
  // offered. See the issue-slip side of this same test in
  // app/admin/inventory/issue-slips/actions.test.ts.
  it("an ACTIVE item with zero on-hand stays offered for counting, unlike the issue-slip picker", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-EMPTY", name: "Hết tồn", base_ingredient_id: "ING-B", default_unit_id: "U-G", status: "ACTIVE" },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.openStocktakeSessionAtomic.mockResolvedValue({
      id: "STK-020", status: "OPEN", created_by_id: "admin-1", created_by_name: "Admin",
      created_at: "2026-08-30T00:00:00Z", notes: "",
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ success: true });
    const { items } = mocks.openStocktakeSessionAtomic.mock.calls[0][0];
    // ACTIVE items skip the C17 lookup entirely (same assertion as the test
    // above) -- on-hand is never even computed for them here, let alone
    // filtered on.
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
    expect(items).toEqual([{ itemReference: "SPM-EMPTY", itemType: "PURCHASED_ITEM" }]);
  });

  // 2026-08-21:
  // a CONSUMABLE item has no base_ingredient_id, so the ingredient-side
  // is_non_inventory flag can never reach it -- every consumable was
  // offered for counting regardless of BR-INV-007. This is the item's own
  // flag, additive to the ingredient one already covered above.
  it("excludes a purchased item flagged is_non_inventory on itself, while an unflagged sibling stays offered", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
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

  // section 3's last check: a flagged group must no longer change
  // eligibility at all, even for an item still linked to it -- proving the
  // blocker on deleting the ingredient groups is actually gone, not just
  // untested. Base_Ingredients here carries is_non_inventory=true on the
  // linked group and the item itself carries no flag of its own -- under
  // the pre-fix code this item would have been excluded; here it must stay
  // offered, identical to what an empty Base_Ingredients table would
  // produce (the flag-move plan already moved the real flag onto every affected item, so this
  // scenario -- item unflagged, group flagged -- no longer exists in
  // production; this test is about the code path, not today's data).
  it("a flagged group no longer excludes its item -- only the item's own flag does", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") {
        return Promise.resolve([
          { id: "NNL-012", name: "Khoai lang", base_unit: "U-KG", is_non_inventory: true },
        ]);
      }
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-052", name: "Khoai lang", base_ingredient_id: "NNL-012", default_unit_id: "U-KG", status: "ACTIVE", is_non_inventory: false },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.openStocktakeSessionAtomic.mockResolvedValue({
      id: "STK-004", status: "OPEN", created_by_id: "admin-1", created_by_name: "Admin",
      created_at: "2026-09-01T00:00:00Z", notes: "",
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ success: true });
    const { items } = mocks.openStocktakeSessionAtomic.mock.calls[0][0];
    const references = items.map((item: { itemReference: string }) => item.itemReference);

    expect(references).toEqual(["SPM-052"]);
  });

  // Per that plan: equipment
  // is excluded by CATEGORY (item_categories.system_type = 'EQUIPMENT'), not
  // by the per-item is_non_inventory flag -- that flag also feeds a future
  // batch-5 expense line (OPEN-ITEMS 59), so ticking it on equipment would
  // double-count. This item's own flag is left false on purpose: the
  // category exclusion must work even when nobody ticked anything.
  //
  // This test is also the stocktake half of that plan's
  // section 4 requirement: the issue-slip picker was given the identical
  // system_type === "EQUIPMENT" test (deliberately, not a second
  // definition), and this screen's own exclusion must stay unmoved by that
  // -- if the two ever get merged into one shared helper, this is the test
  // that would need to start guarding the merge instead of just this
  // screen's own behaviour.
  it("excludes every purchased item whose category is EQUIPMENT, regardless of its own is_non_inventory flag", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
      if (sheet === "Item_Categories") {
        return Promise.resolve([
          { id: "NHH-001", name: "Nguyên liệu", system_type: "RAW" },
          { id: "NHH-002", name: "Vật tư tiêu hao", system_type: "CONSUMABLE" },
          { id: "NHH-003", name: "Dụng cụ", system_type: "EQUIPMENT" },
        ]);
      }
      if (sheet === "Purchased_Items") {
        return Promise.resolve([
          { id: "SPM-078", name: "Muỗng nhựa định lượng 10g", item_category_id: "NHH-003", base_ingredient_id: "", default_unit_id: "", status: "ACTIVE", is_non_inventory: false },
          { id: "SPM-053", name: "Ống hút nhỏ", item_category_id: "NHH-002", base_ingredient_id: "", default_unit_id: "U-BAO", status: "ACTIVE", is_non_inventory: false },
        ]);
      }
      if (sheet === "Units") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.openStocktakeSessionAtomic.mockResolvedValue({
      id: "STK-010", status: "OPEN", created_by_id: "admin-1", created_by_name: "Admin",
      created_at: "2026-08-26T00:00:00Z", notes: "",
    });

    const result = await stocktakeActions.startStocktakeSession();

    expect(result).toEqual({ success: true });
    const { items } = mocks.openStocktakeSessionAtomic.mock.calls[0][0];
    const references = items.map((item: { itemReference: string }) => item.itemReference);

    expect(references).not.toContain("SPM-078");
    expect(references).toEqual(["SPM-053"]);
  });

  // C17: an inactive purchased item is not simply dropped -- if it still
  // has stock physically on the shelf, its ingredient's quantity could
  // never be corrected again (S1 needs every purchased item counted).
  it("C17: an inactive purchased item stays offered while its on-hand is still positive", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Base_Ingredients") return Promise.resolve([]);
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
  // conversion, built by the same lib/stock/stocktake-package-lines.ts (D3) the
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
    expect(line.packageLines.map(p => p.sizeLabel)).toEqual(["Túi 100 g", "Túi 500 g", "Túi 1,000 g"]);
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
    // Also exercises that plan's
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

describe("editing a confirmed stocktake (BR-INV-012)", () => {
  const ADMIN = { ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } };
  const MANAGER = { ok: true, actor: { id: "mgr-1", name: "Quản lý", role: "MANAGER" } };
  const session = (id: string, status: string, confirmedAt: string | null) => ({
    id, status, created_by_name: "Admin", created_at: "2026-08-09T14:00:00Z", notes: "",
    confirmed_by_name: confirmedAt ? "Admin" : null, confirmed_at: confirmedAt, reversed_at: null,
  });
  const lines = [
    { id: "SKL-00007", session_id: "STK-001", item_reference: "SPM-007", item_type: "PURCHASED_ITEM", counted_qty: 1.5, theoretical_at_count: 2 },
    { id: "SKL-00004", session_id: "STK-001", item_reference: "SPM-004", item_type: "PURCHASED_ITEM", counted_qty: 4, theoretical_at_count: 6 },
  ];

  // findAllWhere ignores filters in the shared mock; honour `eq` here.
  function seed(sessions: ReturnType<typeof session>[]) {
    mocks.findAllWhere.mockImplementation((table: string, filters: { eq?: Record<string, string> }) => {
      const rows: any[] = table === "stocktake_sessions" ? sessions : table === "stocktake_lines" ? lines : [];
      return Promise.resolve(rows.filter(r => Object.entries(filters.eq ?? {}).every(([k, v]) => r[k] === v)));
    });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") return Promise.resolve([
        // Live data: default_unit_id is null on every row; the unit comes from the ACTIVE conversion.
        { id: "SPM-004", name: "Bột cà phê truyền thống Phin Đậm", default_unit_id: null },
        { id: "SPM-007", name: "Bột milkfoam muối biển", default_unit_id: null },
      ]);
      if (sheet === "UOM_Conversions") return Promise.resolve([
        { purchased_item_id: "SPM-004", base_unit: "U-2", status: "INACTIVE" },
        { purchased_item_id: "SPM-004", base_unit: "U-1", status: "ACTIVE" },
        { purchased_item_id: "SPM-007", base_unit: "U-1", status: "ACTIVE" },
      ]);
      if (sheet === "Units") return Promise.resolve([{ id: "U-1", name: "g" }, { id: "U-2", name: "kg" }]);
      return Promise.resolve([]);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.requireOwner.mockResolvedValue(ADMIN);
  });

  it("an owner opening the only confirmed session may edit; lines are sorted by name", async () => {
    seed([session("STK-001", "CONFIRMED", "2026-08-09T15:02:24Z")]);
    const view = await stocktakeActions.getStocktakeDetail("STK-001");
    expect(view?.editBlock).toBeNull();
    expect(view?.lines.map(l => l.itemName)).toEqual(["Bột cà phê truyền thống Phin Đậm", "Bột milkfoam muối biển"]);
    expect(view?.lines[0]).toMatchObject({ id: "SKL-00004", unitName: "g", countedQty: 4, theoreticalAtCount: 6 });
  });

  it("a manager sees the session but cannot edit it", async () => {
    mocks.requireAdmin.mockResolvedValue(MANAGER);
    seed([session("STK-001", "CONFIRMED", "2026-08-09T15:02:24Z")]);
    expect((await stocktakeActions.getStocktakeDetail("STK-001"))?.editBlock).toBe("NOT_OWNER");
  });

  it("an older confirmed session is NOT_LATEST", async () => {
    seed([session("STK-001", "CONFIRMED", "2026-08-09T15:02:24Z"), session("STK-002", "CONFIRMED", "2026-09-09T15:02:24Z")]);
    expect((await stocktakeActions.getStocktakeDetail("STK-001"))?.editBlock).toBe("NOT_LATEST");
  });

  it("an open session elsewhere blocks with OPEN_SESSION", async () => {
    seed([session("STK-001", "CONFIRMED", "2026-08-09T15:02:24Z"), session("STK-002", "OPEN", null)]);
    expect((await stocktakeActions.getStocktakeDetail("STK-001"))?.editBlock).toBe("OPEN_SESSION");
  });

  it("a reversed session is NOT_CONFIRMED", async () => {
    seed([session("STK-001", "REVERSED", "2026-08-09T15:02:24Z")]);
    expect((await stocktakeActions.getStocktakeDetail("STK-001"))?.editBlock).toBe("NOT_CONFIRMED");
  });

  it("checks run in order: owner, confirmed, latest, open", async () => {
    mocks.requireAdmin.mockResolvedValue(MANAGER);
    seed([session("STK-001", "REVERSED", "2026-08-09T15:02:24Z"), session("STK-002", "OPEN", null)]);
    expect((await stocktakeActions.getStocktakeDetail("STK-001"))?.editBlock).toBe("NOT_OWNER");
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    expect((await stocktakeActions.getStocktakeDetail("STK-001"))?.editBlock).toBe("NOT_CONFIRMED");
    seed([
      session("STK-001", "CONFIRMED", "2026-08-09T15:02:24Z"),
      session("STK-002", "CONFIRMED", "2026-09-09T15:02:24Z"),
      session("STK-003", "OPEN", null),
    ]);
    expect((await stocktakeActions.getStocktakeDetail("STK-001"))?.editBlock).toBe("NOT_LATEST");
  });

  it("returns null for an unknown id, and an OPEN session as NOT_CONFIRMED", async () => {
    seed([session("STK-002", "OPEN", null)]);
    expect(await stocktakeActions.getStocktakeDetail("STK-999")).toBeNull();
    expect(await stocktakeActions.getStocktakeDetail("STK-002")).toMatchObject({ status: "OPEN", editBlock: "NOT_CONFIRMED" });
  });

  it("refuses a non-owner before ever calling the RPC", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" });
    const result = await stocktakeActions.editConfirmedStocktake("STK-001", [{ lineId: "SKL-00004", countedQty: 5000 }]);
    expect(result).toEqual({ error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" });
    expect(mocks.editConfirmedStocktakeAtomic).not.toHaveBeenCalled();
  });

  it("calls the RPC as the owner, returns changedCount and revalidates the three screens", async () => {
    mocks.editConfirmedStocktakeAtomic.mockResolvedValue({ sessionId: "STK-001", changedCount: 1, issueIds: ["ISS-00004"] });
    const result = await stocktakeActions.editConfirmedStocktake("STK-001", [{ lineId: "SKL-00004", countedQty: 5000 }]);
    expect(mocks.editConfirmedStocktakeAtomic).toHaveBeenCalledWith({
      sessionId: "STK-001", lines: [{ lineId: "SKL-00004", countedQty: 5000 }],
    });
    expect(result).toEqual({ success: true, changedCount: 1 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/stocktake");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/stocktake/STK-001");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/inventory/issue-slips");
  });

  it("refuses a negative or non-finite count and an empty list without calling the RPC", async () => {
    for (const lines of [
      [{ lineId: "SKL-00004", countedQty: -1 }],
      [{ lineId: "SKL-00004", countedQty: Number.NaN }],
      [{ lineId: "SKL-00004", countedQty: Infinity }],
      [],
    ]) {
      const result = await stocktakeActions.editConfirmedStocktake("STK-001", lines);
      expect(result.error).toMatch(/[ạăâêôơưđ]/i);
    }
    expect(mocks.editConfirmedStocktakeAtomic).not.toHaveBeenCalled();
  });

  it("returns the database refusal through describeActionError, Vietnamese text intact", async () => {
    mocks.editConfirmedStocktakeAtomic.mockRejectedValue(
      new Error("Chỉ sửa được phiếu kiểm kê mới nhất (STK-002), không phải STK-001"),
    );
    const result = await stocktakeActions.editConfirmedStocktake("STK-001", [{ lineId: "SKL-00004", countedQty: 5000 }]);
    expect(result.error).toContain("Chỉ sửa được phiếu kiểm kê mới nhất");
  });
});

describe("confirming a stocktake after a late slip (BR-INV-017)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("Khi xác nhận kiểm kê, máy tính lại số trên sổ tại giờ đếm, kể cả phiếu nhập trễ ghi ngày trước giờ đếm, nên không trừ hai lần (chủ quán chốt 14/10/2026)", async () => {
    // Sữa tươi counted 8 at 15:00, frozen book 10; a slip of 2 dated 14:00 entered afterwards:
    // the database recomputes 10 -> 8, writes nothing, and says which line changed.
    const applied = {
      sessionId: "STK-001", status: "CONFIRMED", dryRun: false, ledgerCount: 0, issueCount: 0,
      rows: [], skippedIngredients: [], planHash: "h1", issueIds: [],
      recomputedLines: [{ lineId: "SKL-00001", itemReference: "SPM-001", frozenQty: 10, recomputedQty: 8 }],
    };
    mocks.applyStocktakeSessionAtomic.mockResolvedValue(applied);

    const result = await stocktakeActions.confirmStocktakeSession("STK-001", "h1");

    expect(mocks.applyStocktakeSessionAtomic).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "STK-001", dryRun: false, expectedPlanHash: "h1",
    }));
    expect(result.result?.rows).toEqual([]);
    expect(result.result?.recomputedLines).toEqual([
      { lineId: "SKL-00001", itemReference: "SPM-001", frozenQty: 10, recomputedQty: 8 },
    ]);
  });
});
