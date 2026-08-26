import { describe, expect, it } from "vitest";
import { planAssetsFromCompletedOrder } from "./asset-purchase-allocation";
import type { Band } from "./asset-depreciation";

const BANDS: Band[] = [
  { min_unit_price: 0, max_unit_price: 199_999, term_months: 12 },
  { min_unit_price: 200_000, max_unit_price: 500_000, term_months: 24 },
  { min_unit_price: 500_001, max_unit_price: null, term_months: 36 },
];

describe("planAssetsFromCompletedOrder", () => {
  it("allocates shipping/voucher across the WHOLE order, then bands the equipment line's own unit cost", () => {
    // Two lines: one raw ingredient (400.000d), one equipment line -- 8
    // pumps at 95.000d subtotal (761.200d target after allocation, the
    // plan's own worked example 1 figure). +40.000d shipping across both
    // lines, proportional to subtotal.
    const rawLine = { lineId: "POL-001", subtotal: 400_000 };
    const equipmentLine = { lineId: "POL-002", subtotal: 720_000 };

    const plans = planAssetsFromCompletedOrder({
      allLines: [rawLine, equipmentLine],
      equipmentLines: [
        { lineId: "POL-002", purchasedItemId: "SPM-200", itemName: "Bình nhựa có bơm 1000ml", subtotal: 720_000, baseQuantity: 8 },
      ],
      additions: 40_000,
      subtractions: 0,
      bands: BANDS,
    });

    expect(plans).toHaveLength(1);
    // 40.000 * 720.000 / 1.120.000 = 25.714,28... -> rounds to 25.714;
    // line total 720.000 + 25.714 = 745.714; / 8 = 93.214,25 -> 93.214.
    expect(plans[0]).toEqual({
      purchased_item_id: "SPM-200",
      purchase_order_line_id: "POL-002",
      name_snapshot: "Bình nhựa có bơm 1000ml",
      unit_cost: 93_214,
      total_cost: 745_714, // unrounded allocated total -- the schedule's real basis
      quantity: 8,
      term_months: 12,
    });
  });

  it("ignores non-equipment lines even though they participate in the allocation", () => {
    const plans = planAssetsFromCompletedOrder({
      allLines: [{ lineId: "POL-001", subtotal: 100_000 }, { lineId: "POL-002", subtotal: 900_000 }],
      equipmentLines: [], // e.g. an order with only raw/consumable lines
      additions: 0,
      subtractions: 0,
      bands: BANDS,
    });
    expect(plans).toEqual([]);
  });

  it("bands each equipment line by its OWN unit price, not the order or line total (owner decision 2026-08-22)", () => {
    // Xe cà phê lưu động: 1 unit at 2.100.000d -- above 500k, 36 months.
    const plans = planAssetsFromCompletedOrder({
      allLines: [{ lineId: "POL-010", subtotal: 2_100_000 }],
      equipmentLines: [
        { lineId: "POL-010", purchasedItemId: "SPM-300", itemName: "Xe cà phê lưu động", subtotal: 2_100_000, baseQuantity: 1 },
      ],
      additions: 0,
      subtractions: 0,
      bands: BANDS,
    });
    expect(plans[0].unit_cost).toBe(2_100_000);
    expect(plans[0].term_months).toBe(36);
  });

  it("refuses when no band covers the resulting unit price", () => {
    expect(() =>
      planAssetsFromCompletedOrder({
        allLines: [{ lineId: "POL-020", subtotal: 100 }],
        equipmentLines: [
          { lineId: "POL-020", purchasedItemId: "SPM-400", itemName: "Món lạ", subtotal: 100, baseQuantity: 1 },
        ],
        additions: 0,
        subtractions: 0,
        bands: [{ min_unit_price: 200, max_unit_price: null, term_months: 12 }], // gap below 200
      }),
    ).toThrow(/khung khấu hao/);
  });

  it("refuses an equipment line with zero or negative quantity", () => {
    expect(() =>
      planAssetsFromCompletedOrder({
        allLines: [{ lineId: "POL-030", subtotal: 100_000 }],
        equipmentLines: [
          { lineId: "POL-030", purchasedItemId: "SPM-500", itemName: "Máy hỏng dữ liệu", subtotal: 100_000, baseQuantity: 0 },
        ],
        additions: 0,
        subtractions: 0,
        bands: BANDS,
      }),
    ).toThrow(/số lượng/);
  });
});
