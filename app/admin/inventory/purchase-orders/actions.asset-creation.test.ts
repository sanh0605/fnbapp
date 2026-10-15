import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
  buildPurchaseOrderWritePlan: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAll,
  findById: mocks.findById,
  insert: mocks.insert,
  update: mocks.update,
  generateNewId: mocks.generateNewId,
  getCacheTag: (sheet: string) => `sheets-${sheet}`,
}));
vi.mock("@/lib/purchasing/purchase-order-write-plan", () => ({
  buildPurchaseOrderWritePlan: mocks.buildPurchaseOrderWritePlan,
}));
vi.mock("@/lib/purchasing/purchase-order-transaction", () => ({
  savePurchaseOrderAtomic: mocks.savePurchaseOrderAtomic,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

import { savePurchaseOrder } from "./actions";

const ITEM_CATEGORIES = [
  { id: "NHH-001", name: "Nguyên liệu", system_type: "RAW" },
  { id: "NHH-003", name: "Dụng cụ", system_type: "EQUIPMENT" },
];

const PURCHASED_ITEMS = [
  { id: "SPM-100", name: "Bột cà phê", item_category_id: "NHH-001", base_ingredient_id: "ING-001" },
  { id: "SPM-200", name: "Bình nhựa có bơm 1000ml", item_category_id: "NHH-003", base_ingredient_id: "" },
];

const BANDS = [
  { id: "KH-001", min_unit_price: 0, max_unit_price: 199_999, term_months: 12 },
  { id: "KH-002", min_unit_price: 200_000, max_unit_price: 500_000, term_months: 24 },
  { id: "KH-003", min_unit_price: 500_001, max_unit_price: null, term_months: 36 },
];

function buildFormData(status = "COMPLETED", id = ""): FormData {
  const formData = new FormData();
  formData.set("supplier_id", "SUP-1");
  // section 3: savePurchaseOrder now also requires source_id for a
  // COMPLETED order.
  formData.set("source_id", "SRC-1");
  // A "Z"-suffixed UTC instant, not the bare "YYYY-MM-DDTHH:mm:ss" the real
  // client actually sends (toSaigonIsoString has no offset marker at all) --
  // that form is parsed as LOCAL TIME by plain new Date(), which is exactly
  // why this test failed under this machine's own local timezone before
  // being pinned here. Pre-existing in this file, not introduced by this
  // change; flagged in the handoff, not fixed here.
  formData.set("transaction_date", "2026-08-20T00:00:00.000Z");
  formData.set("status", status);
  // Migration 0107: a completed order must say how it was paid.
  formData.set("payment_method", "CASH");
  formData.set("lines_json", JSON.stringify([{ subtotal: 761_200, quantity: 8 }]));
  formData.set("subtotal_amount", "761200");
  if (id) formData.set("id", id);
  return formData;
}

function mockFindAll(overrides: Record<string, any[]> = {}) {
  mocks.findAll.mockImplementation((sheet: string) => {
    if (sheet === "Purchased_Items") return Promise.resolve(overrides.Purchased_Items ?? PURCHASED_ITEMS);
    if (sheet === "Item_Categories") return Promise.resolve(overrides.Item_Categories ?? ITEM_CATEGORIES);
    if (sheet === "UOM_Conversions") return Promise.resolve([]);
    if (sheet === "asset_depreciation_bands") return Promise.resolve(overrides.asset_depreciation_bands ?? BANDS);
    if (overrides[sheet]) return Promise.resolve(overrides[sheet]);
    return Promise.resolve([]);
  });
}

// Audit A7: the asset rows travel with the order to the one database function; nothing is
// written to assets from here any more.
function assetsSentToSave(): any {
  expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalledTimes(1);
  return mocks.savePurchaseOrderAtomic.mock.calls[0][0].assets;
}
function expectNoAssetWrite() {
  expect(mocks.insert).not.toHaveBeenCalledWith("assets", expect.anything());
  expect(mocks.update).not.toHaveBeenCalled();
}

// An unchanged re-save of a completed order: its stored line and the asset on it
// exist, so the edit has nothing to create (BR-COGS-008).
function mockStoredAssetOnLine(lineId: string) {
  mockFindAll({
    Purchase_Order_Lines: [{ id: lineId, po_id: "PO-001", purchased_item_id: "SPM-200" }],
    assets: [{
      id: "TS-001", purchase_order_line_id: lineId, purchased_item_id: "SPM-200",
      name_snapshot: "Bình nhựa có bơm 1000ml", quantity: 8, unit_cost: 95_150,
      total_cost: 761_200, term_months: 12, acquired_date: "2026-08-20", status: "ACTIVE",
    }],
  });
}

// Batch 3, section 3.2: completing a NEW purchase order with an EQUIPMENT
// line creates the corresponding assets row -- the mechanism inferred from
// purchase_order_line_id being nullable and no "add asset" screen existing
// anywhere in the plan's section 5.
describe("savePurchaseOrder -- asset creation on completing an EQUIPMENT purchase (Batch 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findById.mockResolvedValue(null);
    mockFindAll();
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-001" });
    mocks.generateNewId.mockResolvedValue("TS-001");
  });

  it.each([[""], ["0"]])(
    "refuses to complete an order whose line has quantity %j, before any write",
    async quantity => {
      const formData = buildFormData();
      formData.set("lines_json", JSON.stringify([
        { purchased_item_id: "SPM-100", quantity: "2", subtotal: 100_000 },
        { purchased_item_id: "SPM-200", quantity, subtotal: 661_200 },
      ]));

      const res = await savePurchaseOrder(formData);

      expect(res.error).toBe("Dòng 2: Vui lòng nhập số lượng");
      expect(mocks.buildPurchaseOrderWritePlan).not.toHaveBeenCalled();
      expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
    },
  );

  it("creates an assets row for an EQUIPMENT line, banded by its own unit price", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      // No conversion on this line -- base_quantity equals the purchase
      // quantity, unchanged (plan section 4.2's "no conversion" case).
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });

    const res = await savePurchaseOrder(buildFormData());

    expect(res.error).toBeUndefined();
    // The exact asset row, pinned field by field (audit A7); the id is made by the database function.
    expect(assetsSentToSave()).toEqual({
      create: [{
        purchased_item_id: "SPM-200",
        purchase_order_line_id: "POL-002",
        name_snapshot: "Bình nhựa có bơm 1000ml",
        unit_cost: 95_150, // 761.200 / 8, no shipping/voucher on this order
        total_cost: 761_200, // the unrounded allocated line total
        quantity: 8,
        term_months: 12, // under 200k
        acquired_date: "2026-08-20",
      }],
      update: [],
      retire: [],
    });
    expectNoAssetWrite();
  });

  // The old insert()/update() helpers dropped the 2-minute "assets" cache; the SQL write does not,
  // so the action must, or the next edit plans from stale assets and duplicates one.
  it("drops the assets cache after a save that sent assets, and not after one that did not", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });
    await savePurchaseOrder(buildFormData());
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-assets");

    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findById.mockResolvedValue(null);
    mockFindAll();
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-001" });
    await savePurchaseOrder(buildFormData("DRAFT"));
    expect(mocks.revalidateTag).not.toHaveBeenCalledWith("sheets-assets");
  });

  it("creates no asset for a RAW-only order", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-001", purchased_item_id: "SPM-100", subtotal: 761_200, quantity: 10, base_quantity: 10 }],
      ledgerRows: [],
    });

    const res = await savePurchaseOrder(buildFormData());

    expect(res.error).toBeUndefined();
    expect(assetsSentToSave()).toBeUndefined();
  });

  it("creates no asset for a DRAFT order, even with an equipment line", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });

    await savePurchaseOrder(buildFormData("DRAFT"));

    expect(assetsSentToSave()).toBeUndefined();
  });

  it("creates no asset when re-saving an unchanged completed order that already has its asset", async () => {
    mockStoredAssetOnLine("POL-002");
    mocks.findById.mockResolvedValue({ status: "COMPLETED", subtotal_amount: 761_200 });
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });

    await savePurchaseOrder(buildFormData("COMPLETED", "PO-001"));

    expect(assetsSentToSave()).toBeUndefined();
  });

  describe("an existing order saved again", () => {
    const equipmentPlan = () => ({
      order: {},
      // Line ids are recreated by every replace-existing save: "POL-NEW" is the id THIS save wrote.
      lines: [{ id: "POL-NEW", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });

    it("DRAFT -> COMPLETED creates the asset, pointing at the line id written by this save", async () => {
      mocks.findById.mockResolvedValue({ status: "DRAFT", subtotal_amount: 761_200 });
      mocks.buildPurchaseOrderWritePlan.mockReturnValue(equipmentPlan());

      const res = await savePurchaseOrder(buildFormData("COMPLETED", "PO-001"));

      expect(res.error).toBeUndefined();
      const sent = assetsSentToSave();
      expect(sent.create).toHaveLength(1);
      expect(sent.create[0]).toEqual(
        expect.objectContaining({
          purchase_order_line_id: "POL-NEW",
          purchased_item_id: "SPM-200",
          total_cost: 761_200,
          quantity: 8,
        }),
      );
      expectNoAssetWrite();
    });

    it("COMPLETED -> COMPLETED creates no asset for a line that already has one", async () => {
      mockStoredAssetOnLine("POL-NEW");
      mocks.findById.mockResolvedValue({ status: "COMPLETED", subtotal_amount: 761_200 });
      mocks.buildPurchaseOrderWritePlan.mockReturnValue(equipmentPlan());

      await savePurchaseOrder(buildFormData("COMPLETED", "PO-001"));

      expect(assetsSentToSave()).toBeUndefined();
    });

    it("DRAFT -> DRAFT creates no asset", async () => {
      mocks.findById.mockResolvedValue({ status: "DRAFT", subtotal_amount: 761_200 });
      mocks.buildPurchaseOrderWritePlan.mockReturnValue(equipmentPlan());

      await savePurchaseOrder(buildFormData("DRAFT", "PO-001"));

      expect(assetsSentToSave()).toBeUndefined();
    });
  });

  // section 6,
  // the owner's own numbers: 1 line, 1 "Combo 10", 108.000d, conversion
  // 1 Combo 10 = 10 Chai -> asset quantity 10, unit_cost 10.800d. Against
  // the pre-fix code (equipmentLines.baseQuantity read from line.quantity,
  // the PURCHASE-unit quantity of 1) this would have produced quantity 1
  // at 108.000d -- confirmed by stashing the actions.ts fix below.
  it("a purchase of '1 Combo 10' becomes 10 assets at a tenth of the price, not 1 asset at the box price", async () => {
    mockFindAll({
      Purchased_Items: [
        { id: "SPM-201", name: "Chai nhựa HDPE 1000ml", item_category_id: "NHH-003", base_ingredient_id: "" },
      ],
    });
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [
        { id: "POL-003", purchased_item_id: "SPM-201", subtotal: 108_000, quantity: 1, base_quantity: 10 },
      ],
      ledgerRows: [],
    });

    const res = await savePurchaseOrder(buildFormData());

    expect(res.error).toBeUndefined();
    expect(assetsSentToSave().create).toEqual([
      expect.objectContaining({
        purchased_item_id: "SPM-201",
        purchase_order_line_id: "POL-003",
        name_snapshot: "Chai nhựa HDPE 1000ml",
        unit_cost: 10_800,
        total_cost: 108_000,
        quantity: 10,
        term_months: 12,
      }),
    ]);
  });

  // (OPEN-ITEMS 64): acquired_date is sliced from effectiveDate, a UTC
  // string, while the purchase's real date is Saigon wall-clock -- a
  // purchase made at Saigon midnight on the 1st slices to the last UTC
  // hour of the PREVIOUS day, one calendar day early. Financially inert
  // most of the time (lib/assets/asset-depreciation.ts's parseYearMonth reads
  // only the month), but not when the shift crosses a month boundary,
  // which this fixture deliberately does. An explicit +07:00 offset is
  // used (not toSaigonIsoString's bare local-time string) so this test's
  // result does not depend on the machine or CI runner's own timezone --
  // OPEN-ITEMS 55's own hazard, avoided rather than repeated here.
  it("a purchase at Saigon midnight on the 1st is acquired that day, not the last day of the previous month", async () => {
    const formData = buildFormData();
    formData.set("transaction_date", "2026-06-01T00:00:00+07:00");
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });

    const res = await savePurchaseOrder(formData);

    expect(res.error).toBeUndefined();
    expect(assetsSentToSave().create).toEqual([expect.objectContaining({ acquired_date: "2026-06-01" })]);
  });

  // Audit A7: the order and its assets are one write. An asset that cannot be planned
  // (no depreciation band for the price) now refuses the save instead of saving the order
  // without its asset and showing a warning.
  it("refuses the save, writing nothing, when an asset cannot be planned", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 100, quantity: 1, base_quantity: 1 }],
      ledgerRows: [],
    });
    // No band covers 100d -- planAssetsFromCompletedOrder throws.
    mockFindAll({ asset_depreciation_bands: [{ id: "KH-002", min_unit_price: 200_000, max_unit_price: null, term_months: 24 }] });

    const res = await savePurchaseOrder(buildFormData());

    expect(res.error).toBe("Bình nhựa có bơm 1000ml: không tìm thấy khung khấu hao cho đơn giá 100đ");
    expect(res.assetWarning).toBeUndefined();
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("a failing database save (order and assets are one transaction) is reported as failed", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });
    mocks.savePurchaseOrderAtomic.mockRejectedValue(new Error("save_purchase_order_atomic: Không sửa được phiếu PO-064: Trứng gà sẽ âm kho"));

    const res = await savePurchaseOrder(buildFormData());

    expect(res.success).toBeUndefined();
    expect(res.error).toContain("Trứng gà sẽ âm kho");
    expectNoAssetWrite();
  });
});

// BR-COGS-008 (owner 2026-10-08, "1b"): editing a completed order updates its
// assets; an asset with a disposal refuses the edit.
describe("savePurchaseOrder -- editing a completed order updates its assets", () => {
  const apronAsset = {
    id: "TS-018",
    purchase_order_line_id: "POL-A",
    purchased_item_id: "SPM-200",
    name_snapshot: "Tạp dề",
    quantity: 2,
    unit_cost: 85_000,
    total_cost: 170_000,
    term_months: 12,
    acquired_date: "2026-08-20",
    status: "ACTIVE",
  };

  function setup(disposals: any[] = []) {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findById.mockResolvedValue({ id: "PO-100", status: "COMPLETED", subtotal_amount: 170_000 });
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") return Promise.resolve(PURCHASED_ITEMS);
      if (sheet === "Item_Categories") return Promise.resolve(ITEM_CATEGORIES);
      if (sheet === "Purchase_Order_Lines") {
        return Promise.resolve([{ id: "POL-A", po_id: "PO-100", purchased_item_id: "SPM-200" }]);
      }
      if (sheet === "assets") return Promise.resolve([apronAsset]);
      if (sheet === "asset_disposals") return Promise.resolve(disposals);
      if (sheet === "asset_depreciation_bands") return Promise.resolve(BANDS);
      return Promise.resolve([]);
    });
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-100" });
    mocks.generateNewId.mockResolvedValue("TS-099");
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-A", purchased_item_id: "SPM-200", subtotal: 255_000, quantity: 3, base_quantity: 3 }],
      ledgerRows: [],
    });
  }

  function formData() {
    const fd = buildFormData("COMPLETED", "PO-100");
    fd.set("lines_json", JSON.stringify([{ subtotal: 255_000, quantity: 3 }]));
    fd.set("subtotal_amount", "255000");
    return fd;
  }

  it("editing PO-100 Tạp dề from 2 to 3 updates the asset quantity and inserts no asset", async () => {
    setup();

    const res = await savePurchaseOrder(formData());

    expect(res.error).toBeUndefined();
    const sent = assetsSentToSave();
    expect(sent.update).toEqual([{ id: "TS-018", patch: expect.objectContaining({ quantity: 3, total_cost: 255_000 }) }]);
    expect(sent.create).toEqual([]);
    expect(sent.retire).toEqual([]);
    expectNoAssetWrite();
  });

  it("refuses the edit, writing nothing, when it changes an asset that has a disposal", async () => {
    setup([{ id: "TL-1", asset_id: "TS-018" }]);

    const res = await savePurchaseOrder(formData());

    expect(res.error).toBe(
      "Không sửa được phiếu: tài sản TS-018 Tạp dề sinh từ phiếu này đã có lần thanh lý, mà lần sửa này làm đổi tài sản đó.",
    );
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("a deleted line retires its asset and a new equipment line gets a new asset", async () => {
    setup();
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-NEW", purchased_item_id: "SPM-200", subtotal: 255_000, quantity: 3, base_quantity: 3 }],
      ledgerRows: [],
    });

    const res = await savePurchaseOrder(formData());

    expect(res.error).toBeUndefined();
    const sent = assetsSentToSave();
    expect(sent.retire).toEqual(["TS-018"]);
    expect(sent.create).toEqual([expect.objectContaining({ purchase_order_line_id: "POL-NEW", quantity: 3 })]);
    expect(sent.create[0]).not.toHaveProperty("id");
    expectNoAssetWrite();
  });

  it("a failure while saving the order and its assets is reported as failed, never as saved with a warning", async () => {
    setup();
    mocks.savePurchaseOrderAtomic.mockRejectedValue(new Error("boom"));

    const res = await savePurchaseOrder(formData());

    expect(res.success).toBeUndefined();
    expect(res.assetWarning).toBeUndefined();
    expect(res.error).toBeTruthy();
  });
});

// BR-INV-015 (owner 2026-10-08, "a"): a completed order is never saved back as
// a draft; a draft is not counted, so that save worked as a cancel with none of
// the cancel's checks. "Huỷ phiếu" is the way out.
describe("savePurchaseOrder -- a completed order is never saved back as a draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mockFindAll();
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-100" });
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-1", purchased_item_id: "SPM-100", subtotal: 761_200, quantity: 10, base_quantity: 10 }],
      ledgerRows: [],
    });
  });

  it("refuses a draft save of PO-100 (completed) and writes nothing", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-100", status: "COMPLETED" });

    const res = await savePurchaseOrder(buildFormData("DRAFT", "PO-100"));

    expect(res.error).toBe("Phiếu đã hoàn thành không lưu nháp được. Muốn rút phiếu ra, dùng Huỷ phiếu.");
    expect(mocks.savePurchaseOrderAtomic).not.toHaveBeenCalled();
  });

  it("still saves a draft that was a draft", async () => {
    mocks.findById.mockResolvedValue({ id: "PO-201", status: "DRAFT" });

    const res = await savePurchaseOrder(buildFormData("DRAFT", "PO-201"));

    expect(res.error).toBeUndefined();
    expect(mocks.savePurchaseOrderAtomic).toHaveBeenCalledTimes(1);
  });
});
