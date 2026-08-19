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
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllWhere: mocks.findAllWhere,
  insert: mocks.insert,
  update: mocks.update,
  updateMany: mocks.updateMany,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import * as actions from "./actions";

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

  it("still creates the conversion for a RAW item carrying base_ingredient_id, unaffected by the relaxed gate", async () => {
    const formData = new FormData();
    formData.set("name", "Sữa tươi Vinamilk");
    formData.set("item_category_id", "NHH-001");
    formData.set("base_ingredient_id", "ING-020");
    formData.set("base_unit", "U-ML");
    formData.set("units_json", JSON.stringify([{ name: "U-HOP", conversion_rate: "1000" }]));

    const res = await actions.addPurchasedItem(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Purchased_Items",
      expect.objectContaining({ base_ingredient_id: "ING-020" }),
    );
    expect(mocks.insert).toHaveBeenCalledWith(
      "UOM_Conversions",
      expect.objectContaining({ base_unit: "U-ML", conversion_rate: "1000" }),
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
});
