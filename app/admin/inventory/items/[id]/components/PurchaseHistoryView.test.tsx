// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchaseHistoryView } from "./PurchaseHistoryView";
import type { ItemPurchaseHistoryRow } from "@/lib/purchasing/item-purchase-history";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z: renders 15/09/2026 00:00:00", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    try {
      const rows: ItemPurchaseHistoryRow[] = [
        {
          poId: "PO-001",
          supplierId: "SUP-1",
          date: "2026-09-15",
          supplierName: "Nhà cung cấp A",
          quantity: 10,
          unitLabel: "Bao",
          unitCost: 40000,
          lineTotal: 400000,
        },
      ];

      render(<PurchaseHistoryView rows={rows} itemName="Cà phê Robusta" />);
      expect(screen.getAllByText("15/09/2026 00:00:00").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders purchase history child rows on phone as a divide-y list of PhoneRow", () => {
    const rows: ItemPurchaseHistoryRow[] = [
      {
        poId: "PO-001",
        supplierId: "SUP-1",
        date: "2026-09-15",
        supplierName: "Nhà cung cấp A",
        quantity: 10,
        unitLabel: "Bao",
        unitCost: 40000,
        lineTotal: 400000,
      },
    ];

    const { container } = render(<PurchaseHistoryView rows={rows} itemName="Cà phê Robusta" />);
    const phoneContainer = container.querySelector(".md\\:hidden");
    expect(phoneContainer).not.toBeNull();
    expect(phoneContainer?.className).toContain("divide-y");
    expect(phoneContainer?.className).not.toContain("gap-3");

    const phoneRows = phoneContainer?.querySelectorAll(":scope > div");
    expect(phoneRows?.length).toBe(1);
    const firstRow = phoneRows?.[0];
    expect(firstRow?.className).toContain("px-4");
    expect(firstRow?.className).toContain("py-2.5");
    expect(firstRow?.className).not.toContain("p-4");

    // PhoneRow: Line 1 has supplier name and total amount
    expect(firstRow?.textContent).toContain("Nhà cung cấp A");
    expect(firstRow?.textContent).toContain("400,000đ");

    // PhoneRow: Line 2 has date, quantity x unit price, and PO link
    expect(firstRow?.textContent).toContain("10 Bao × 40,000đ");
    expect(firstRow?.textContent).toContain("PO-001");

    // Old card column labels are not present on phone
    expect(firstRow?.textContent).not.toContain("Số lượng");
    expect(firstRow?.textContent).not.toContain("Đơn giá");
    expect(firstRow?.textContent).not.toContain("Thành tiền");
  });
});
