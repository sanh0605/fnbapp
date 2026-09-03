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
  // section 1.4: getCacheTag is the REAL, unmocked function here (via
  // importActual), so this file's own assertions can never silently drift
  // from what the source under test actually calls.
  const actual = await vi.importActual<typeof import("@/lib/sheets_db")>("@/lib/sheets_db");
  return {
    findAll: mocks.findAll,
    // section A3: deleteUnit now checks findAllWhere before deleting --
    // see app/admin/inventory/actions.delete-unit.test.ts for that
    // behaviour's own dedicated tests; this file only needs a harmless
    // default so its unrelated cache-tag assertions still exercise the
    // real (unblocked) delete path.
    findAllWhere: mocks.findAllWhere,
    findAllNoCache: vi.fn(),
    insert: mocks.insert,
    update: mocks.update,
    remove: mocks.remove,
    generateNewId: mocks.generateNewId,
    getCacheTag: actual.getCacheTag,
  };
});
vi.mock("@/lib/stock-adjustment-transaction", () => ({
  submitStockAdjustmentAtomic: vi.fn(),
  approveStockAdjustmentAtomic: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { addUnit, updateUnit, deleteUnit, addItemCategory, updateItemCategory, deleteItemCategory } from "./actions";
import { getCacheTag } from "@/lib/sheets_db";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// section 1.3 (rows 1, 2) / section 1.7's own worked example / section 3:
// Units and Item_Categories are cached 30 min, keyed by table --
// revalidatePath alone only refreshes this screen's own path, not the tag
// Hàng Mua Vào, Phiếu xuất kho, Kiểm kê all read through. Asserted against
// getCacheTag's real output (imported above, unmocked), not a re-typed
// string -- see the vi.mock factory's own comment for why.
//
// Confirmed red twice against the pre-fix code, for the two different
// reasons section 3 asks to distinguish: (1) with every revalidateTag call
// removed, all six tests below failed on "0 calls" -- a missing call, not a
// wrong value; (2) with updateUnit's call changed to the hardcoded,
// misspelled literal "sheets-Unit" (one letter short of
// getCacheTag("Units")'s real output), that test failed on a wrong VALUE --
// proving this assertion style catches exactly the silent-typo failure mode
// section 1.4 warns about. Both reverted and diff-verified byte-identical
// before restoring.
describe("Units/Item_Categories actions -- revalidate the table tag, not just the path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockResolvedValue([]);
    mocks.findAllWhere.mockResolvedValue([]);
    mocks.generateNewId.mockResolvedValue("U-999");
  });

  it("addUnit revalidates sheets-Units", async () => {
    const res = await addUnit(formData({ name: "Chiếc" }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Units"));
  });

  it("updateUnit revalidates sheets-Units", async () => {
    const res = await updateUnit(formData({ id: "U-001", name: "Chiếc" }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Units"));
  });

  it("deleteUnit revalidates sheets-Units", async () => {
    const res = await deleteUnit(formData({ id: "U-001" }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Units"));
  });

  it("addItemCategory revalidates sheets-Item_Categories", async () => {
    const res = await addItemCategory(formData({ name: "Bao bì", system_type: "CONSUMABLE" }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Item_Categories"));
  });

  it("updateItemCategory revalidates sheets-Item_Categories", async () => {
    const res = await updateItemCategory(formData({ id: "NHH-001", name: "Bao bì", system_type: "CONSUMABLE" }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Item_Categories"));
  });

  it("deleteItemCategory revalidates sheets-Item_Categories", async () => {
    const res = await deleteItemCategory(formData({ id: "NHH-001" }));

    expect(res.error).toBeUndefined();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(getCacheTag("Item_Categories"));
  });
});
