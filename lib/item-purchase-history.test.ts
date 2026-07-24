import { describe, expect, it } from "vitest";
import { computeItemPurchaseHistory, getPriceTrend } from "@/lib/item-purchase-history";

const suppliers = [{ id: "NCC-1", name: "Nhà cung cấp A" }, { id: "NCC-2", name: "Nhà cung cấp B" }];
const units = [{ id: "U-KG", name: "Kg" }];

describe("computeItemPurchaseHistory", () => {
  it("returns only COMPLETED-order lines for the requested item, newest first", () => {
    const lines = [
      { purchase_order_id: "PO-1", purchased_item_id: "SPM-1", quantity: 10, unit: "U-KG", unit_price: 20000, subtotal: 200000 },
      { purchase_order_id: "PO-2", purchased_item_id: "SPM-1", quantity: 5, unit: "U-KG", unit_price: 22000, subtotal: 110000 },
      { purchase_order_id: "PO-3", purchased_item_id: "SPM-1", quantity: 5, unit: "U-KG", unit_price: 25000, subtotal: 125000 },
      { purchase_order_id: "PO-1", purchased_item_id: "SPM-OTHER", quantity: 1, unit: "U-KG", unit_price: 1000, subtotal: 1000 },
    ];
    const orders = [
      { id: "PO-1", supplier_id: "NCC-1", transaction_date: "2026-07-01T00:00:00Z", status: "COMPLETED" },
      { id: "PO-2", supplier_id: "NCC-2", transaction_date: "2026-07-10T00:00:00Z", status: "COMPLETED" },
      { id: "PO-3", supplier_id: "NCC-1", transaction_date: "2026-07-05T00:00:00Z", status: "DRAFT" },
    ];

    const rows = computeItemPurchaseHistory("SPM-1", lines, orders, suppliers, units);

    expect(rows).toHaveLength(2);
    expect(rows[0].poId).toBe("PO-2");
    expect(rows[0].supplierName).toBe("Nhà cung cấp B");
    expect(rows[0].unitCost).toBe(22000);
    expect(rows[1].poId).toBe("PO-1");
  });

  it("falls back to created_at when transaction_date is missing, and labels an unresolved supplier", () => {
    const lines = [
      { purchase_order_id: "PO-1", purchased_item_id: "SPM-1", quantity: 1, unit: "U-KG", unit_price: 1000, subtotal: 1000 },
    ];
    const orders = [
      { id: "PO-1", supplier_id: "NCC-MISSING", created_at: "2026-07-01T00:00:00Z", status: "COMPLETED" },
    ];

    const rows = computeItemPurchaseHistory("SPM-1", lines, orders, suppliers, units);

    expect(rows[0].date).toBe("2026-07-01T00:00:00Z");
    expect(rows[0].supplierName).toBe("Không xác định");
  });

  it("ignores lines whose PO cannot be found", () => {
    const lines = [
      { purchase_order_id: "PO-GONE", purchased_item_id: "SPM-1", quantity: 1, unit: "U-KG", unit_price: 1000, subtotal: 1000 },
    ];

    const rows = computeItemPurchaseHistory("SPM-1", lines, [], suppliers, units);

    expect(rows).toHaveLength(0);
  });
});

describe("getPriceTrend", () => {
  it("returns null with fewer than 2 rows", () => {
    expect(getPriceTrend([])).toBeNull();
    expect(getPriceTrend([{ poId: "PO-1", date: "", supplierId: "", supplierName: "", quantity: 1, unitLabel: "", unitCost: 100, lineTotal: 100 }])).toBeNull();
  });

  it("detects up, down, and same trends between the latest 2 rows", () => {
    const row = (unitCost: number) => ({ poId: "PO", date: "", supplierId: "", supplierName: "", quantity: 1, unitLabel: "", unitCost, lineTotal: unitCost });

    expect(getPriceTrend([row(120), row(100)])).toBe("up");
    expect(getPriceTrend([row(80), row(100)])).toBe("down");
    expect(getPriceTrend([row(100), row(100)])).toBe("same");
  });
});
