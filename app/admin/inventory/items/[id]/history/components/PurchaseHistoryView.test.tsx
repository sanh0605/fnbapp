// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PurchaseHistoryView } from "./PurchaseHistoryView";
import type { ItemPurchaseHistoryRow } from "@/lib/purchasing/item-purchase-history";

describe("PurchaseHistoryView", () => {
  it("renders empty message when rows is empty", () => {
    render(<PurchaseHistoryView rows={[]} itemName="Cà phê Robusta" />);
    expect(
      screen.getByText("Chưa có lần nhập hàng nào đã hoàn thành cho mặt hàng này."),
    ).toBeInTheDocument();
  });

  it("renders price trend warning when latest price increased and includes link to purchase order", () => {
    // In computeItemPurchaseHistory, rows are newest date first.
    // row 0 is latest (e.g. 50,000), row 1 is previous (e.g. 40,000) -> price trend "up"
    const rows: ItemPurchaseHistoryRow[] = [
      {
        poId: "PO-002",
        supplierId: "SUP-1",
        date: "2026-09-10",
        supplierName: "Nhà cung cấp A",
        quantity: 10,
        unitLabel: "Bao",
        unitCost: 50000,
        lineTotal: 500000,
      },
      {
        poId: "PO-001",
        supplierId: "SUP-1",
        date: "2026-09-01",
        supplierName: "Nhà cung cấp A",
        quantity: 10,
        unitLabel: "Bao",
        unitCost: 40000,
        lineTotal: 400000,
      },
    ];

    render(<PurchaseHistoryView rows={rows} itemName="Cà phê Robusta" />);

    expect(screen.getByText(/Giá nhập gần nhất tăng/i)).toBeInTheDocument();
    
    // Check links to purchase orders
    const links = screen.getAllByRole("link");
    const po2Links = links.filter((l) => l.getAttribute("href") === "/admin/inventory/purchase-orders/PO-002");
    const po1Links = links.filter((l) => l.getAttribute("href") === "/admin/inventory/purchase-orders/PO-001");
    expect(po2Links.length).toBeGreaterThan(0);
    expect(po1Links.length).toBeGreaterThan(0);
  });
});
