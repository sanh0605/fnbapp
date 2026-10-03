import { describe, expect, it } from "vitest";
import { buildAssetSchedule, chargeForMonth } from "@/lib/assets/asset-depreciation";
import {
  buildAssetItemDetail,
  groupAssetItems,
  type AssetLotInput,
  type DisposalRowInput,
} from "./asset-items";

const AS_OF = "2026-10";

function lot(over: Partial<AssetLotInput> & { id: string }): AssetLotInput {
  return {
    purchased_item_id: "SPM-1",
    purchase_order_id: null,
    name_snapshot: "Món",
    acquired_date: "2026-01-01",
    unit_cost: 1000,
    total_cost: 1000,
    quantity: 1,
    term_months: 12,
    ...over,
  };
}

// Cốc đong 100ml: TS-025 real total 25.000, TS-030 / TS-057 illustrative.
const COC_LOTS: AssetLotInput[] = [
  lot({ id: "TS-057", purchased_item_id: "SPM-COC", name_snapshot: "Cốc đong 100ml", acquired_date: "2026-07-01", quantity: 4, total_cost: 55_140, unit_cost: 13_785 }),
  lot({ id: "TS-025", purchased_item_id: "SPM-COC", name_snapshot: "Cốc đong 100ml", acquired_date: "2026-03-27", quantity: 2, total_cost: 25_000, unit_cost: 12_500 }),
  lot({ id: "TS-030", purchased_item_id: "SPM-COC", name_snapshot: "Cốc đong 100ml", acquired_date: "2026-04-08", quantity: 2, total_cost: 35_000, unit_cost: 17_500 }),
];
const COC_DISPOSALS: DisposalRowInput[] = [
  { id: "TL-001", asset_id: "TS-025", quantity: 2, disposed_date: "2026-07-02", reason: "Rơi vỡ" },
];

// Bình bơm TS-004: real figures.
const BINH_LOT = lot({
  id: "TS-004", purchased_item_id: "SPM-BINH", name_snapshot: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
  acquired_date: "2026-04-04", quantity: 2, total_cost: 411_840, unit_cost: 205_920, term_months: 24,
});
const BINH_DISPOSAL: DisposalRowInput = { id: "TL-002", asset_id: "TS-004", quantity: 1, disposed_date: "2026-07-02", reason: null };

describe("groupAssetItems", () => {
  it("folds Cốc đong's three lots into one row: 6 left of 8, 2 disposed, still not fully disposed", () => {
    const rows = groupAssetItems(COC_LOTS, COC_DISPOSALS, new Map([["SPM-COC", "Cốc đong 100ml"]]), AS_OF);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      itemId: "SPM-COC",
      name: "Cốc đong 100ml",
      quantity: 8,
      remainingQuantity: 6,
      disposedQuantity: 2,
      fullyDisposed: false,
      latestAcquiredDate: "2026-07-01",
    });
  });

  it("sums the remaining value of the lots exactly, without rounding", () => {
    const rows = groupAssetItems([BINH_LOT], [BINH_DISPOSAL], new Map(), AS_OF);

    expect(rows[0].remainingValue).toBeCloseTo(145_860, 6);
  });

  it("marks an item fully disposed only when every lot is out of stock", () => {
    const rows = groupAssetItems(
      [lot({ id: "TS-1", quantity: 2, total_cost: 2000 })],
      [{ id: "TL-1", asset_id: "TS-1", quantity: 2, disposed_date: "2026-02-01", reason: null }],
      new Map(),
      AS_OF,
    );

    expect(rows[0].fullyDisposed).toBe(true);
    expect(rows[0].remainingQuantity).toBe(0);
  });

  it("sorts item ids naturally: SPM-9, SPM-10, SPM-101", () => {
    const rows = groupAssetItems(
      [
        lot({ id: "TS-1", purchased_item_id: "SPM-101" }),
        lot({ id: "TS-2", purchased_item_id: "SPM-9" }),
        lot({ id: "TS-3", purchased_item_id: "SPM-10" }),
      ],
      [],
      new Map(),
      AS_OF,
    );

    expect(rows.map(r => r.itemId)).toEqual(["SPM-9", "SPM-10", "SPM-101"]);
  });

  it("falls back to the newest lot's name_snapshot when the item name is unknown", () => {
    const rows = groupAssetItems(
      [
        lot({ id: "TS-1", name_snapshot: "Tên cũ", acquired_date: "2026-01-01" }),
        lot({ id: "TS-2", name_snapshot: "Tên mới", acquired_date: "2026-05-01" }),
      ],
      [],
      new Map(),
      AS_OF,
    );

    expect(rows[0].name).toBe("Tên mới");
  });
});

describe("buildAssetItemDetail", () => {
  it("returns null for an item with no lots", () => {
    expect(buildAssetItemDetail("SPM-NONE", COC_LOTS, COC_DISPOSALS, undefined, AS_OF)).toBeNull();
  });

  it("Cốc đong: the disposal of TS-025 charges 14.583,33đ into its month", () => {
    const detail = buildAssetItemDetail("SPM-COC", COC_LOTS, COC_DISPOSALS, "Cốc đong 100ml", AS_OF)!;

    expect(detail.disposals).toHaveLength(1);
    expect(detail.disposals[0]).toMatchObject({
      id: "TL-001", assetId: "TS-025", lotAcquiredDate: "2026-03-27", quantity: 2, disposedDate: "2026-07-02", reason: "Rơi vỡ",
    });
    expect(detail.disposals[0].charge).toBeCloseTo(14_583.33, 2);
  });

  it("sorts lots by acquired date then id, not by id alone", () => {
    const detail = buildAssetItemDetail(
      "SPM-X",
      [
        lot({ id: "TS-019", purchased_item_id: "SPM-X", acquired_date: "2026-04-04" }),
        lot({ id: "TS-023", purchased_item_id: "SPM-X", acquired_date: "2026-03-27" }),
        lot({ id: "TS-020", purchased_item_id: "SPM-X", acquired_date: "2026-04-04" }),
      ],
      [],
      "X",
      AS_OF,
    )!;

    expect(detail.lots.map(l => l.id)).toEqual(["TS-023", "TS-019", "TS-020"]);
  });

  it("carries the purchase order id and snapshot name on each lot view", () => {
    const detail = buildAssetItemDetail(
      "SPM-BINH", [{ ...BINH_LOT, purchase_order_id: "PO-009" }], [BINH_DISPOSAL], "Bình bơm", AS_OF,
    )!;

    expect(detail.lots[0]).toMatchObject({ id: "TS-004", purchaseOrderId: "PO-009", nameSnapshot: BINH_LOT.name_snapshot });
  });

  describe("Bình bơm TS-004 (one lot, 1 of 2 disposed 02/07/2026)", () => {
    const detail = () => buildAssetItemDetail("SPM-BINH", [BINH_LOT], [BINH_DISPOSAL], "Bình bơm", AS_OF)!;

    it("disposal charge is 171.600đ and a null reason reads as empty text", () => {
      const d = detail().disposals[0];

      expect(d.charge).toBeCloseTo(171_600, 6);
      expect(d.reason).toBe("");
    });

    it("month 2026-07 charges 188.760đ, of which 171.600đ came from the disposal", () => {
      const jul = detail().months.find(m => m.month === "2026-07")!;

      expect(jul.charge).toBeCloseTo(188_760, 6);
      expect(jul.disposalCharge).toBeCloseTo(171_600, 6);
    });

    it("months sum to the whole 411.840đ and carry no zero-charge month", () => {
      const months = detail().months;

      expect(months.reduce((s, m) => s + m.charge, 0)).toBeCloseTo(411_840, 6);
      expect(months.every(m => m.charge > 0)).toBe(true);
      expect(months).toHaveLength(24);
    });

    it("item totals: total 411.840đ, charged to date = total - remaining value", () => {
      const { item } = detail();

      expect(item.totalCost).toBeCloseTo(411_840, 6);
      expect(item.remainingValue).toBeCloseTo(145_860, 6);
      expect(item.chargedToDate).toBeCloseTo(265_980, 6);
    });
  });

  it("two disposals of one lot in the same month: their charges add up to the month's extra over the undisposed schedule", () => {
    const three = lot({ id: "TS-3", purchased_item_id: "SPM-3", acquired_date: "2026-01-10", quantity: 3, total_cost: 3000, term_months: 12 });
    const disposals: DisposalRowInput[] = [
      { id: "TL-2", asset_id: "TS-3", quantity: 1, disposed_date: "2026-05-20", reason: "a" },
      { id: "TL-1", asset_id: "TS-3", quantity: 1, disposed_date: "2026-05-03", reason: "b" },
    ];
    const detail = buildAssetItemDetail("SPM-3", [three], disposals, "Ba", AS_OF)!;

    // ordered by date, then id
    expect(detail.disposals.map(d => d.id)).toEqual(["TL-1", "TL-2"]);
    const withBoth = buildAssetSchedule(three, disposals.map(d => ({ quantity: d.quantity, disposed_date: d.disposed_date })));
    const withNone = buildAssetSchedule(three, []);
    const expected = chargeForMonth(withBoth, "2026-05") - chargeForMonth(withNone, "2026-05");
    const sum = detail.disposals.reduce((s, d) => s + d.charge, 0);

    expect(sum).toBeCloseTo(expected, 6);
    expect(detail.months.find(m => m.month === "2026-05")!.disposalCharge).toBeCloseTo(expected, 6);
  });

  it("sums unitsHeld and charges across lots by month", () => {
    const a = lot({ id: "TS-1", purchased_item_id: "SPM-S", acquired_date: "2026-01-05", quantity: 2, total_cost: 2400, term_months: 12 });
    const b = lot({ id: "TS-2", purchased_item_id: "SPM-S", acquired_date: "2026-02-05", quantity: 1, total_cost: 1200, term_months: 12 });
    const detail = buildAssetItemDetail("SPM-S", [a, b], [], "S", AS_OF)!;

    expect(detail.months[0]).toEqual({ month: "2026-01", unitsHeld: 2, charge: 200, disposalCharge: 0 });
    expect(detail.months[1]).toEqual({ month: "2026-02", unitsHeld: 3, charge: 300, disposalCharge: 0 });
  });
});
