import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", async () => {
  // docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
  // section 1.4: getCacheTag is the REAL, unmocked function here (via
  // importActual), so this file's own assertions can never silently drift
  // from what the source under test actually calls.
  const actual = await vi.importActual<typeof import("@/lib/sheets_db")>("@/lib/sheets_db");
  return {
    findAll: mocks.findAll,
    findAllWhere: mocks.findAllWhere,
    insert: mocks.insert,
    update: mocks.update,
    remove: mocks.remove,
    generateNewId: mocks.generateNewId,
    getCacheTag: actual.getCacheTag,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { addConversion, updateConversion, deleteConversionAction, getConversionsData } from "./actions";
import { getCacheTag } from "@/lib/sheets_db";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// docs/superpowers/plans/2026-08-27-stop-reporting-failures-as-empty.md
// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getConversionsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty result", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getConversionsData()).rejects.toThrow("db down");
  });

  it("genuinely empty tables still resolve with [] and do not throw", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(getConversionsData()).resolves.toEqual({ items: [], conversions: [], units: [] });
  });
});

// docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md section 4:
// "addConversion is safe today only because the unit is derived from the
// group, so every row agrees by construction. Removing that derivation
// removes the thing holding it together." addConversion had zero base-unit
// protection of any kind before this task -- these are new coverage, not a
// rewrite of an existing check.
describe("addConversion -- the unit lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("QD-NEW");
  });

  it("refuses a new conversion whose base unit differs from the item's existing one, when the item has a purchase_order_lines row", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-TRAI" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([{ id: "POL-1" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Units") return Promise.resolve([{ id: "U-TRAI", name: "trái" }]);
      return Promise.resolve([]);
    });

    const res = await addConversion(formData({
      purchased_item_id: "SPM-TRAITAC",
      purchased_unit: "U-BAO",
      conversion_rate: "10",
      base_unit: "U-KG", // differs from the item's existing U-TRAI
    }));

    expect(res.error).toContain("trái");
    expect(res.error).toMatch(/Không thể đổi đơn vị gốc/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows a new conversion matching the item's existing base unit -- adding a second purchase-unit row, not changing the base unit", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-KG" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([{ id: "POL-1" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await addConversion(formData({
      purchased_item_id: "SPM-TRAITAC",
      purchased_unit: "U-BAO",
      conversion_rate: "10",
      base_unit: "U-KG",
    }));

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith("UOM_Conversions", expect.objectContaining({ base_unit: "U-KG" }));
  });

  it("is free to choose any base unit for an item with no history at all", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-TRAI" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await addConversion(formData({
      purchased_item_id: "SPM-TRAITAC",
      purchased_unit: "U-BAO",
      conversion_rate: "10",
      base_unit: "U-KG",
    }));

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalled();
  });
});

describe("updateConversion -- the unit lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("refuses editing a conversion's base unit away from what the item's other history already agrees on", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-TRAI" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([{ id: "POL-1" }]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Units") return Promise.resolve([{ id: "U-TRAI", name: "trái" }]);
      return Promise.resolve([]);
    });

    const res = await updateConversion(formData({
      id: "QD-1",
      purchased_item_id: "SPM-TRAITAC",
      purchased_unit: "U-BAO",
      conversion_rate: "10",
      base_unit: "U-KG",
    }));

    expect(res.error).toContain("trái");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows editing other fields (rate, purchase unit) when the base unit itself is unchanged", async () => {
    mocks.findAllWhere.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", base_unit: "U-KG" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([]);
      if (sheet === "Stock_Issues") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", purchased_item_id: "SPM-TRAITAC", purchased_unit: "U-BAO", conversion_rate: "10", base_unit: "U-KG" }]);
      if (sheet === "Purchase_Order_Lines") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const res = await updateConversion(formData({
      id: "QD-1",
      purchased_item_id: "SPM-TRAITAC",
      purchased_unit: "U-BAO",
      conversion_rate: "20", // rate changed, base unit did not
      base_unit: "U-KG",
    }));

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith("UOM_Conversions", "QD-1", expect.objectContaining({ conversion_rate: "20", base_unit: "U-KG" }));
  });
});

// docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
// section 1.3/2: this file is the real, live UOM_Conversions writer --
// PurchasedItemForm.tsx (a different screen) reads UOM_Conversions too, so
// an edit here left that screen stale for up to 10 minutes. This file was
// missed by that plan's own section 1.3 measurement (a dead, unreferenced
// duplicate of addConversion/updateConversion in
// app/admin/inventory/actions.ts was counted in its place); fixed here as
// the same class of bug. Confirmed red against the pre-fix code (before
// revalidateTag was added) on "0 calls" -- a missing call, not a wrong
// value -- then restored.
describe("addConversion/updateConversion/deleteConversionAction -- revalidate sheets-UOM_Conversions, not just the path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("QD-NEW");
    mocks.findAllWhere.mockResolvedValue([]);
    mocks.findAll.mockResolvedValue([]);
  });

  it("addConversion revalidates sheets-UOM_Conversions", async () => {
    const res = await addConversion(formData({
      purchased_item_id: "SPM-TRAITAC",
      purchased_unit: "U-BAO",
      conversion_rate: "10",
      base_unit: "U-KG",
    }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("UOM_Conversions"));
  });

  it("updateConversion revalidates sheets-UOM_Conversions", async () => {
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "UOM_Conversions") return Promise.resolve([{ id: "QD-1", purchased_item_id: "SPM-TRAITAC", purchased_unit: "U-BAO", conversion_rate: "10", base_unit: "U-KG" }]);
      return Promise.resolve([]);
    });

    const res = await updateConversion(formData({
      id: "QD-1",
      purchased_item_id: "SPM-TRAITAC",
      purchased_unit: "U-BAO",
      conversion_rate: "20",
      base_unit: "U-KG",
    }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("UOM_Conversions"));
  });

  it("deleteConversionAction revalidates sheets-UOM_Conversions", async () => {
    const res = await deleteConversionAction(formData({ id: "QD-1" }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("UOM_Conversions"));
  });
});
