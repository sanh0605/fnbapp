import { describe, expect, it } from "vitest";
import { listPurchaseOrdersPage } from "./purchase-order-list";
import type { DBPurchaseOrder } from "@/types/db";

function po(id: string, transaction_date: string, extra: Partial<DBPurchaseOrder> = {}): DBPurchaseOrder {
  return {
    id, transaction_date, created_at: transaction_date, supplier_id: "SUP-1", source_id: "SRC-1",
    subtotal: "0", shipping_cost: "0", tax_amount: "0", discount_amount: "0",
    total_amount: "100000", status: "COMPLETED", ...extra,
  };
}
const base = {
  suppliers: [{ id: "SUP-1", name: "Không rõ" }, { id: "SUP-2", name: "Vinamilk" }],
  sources: [{ id: "SRC-1", name: "Mua ngoài" }],
  lines: [{ purchase_order_id: "PO-190", purchased_item_id: "IT-1" }],
  items: [{ id: "IT-1", name: "Sữa tươi" }],
};
const real = [
  po("PO-188", "2026-09-22T17:00:00+00:00", { total_amount: "300000" }),
  po("PO-191", "2026-09-28T09:13:06+00:00", { total_amount: "165000" }),
  po("PO-190", "2026-09-24T07:03:37+00:00", { supplier_id: "SUP-2", total_amount: "54864", supplier_invoice_code: "HD-77" }),
];

describe("listPurchaseOrdersPage", () => {
  it("sorts by slip date newest first and formats the date to the second", () => {
    const r = listPurchaseOrdersPage({ ...base, orders: real, filters: {} });
    expect(r.rows.map(x => x.id)).toEqual(["PO-191", "PO-190", "PO-188"]);
    expect(r.rows[0]).toEqual({
      id: "PO-191", dateText: "28/09/2026 16:13:06", supplierName: "Không rõ",
      sourceName: "Mua ngoài", status: "COMPLETED", totalAmount: 165000,
    });
    expect(r.rows[2].dateText).toBe("23/09/2026 00:00:00");
  });

  it("breaks a tie on slip date by created_at, then id, newest first", () => {
    const orders = [
      po("PO-001", "2026-09-01T17:00:00+00:00", { created_at: "2026-09-05T01:00:00+00:00" }),
      po("PO-002", "2026-09-01T17:00:00+00:00", { created_at: "2026-09-06T01:00:00+00:00" }),
      po("PO-003", "2026-09-01T17:00:00+00:00", { created_at: "2026-09-06T01:00:00+00:00" }),
    ];
    expect(listPurchaseOrdersPage({ ...base, orders, filters: {} }).rows.map(x => x.id))
      .toEqual(["PO-003", "PO-002", "PO-001"]);
  });

  it("keeps a Saigon-midnight slip on the first day of the range (PO-188)", () => {
    const from23 = listPurchaseOrdersPage({ ...base, orders: real, filters: { from: "2026-09-23", to: "2026-09-23" } });
    expect(from23.rows.map(x => x.id)).toEqual(["PO-188"]);
    const upTo22 = listPurchaseOrdersPage({ ...base, orders: real, filters: { from: "2026-09-01", to: "2026-09-22" } });
    expect(upTo22.rows).toEqual([]);
  });

  it("filters with only one end of the range set", () => {
    expect(listPurchaseOrdersPage({ ...base, orders: real, filters: { from: "2026-09-24" } }).rows.map(x => x.id))
      .toEqual(["PO-191", "PO-190"]);
    expect(listPurchaseOrdersPage({ ...base, orders: real, filters: { to: "2026-09-23" } }).rows.map(x => x.id))
      .toEqual(["PO-188"]);
  });

  it("ignores a reversed range and flags it", () => {
    const r = listPurchaseOrdersPage({ ...base, orders: real, filters: { from: "2026-09-28", to: "2026-09-01" } });
    expect(r.rangeError).toBe(true);
    expect(r.total).toBe(3);
  });

  it("searches code, supplier name, supplier invoice code and item names, case-insensitively", () => {
    const ids = (q: string) => listPurchaseOrdersPage({ ...base, orders: real, filters: { q } }).rows.map(x => x.id);
    expect(ids("po-188")).toEqual(["PO-188"]);
    expect(ids("VINAMILK")).toEqual(["PO-190"]);
    expect(ids("hd-77")).toEqual(["PO-190"]);
    expect(ids("sữa tươi")).toEqual(["PO-190"]);
    expect(ids("   ")).toHaveLength(3);
  });

  it("filters by status and supplier", () => {
    const orders = [...real, po("PO-192", "2026-09-29T01:00:00+00:00", { status: "DRAFT" })];
    expect(listPurchaseOrdersPage({ ...base, orders, filters: { status: "DRAFT" } }).rows.map(x => x.id)).toEqual(["PO-192"]);
    expect(listPurchaseOrdersPage({ ...base, orders, filters: { supplier: "SUP-2" } }).rows.map(x => x.id)).toEqual(["PO-190"]);
  });

  it("shows a dash for a supplier or source that no longer resolves", () => {
    const r = listPurchaseOrdersPage({ ...base, orders: [po("PO-9", "2026-09-01T00:00:00Z", { supplier_id: "GONE", source_id: "" })], filters: {} });
    expect(r.rows[0].supplierName).toBe("—");
    expect(r.rows[0].sourceName).toBe("—");
  });

  it("cuts 20 per page and clamps bad page numbers", () => {
    const orders = Array.from({ length: 45 }, (_, i) =>
      po(`PO-${String(i + 1).padStart(3, "0")}`, new Date(Date.UTC(2026, 8, 1) + i * 3600_000).toISOString()));
    const p = (page?: string) => listPurchaseOrdersPage({ ...base, orders, filters: { page } });
    expect(p().rows).toHaveLength(20);
    expect(p().rows[0].id).toBe("PO-045");
    expect(p("2").rows[0].id).toBe("PO-025");
    expect(p("2")).toMatchObject({ page: 2, pageCount: 3, firstIndex: 21, lastIndex: 40, total: 45 });
    expect(p("3").rows).toHaveLength(5);
    expect(p("abc").page).toBe(1);
    expect(p("0").page).toBe(1);
    expect(p("-2").page).toBe(1);
    expect(p("999")).toMatchObject({ page: 3, firstIndex: 41, lastIndex: 45 });
  });

  it("returns one empty page when nothing matches", () => {
    const r = listPurchaseOrdersPage({ ...base, orders: real, filters: { q: "không có" } });
    expect(r).toMatchObject({ rows: [], total: 0, page: 1, pageCount: 1, firstIndex: 0, lastIndex: 0 });
  });
});
