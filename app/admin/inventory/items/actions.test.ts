import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", async () => {
  // section 1.4: getCacheTag is the REAL, unmocked function here (via
  // importActual), not a re-typed stand-in -- the source under test and
  // this test file's own assertions both call the one real implementation,
  // so a typo in either can never silently agree with the other.
  const actual = await vi.importActual<typeof import("@/lib/sheets_db")>("@/lib/sheets_db");
  return {
    findAll: mocks.findAll,
    findAllWhere: mocks.findAllWhere,
    insert: mocks.insert,
    update: mocks.update,
    updateMany: mocks.updateMany,
    remove: mocks.remove,
    generateNewId: mocks.generateNewId,
    getCacheTag: actual.getCacheTag,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import * as actions from "./actions";
import { getCacheTag } from "@/lib/sheets_db";

// OPEN-ITEMS 69: this is the exact production incident that started the
// plan -- the owner opened Hàng Mua Vào and it said "Chưa có hàng hóa" while
// 145 rows sat untouched. Both required tests from section 5.
describe("getItemsData -- the production incident this plan exists to fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty result", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(actions.getItemsData()).rejects.toThrow("db down");
  });

  it("a genuinely empty catalogue still resolves with [] and does not throw -- not the same as a real failure", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(actions.getItemsData()).resolves.toEqual({
      categories: [], items: [], conversions: [], units: [], unitLockedItemIds: [],
    });
  });
});

// Batch 1, item B, gates 3/4 (section B1): `if (base_ingredient_id &&
// unitsJson && base_unit)` used to silently drop a consumable's
// conversions, since a consumable never has base_ingredient_id. These
// prove the server side of the fix directly -- end to end against a
// mocked UOM_Conversions insert, the same shape section B4's "confirm the
// uom_conversions row exists with base_unit = g" asks for, without writing
// to production (CLAUDE.md section 2).
describe("addPurchasedItem -- gate 3 of 4, a consumable's conversions are no longer dropped", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockResolvedValue([]); // no existing Purchased_Items -- no duplicate-name conflict
    mocks.generateNewId.mockResolvedValueOnce("SPM-999").mockResolvedValueOnce("QD-999");
  });

  it("creates the UOM_Conversions row for a consumable with no base_ingredient_id sent at all", async () => {
    const formData = new FormData();
    formData.set("name", "Ống hút đen nhọn P6");
    formData.set("item_category_id", "NHH-002");
    // No base_ingredient_id field -- exactly what the real consumable form
    // sends (PurchasedItemForm.tsx's buildConversionSubmission omits it
    // unless isRaw).
    formData.set("base_unit", "U-G");
    formData.set("units_json", JSON.stringify([{ name: "U-BAO", conversion_rate: "500" }]));

    const res = await actions.addPurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "UOM_Conversions",
      expect.objectContaining({
        purchased_item_id: "SPM-999",
        purchased_unit: "U-BAO",
        base_unit: "U-G",
        conversion_rate: "500",
      }),
    );
  });

  it("still creates the conversion for a RAW item, unaffected by the relaxed gate", async () => {
    const formData = new FormData();
    formData.set("name", "Sữa tươi Vinamilk");
    formData.set("item_category_id", "NHH-001");
    formData.set("base_unit", "U-ML");
    formData.set("units_json", JSON.stringify([{ name: "U-HOP", conversion_rate: "1000" }]));

    const res = await actions.addPurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "UOM_Conversions",
      expect.objectContaining({ base_unit: "U-ML", conversion_rate: "1000" }),
    );
  });

  // section 2.1: base_ingredient_id is no longer read from the form or
  // written to the insert payload at all -- the group-link field was
  // removed from the UI in step 1 (2026-09-01), and the column itself is
  // dropped by this task's migration (not yet applied). Creation must
  // still succeed, and never carry the key.
  it("creates a RAW item and never writes base_ingredient_id, even if a stray field is submitted", async () => {
    const formData = new FormData();
    formData.set("name", "Trứng gà mới");
    formData.set("item_category_id", "NHH-001");
    formData.set("base_ingredient_id", "ING-STRAY"); // ignored -- no live form sends this anymore
    formData.set("base_unit", "U-QUA");
    formData.set("units_json", JSON.stringify([{ name: "U-HOP", conversion_rate: "10" }]));

    const res = await actions.addPurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Purchased_Items",
      expect.not.objectContaining({ base_ingredient_id: expect.anything() }),
    );
    const [, payload] = mocks.insert.mock.calls.find(([sheet]) => sheet === "Purchased_Items")!;
    expect(Object.prototype.hasOwnProperty.call(payload, "base_ingredient_id")).toBe(false);
    expect(mocks.insert).toHaveBeenCalledWith(
      "UOM_Conversions",
      expect.objectContaining({ base_unit: "U-QUA", conversion_rate: "10" }),
    );
  });

  it("EQUIPMENT with neither field sent creates no conversion at all", async () => {
    const formData = new FormData();
    formData.set("name", "Máy pha cà phê");
    formData.set("item_category_id", "NHH-003");

    const res = await actions.addPurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).not.toHaveBeenCalledWith("UOM_Conversions", expect.anything());
  });
});

describe("updatePurchasedItem -- gate 4 of 4, same relaxation on the update path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") return Promise.resolve([]);
      if (sheet === "UOM_Conversions") return Promise.resolve([]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    // No purchase/issue history by default -- the unit-lock check (section
    // 4) added 2026-08-29 must not refuse these pre-existing scenarios.
    mocks.findAllWhere.mockResolvedValue([]);
    mocks.generateNewId.mockResolvedValue("QD-998");
  });

  it("creates a new conversion for a consumable being edited, with no base_ingredient_id required", async () => {
    const formData = new FormData();
    formData.set("id", "SPM-043");
    formData.set("name", "Ống hút đen nhọn P6");
    formData.set("item_category_id", "NHH-002");
    formData.set("base_unit", "U-G");
    formData.set("units_json", JSON.stringify([{ name: "U-BAO", conversion_rate: "500" }]));

    const res = await actions.updatePurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "UOM_Conversions",
      expect.objectContaining({ purchased_item_id: "SPM-043", base_unit: "U-G", conversion_rate: "500" }),
    );
  });

  // section 2.2: the link field was removed from the form, so every future
  // edit submits no base_ingredient_id at all. Before this fix, the naive
  // reading (`formData.get("base_ingredient_id") as string`) would coerce
  // that absence to "" and write it -- silently blanking an existing RAW
  // item's group link on every unrelated edit (name, category, unit...).
  // This proves the update payload never carries that key at all, so the
  // existing column value is left untouched by this partial update.
  it("never includes base_ingredient_id in the update payload, even for a RAW item", async () => {
    const formData = new FormData();
    formData.set("id", "SPM-EXISTING-RAW");
    formData.set("name", "Sữa tươi Vinamilk");
    formData.set("item_category_id", "NHH-001");
    // No base_ingredient_id field -- the real form no longer sends one.

    const res = await actions.updatePurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      "Purchased_Items",
      "SPM-EXISTING-RAW",
      expect.not.objectContaining({ base_ingredient_id: expect.anything() }),
    );
    const [, , payload] = mocks.update.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(payload, "base_ingredient_id")).toBe(false);
  });
});

// section 4:
// "the lock is tested, not just the freedom -- a guard nobody tested is a
// guard that will not hold, and this one has no database backstop." Every
// case here is the server-side check, not the client's own derivation --
// proving the refusal survives even a request that bypasses the UI.
describe("updatePurchasedItem -- the unit lock (2026-08-29, no database backstop)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.generateNewId.mockResolvedValue("QD-LOCK");
  });

  function baseFormData(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("id", "SPM-TRAITAC");
    fd.set("name", "Trái tắc");
    fd.set("item_category_id", "NHH-001");
    fd.set("base_unit", "U-KG");
    fd.set("units_json", JSON.stringify([{ name: "U-BAO", conversion_rate: "10" }]));
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("refuses when the item has a purchase_order_lines row and the submitted base unit differs from the one on record", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-TRAI" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([{ id: "POL-1" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") return Promise.resolve([]);
      if (sheet === "Units") return Promise.resolve([{ id: "U-TRAI", name: "trái" }]);
      return Promise.resolve([]);
    });

    const res = await actions.updatePurchasedItem(baseFormData()); // submits U-KG, on record is U-TRAI

    expect(res.error).toContain("trái");
    expect(res.error).toMatch(/Không thể đổi đơn vị gốc/);
    expect(mocks.update).not.toHaveBeenCalledWith("Purchased_Items", "SPM-TRAITAC", expect.anything());
  });

  // The gap identified while critiquing the plan: not a live exposure today
  // (measured 2026-08-29: every item with a stock_issues row also has a
  // purchase_order_lines row), but a stocktake can in principle find stock
  // for an item never purchased, and the shared helper closes it for free.
  it("refuses on a stock_issues row alone, with zero purchase_order_lines rows -- proves both tables are checked, not only purchases", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-TRAI" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([]);
      if (sheet === "Stock_Issues") return Promise.resolve([{ id: "SI-1" }]);
      return Promise.resolve([]);
    });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") return Promise.resolve([]);
      if (sheet === "Units") return Promise.resolve([{ id: "U-TRAI", name: "trái" }]);
      return Promise.resolve([]);
    });

    const res = await actions.updatePurchasedItem(baseFormData());

    expect(res.error).toMatch(/Không thể đổi đơn vị gốc/);
  });

  it("does not refuse when the item has history but the submitted base unit matches what is already on record", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-KG" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([{ id: "POL-1" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await actions.updatePurchasedItem(baseFormData()); // submits U-KG, on record is also U-KG

    expect(res.error).toBeUndefined();
  });

  it("is free to choose any base unit when the item has neither a purchase_order_lines nor a stock_issues row", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-TRAI" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await actions.updatePurchasedItem(baseFormData()); // submits U-KG, on record U-TRAI, but no history

    expect(res.error).toBeUndefined();
  });
});

// Batch 1 follow-up, level 2 (section A3b, BR-CATALOG-001), wired into
// Purchased_Items the same way as Base_Ingredients.
describe("addPurchasedItem -- level 2, diacritic-stripped warning (Batch 1 follow-up)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("SPM-999");
  });

  it("'Ong hut den nhon P6' against an existing 'Ống hút đen nhọn P6' warns, and does not save on decline", async () => {
    mocks.findAll.mockResolvedValue([{ id: "SPM-043", name: "Ống hút đen nhọn P6", status: "ACTIVE" }]);

    const formData = new FormData();
    formData.set("name", "Ong hut den nhon P6");
    formData.set("item_category_id", "NHH-002");

    const res: any = await actions.addPurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(res.needsDuplicateWarning).toBeTruthy();
    expect(res.needsDuplicateWarning.conflictId).toBe("SPM-043");
    expect(mocks.insert).not.toHaveBeenCalledWith("Purchased_Items", expect.anything());

    // "tôi gõ nhầm" -- no resubmission with the confirmation flag, so
    // nothing beyond the warning above is needed to prove decline.
  });

  it("a genuinely different name that strips the same warns, then SAVES on confirmation ('món khác'), recording it", async () => {
    mocks.findAll.mockResolvedValue([{ id: "NNL-009", name: "Thạch dừa", status: "ACTIVE" }]);

    const formData = new FormData();
    formData.set("name", "Thạch dứa");
    formData.set("item_category_id", "NHH-001");
    const warned: any = await actions.addPurchasedItem(formData);
    expect(warned.needsDuplicateWarning).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalledWith("Purchased_Items", expect.anything());

    const confirmedFormData = new FormData();
    confirmedFormData.set("name", "Thạch dứa");
    confirmedFormData.set("item_category_id", "NHH-001");
    confirmedFormData.set("duplicate_warning_confirmed", "true");
    const saved: any = await actions.addPurchasedItem(confirmedFormData);

    expect(saved.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Purchased_Items",
      expect.objectContaining({
        name: "Thạch dứa",
        duplicate_warning_confirmed: true,
        duplicate_warning_confirmed_by: "Admin",
      }),
    );
  });

  it("an exact match (case-fold only, same diacritics) still hits level 1 (refuse), never level 2", async () => {
    mocks.findAll.mockResolvedValue([{ id: "SPM-043", name: "Ống hút đen nhọn P6", status: "ACTIVE" }]);

    const formData = new FormData();
    formData.set("name", "ống hút đen nhọn p6");
    formData.set("item_category_id", "NHH-002");

    const res: any = await actions.addPurchasedItem(formData);

    expect(res.error).toBeTruthy();
    expect(res.needsDuplicateWarning).toBeUndefined();
  });
});

// section 1.3 (rows 5, 7) / section 3: Purchased_Items and UOM_Conversions
// are cached 10 min, keyed by table -- revalidatePath alone only refreshes
// this screen's own path, not the tag other screens (Đơn nhập, Phiếu xuất
// kho, Kiểm kê) read through. Asserted against getCacheTag's real output
// (imported above, unmocked), not a re-typed string -- see the vi.mock
// factory's own comment for why.
//
// Confirmed red twice against the pre-fix code, for the two different
// reasons section 3 asks to distinguish: (1) with the revalidateTag calls
// removed entirely, all three tests below failed on "0 calls" -- a missing
// call, not a wrong value; (2) with deletePurchasedItemAction's call
// changed to the hardcoded, misspelled literal "sheets-Purchased_Item" (one
// letter short of getCacheTag("Purchased_Items")'s real output), that same
// test failed on a wrong VALUE -- proving this assertion style catches
// exactly the silent-typo failure mode section 1.4 warns about, not just
// "was revalidateTag called." Both reverted and diff-verified byte-identical
// before restoring.
describe("addPurchasedItem/updatePurchasedItem/deletePurchasedItemAction -- revalidate the table tag, not just the path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockResolvedValue([]);
    mocks.findAllWhere.mockResolvedValue([]);
    mocks.generateNewId.mockResolvedValue("SPM-999");
  });

  it("addPurchasedItem revalidates sheets-Purchased_Items and sheets-UOM_Conversions", async () => {
    const formData = new FormData();
    formData.set("name", "Trứng gà mới");
    formData.set("item_category_id", "NHH-001");

    const res = await actions.addPurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Purchased_Items"));
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("UOM_Conversions"));
  });

  it("updatePurchasedItem revalidates sheets-Purchased_Items and sheets-UOM_Conversions", async () => {
    const formData = new FormData();
    formData.set("id", "SPM-100");
    formData.set("name", "Trứng gà");
    formData.set("item_category_id", "NHH-001");

    const res = await actions.updatePurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Purchased_Items"));
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("UOM_Conversions"));
  });

  it("deletePurchasedItemAction revalidates sheets-Purchased_Items", async () => {
    const formData = new FormData();
    formData.set("id", "SPM-100");

    const res = await actions.deletePurchasedItemAction(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Purchased_Items"));
  });
});
