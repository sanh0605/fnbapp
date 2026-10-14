import { describe, expect, it } from "vitest";
import {
  assetReconcileRefusalMessage,
  planAssetReconcile,
  type ReconcileAsset,
} from "./asset-purchase-reconcile";

// Bands as measured 2026-10-08: under 200,000 -> 12, 200,000-500,000 -> 24, above -> 36.
const BANDS = [
  { min_unit_price: 0, max_unit_price: 200_000, term_months: 12 },
  { min_unit_price: 200_000, max_unit_price: 500_000, term_months: 24 },
  { min_unit_price: 500_000, max_unit_price: null, term_months: 36 },
];

const NAMES = new Map([
  ["SPM-APRON", "Tạp dề"],
  ["SPM-PHIN", "Phin cà phê lớn"],
  ["SPM-TRAY", "Khay inox"],
  ["SPM-COFFEE", "Bột cà phê"],
]);
const EQUIPMENT = new Set(["SPM-APRON", "SPM-PHIN", "SPM-TRAY"]);

// A small order built from the PO-100 numbers (not the real order): Tạp dề 2 at
// 85,000 = 170,000 and Phin cà phê lớn 132,900, with a 59,315 discount. The
// discount factor is 0.80418, which gives the rule's 68,355 per apron (136,710
// for two) and 106,875 for the Phin.
const DISCOUNT = 59_315;
const apronLine = (qty: number, id = "POL-A") => ({
  id,
  purchased_item_id: "SPM-APRON",
  subtotal: qty * 85_000,
  base_quantity: qty,
});
const phinLine = (subtotal = 132_900, id = "POL-P") => ({
  id,
  purchased_item_id: "SPM-PHIN",
  subtotal,
  base_quantity: 1,
});

const apronAsset = (over: Partial<ReconcileAsset> = {}): ReconcileAsset => ({
  id: "TS-018",
  purchase_order_line_id: "POL-A",
  purchased_item_id: "SPM-APRON",
  name_snapshot: "Tạp dề",
  quantity: 2,
  unit_cost: 68_355,
  total_cost: 136_710,
  term_months: 12,
  acquired_date: "2026-08-20",
  status: "ACTIVE",
  ...over,
});
const phinAsset = (over: Partial<ReconcileAsset> = {}): ReconcileAsset => ({
  id: "TS-019",
  purchase_order_line_id: "POL-P",
  purchased_item_id: "SPM-PHIN",
  name_snapshot: "Phin cà phê lớn",
  quantity: 1,
  unit_cost: 106_875,
  total_cost: 106_875,
  term_months: 12,
  acquired_date: "2026-08-20",
  status: "ACTIVE",
  ...over,
});

function plan(over: Partial<Parameters<typeof planAssetReconcile>[0]> = {}) {
  return planAssetReconcile({
    lines: [apronLine(2), phinLine()],
    storedLineIds: ["POL-A", "POL-P"],
    equipmentItemIds: EQUIPMENT,
    itemNameById: NAMES,
    assets: [apronAsset(), phinAsset()],
    disposals: [],
    additions: 0,
    subtractions: DISCOUNT,
    bands: BANDS,
    acquiredDate: "2026-08-20",
    ...over,
  });
}

function applied(result: ReturnType<typeof planAssetReconcile>) {
  if (result.kind !== "apply") throw new Error("expected apply, got refuse");
  return result;
}

describe("planAssetReconcile", () => {
  it("a note-only edit changes nothing", () => {
    const r = applied(plan());
    expect(r.retire).toEqual([]);
    expect(r.update).toEqual([]);
    expect(r.create).toEqual([]);
  });

  it("a note-only edit keeps the stored term even though the bands now say 24 for that cost", () => {
    const bandsNow = [
      { min_unit_price: 0, max_unit_price: 50_000, term_months: 12 },
      { min_unit_price: 50_000, max_unit_price: null, term_months: 24 },
    ];
    const r = applied(plan({ bands: bandsNow }));
    expect(r.update).toEqual([]);
  });

  it("PO-100 Tạp dề 2 -> 3: quantity and total follow, the term stays 12", () => {
    const r = applied(plan({ lines: [apronLine(3), phinLine()], assets: [apronAsset()] }));
    expect(r.retire).toEqual([]);
    expect(r.create).toEqual([]);
    expect(r.update).toHaveLength(1);
    expect(r.update[0].id).toBe("TS-018");
    expect(r.update[0].patch.quantity).toBe(3);
    expect(r.update[0].patch.total_cost).toBeGreaterThan(136_710);
    expect(r.update[0].patch.unit_cost).toBeLessThan(200_000);
    expect(r.update[0].patch.term_months ?? 12).toBe(12);
  });

  it("the unit cost not moving keeps the term: quantity alone changes with an unchanged price", () => {
    // No discount and a stored cost equal to the plan: only quantity differs.
    const asset = apronAsset({ unit_cost: 85_000, total_cost: 170_000 });
    const r = applied(plan({ lines: [apronLine(3)], assets: [asset], subtractions: 0, bands: [{ min_unit_price: 0, max_unit_price: null, term_months: 24 }] }));
    expect(r.update[0].patch).toEqual({ quantity: 3, total_cost: 255_000 });
  });

  it("TS-019 Phin cà phê lớn: line edited to 250,000 crosses 200,000, so the term becomes 24", () => {
    // Small consistent order (see the header), not the real PO-100: the rule's
    // "about 201,000" depends on that order's real discount.
    const r = applied(
      plan({ lines: [apronLine(2), phinLine(250_000)], assets: [phinAsset()] }),
    );
    const phin = r.update.find(u => u.id === "TS-019");
    expect(phin).toBeDefined();
    expect(phin!.patch.unit_cost).toBeGreaterThanOrEqual(200_000);
    expect(phin!.patch.term_months).toBe(24);
  });

  it("a deleted line retires its asset", () => {
    const r = applied(plan({ lines: [phinLine()], assets: [apronAsset(), phinAsset()], subtractions: 0, additions: 0 }));
    expect(r.retire).toEqual(["TS-018"]);
  });

  it("a line changed to another equipment item retires the old asset and creates the new one", () => {
    const trayLine = { id: "POL-NEW", purchased_item_id: "SPM-TRAY", subtotal: 170_000, base_quantity: 2 };
    const r = applied(plan({ lines: [trayLine, phinLine()], assets: [apronAsset()], subtractions: 0 }));
    expect(r.retire).toEqual(["TS-018"]);
    expect(r.create).toHaveLength(1);
    expect(r.create[0]).toMatchObject({
      purchased_item_id: "SPM-TRAY",
      purchase_order_line_id: "POL-NEW",
      name_snapshot: "Khay inox",
      quantity: 2,
      unit_cost: 85_000,
      total_cost: 170_000,
      term_months: 12,
    });
  });

  it("a new equipment line creates one asset", () => {
    const trayLine = { id: "POL-NEW", purchased_item_id: "SPM-TRAY", subtotal: 100_000, base_quantity: 1 };
    const r = applied(plan({ lines: [apronLine(2), phinLine(), trayLine] }));
    expect(r.create.map(c => c.purchase_order_line_id)).toEqual(["POL-NEW"]);
  });

  it("a new line of a non-equipment item creates nothing", () => {
    const coffee = { id: "POL-NEW", purchased_item_id: "SPM-COFFEE", subtotal: 100_000, base_quantity: 1 };
    const r = applied(plan({ lines: [apronLine(2), phinLine(), coffee], subtractions: 0, assets: [] }));
    expect(r.create).toEqual([]);
  });

  it("an old equipment line with no asset is not given one", () => {
    const r = applied(plan({ assets: [apronAsset()] }));
    expect(r.create).toEqual([]);
  });

  it("changed shipping patches every equipment asset of the order", () => {
    const r = applied(plan({ additions: 40_000 }));
    expect(r.update.map(u => u.id).sort()).toEqual(["TS-018", "TS-019"]);
    expect(r.update.every(u => !("term_months" in u.patch) || typeof u.patch.term_months === "number")).toBe(true);
  });

  it("a changed order date moves acquired_date only", () => {
    const r = applied(plan({ acquiredDate: "2026-08-25" }));
    expect(r.update).toEqual([
      { id: "TS-018", patch: { acquired_date: "2026-08-25" } },
      { id: "TS-019", patch: { acquired_date: "2026-08-25" } },
    ]);
  });

  it("an asset whose item is no longer equipment is left alone", () => {
    const r = applied(
      plan({ equipmentItemIds: new Set(["SPM-PHIN"]), lines: [apronLine(3), phinLine()], assets: [apronAsset()] }),
    );
    expect(r.retire).toEqual([]);
    expect(r.update).toEqual([]);
  });

  it("an INACTIVE asset is ignored, even when its line was deleted", () => {
    const r = applied(plan({ lines: [phinLine()], assets: [apronAsset({ status: "INACTIVE" }), phinAsset()] }));
    expect(r.retire).toEqual([]);
  });

  it("refuses naming the asset when one that the edit would change has a disposal", () => {
    const r = plan({
      lines: [apronLine(3), phinLine()],
      assets: [apronAsset(), phinAsset()],
      disposals: [{ asset_id: "TS-018" }],
      subtractions: 0,
    });
    expect(r).toEqual({ kind: "refuse", assets: expect.arrayContaining([{ id: "TS-018", name: "Tạp dề" }]) });
  });

  it("refuses when the disposed asset's line is deleted", () => {
    const r = plan({ lines: [phinLine()], disposals: [{ asset_id: "TS-018" }] });
    expect(r).toEqual({ kind: "refuse", assets: [{ id: "TS-018", name: "Tạp dề" }] });
  });

  it("does not refuse for an asset with a disposal that the edit would not change", () => {
    const r = plan({ disposals: [{ asset_id: "TS-018" }] });
    expect(r.kind).toBe("apply");
  });
});

describe("assetReconcileRefusalMessage", () => {
  it("lists id and name of every asset", () => {
    expect(
      assetReconcileRefusalMessage([
        { id: "TS-018", name: "Tạp dề" },
        { id: "TS-019", name: "Phin cà phê lớn" },
      ]),
    ).toBe(
      "Không sửa được phiếu: tài sản TS-018 Tạp dề, TS-019 Phin cà phê lớn sinh từ phiếu này đã có lần thanh lý, mà lần sửa này làm đổi tài sản đó.",
    );
  });
});
