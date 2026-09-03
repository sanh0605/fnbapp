import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
  buildPurchaseOrderWritePlan: vi.fn(),
  savePurchaseOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findById: mocks.findById,
  insert: mocks.insert,
  generateNewId: mocks.generateNewId,
}));
vi.mock("@/lib/purchase-order-write-plan", () => ({
  buildPurchaseOrderWritePlan: mocks.buildPurchaseOrderWritePlan,
}));
vi.mock("@/lib/purchase-order-transaction", () => ({
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
  formData.set("lines_json", JSON.stringify([{ subtotal: 761_200 }]));
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
    return Promise.resolve([]);
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
    mocks.findById.mockResolvedValue(null);
    mockFindAll();
    mocks.savePurchaseOrderAtomic.mockResolvedValue({ purchaseOrderId: "PO-001" });
    mocks.generateNewId.mockResolvedValue("TS-001");
  });

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
    expect(mocks.insert).toHaveBeenCalledWith(
      "assets",
      expect.objectContaining({
        purchased_item_id: "SPM-200",
        purchase_order_line_id: "POL-002",
        name_snapshot: "Bình nhựa có bơm 1000ml",
        unit_cost: 95_150, // 761.200 / 8, no shipping/voucher on this order
        total_cost: 761_200, // the unrounded allocated line total
        quantity: 8,
        term_months: 12, // under 200k
        acquired_date: "2026-08-20",
      }),
    );
  });

  it("creates no asset for a RAW-only order", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-001", purchased_item_id: "SPM-100", subtotal: 761_200, quantity: 10, base_quantity: 10 }],
      ledgerRows: [],
    });

    const res = await savePurchaseOrder(buildFormData());

    expect(res.error).toBeUndefined();
    expect(mocks.insert).not.toHaveBeenCalledWith("assets", expect.anything());
  });

  it("creates no asset for a DRAFT order, even with an equipment line", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });

    await savePurchaseOrder(buildFormData("DRAFT"));

    expect(mocks.insert).not.toHaveBeenCalledWith("assets", expect.anything());
  });

  it("creates no asset when EDITING an existing order, even with an equipment line -- known limitation, documented not guessed at", async () => {
    mocks.findById.mockResolvedValue({ status: "COMPLETED", subtotal_amount: 761_200 });
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 761_200, quantity: 8, base_quantity: 8 }],
      ledgerRows: [],
    });

    await savePurchaseOrder(buildFormData("COMPLETED", "PO-001"));

    expect(mocks.insert).not.toHaveBeenCalledWith("assets", expect.anything());
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
    expect(mocks.insert).toHaveBeenCalledWith(
      "assets",
      expect.objectContaining({
        purchased_item_id: "SPM-201",
        purchase_order_line_id: "POL-003",
        name_snapshot: "Chai nhựa HDPE 1000ml",
        unit_cost: 10_800,
        total_cost: 108_000,
        quantity: 10,
        term_months: 12,
      }),
    );
  });

  // (OPEN-ITEMS 64): acquired_date is sliced from effectiveDate, a UTC
  // string, while the purchase's real date is Saigon wall-clock -- a
  // purchase made at Saigon midnight on the 1st slices to the last UTC
  // hour of the PREVIOUS day, one calendar day early. Financially inert
  // most of the time (lib/asset-depreciation.ts's parseYearMonth reads
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
    expect(mocks.insert).toHaveBeenCalledWith(
      "assets",
      expect.objectContaining({ acquired_date: "2026-06-01" }),
    );
  });

  it("reports the order as saved (not failed) even if asset creation errors, with a warning attached", async () => {
    mocks.buildPurchaseOrderWritePlan.mockReturnValue({
      order: {},
      lines: [{ id: "POL-002", purchased_item_id: "SPM-200", subtotal: 100, quantity: 1, base_quantity: 1 }],
      ledgerRows: [],
    });
    // No band covers 100d -- planAssetsFromCompletedOrder throws.
    mockFindAll({ asset_depreciation_bands: [{ id: "KH-002", min_unit_price: 200_000, max_unit_price: null, term_months: 24 }] });

    const res = await savePurchaseOrder(buildFormData());

    expect(res.success).toBe(true);
    expect(res.assetWarning).toBeTruthy();
  });
});
