// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import POSScreen from "./POSScreen";
import type { OptionGroup, OptionRow, GroupLink } from "@/lib/sales/option-groups";

vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn(),
  getPOSDrafts: vi.fn().mockResolvedValue([]),
  savePOSDraft: vi.fn(),
  deletePOSDraft: vi.fn(),
  reportPosSyncFailure: vi.fn(),
}));

vi.mock("@/lib/pos/pos-offline-queue", () => ({
  enqueuePendingOrder: vi.fn(),
  incrementAttemptCount: vi.fn(),
  listPendingOrders: vi.fn().mockResolvedValue([]),
  removePendingOrder: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(),
  confirm: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const categories = [{ id: "CAT-1", name: "Đồ uống" }, { id: "CAT-2", name: "Đồ ăn" }];
const products = [
  { id: "TRA", name: "Trà sữa", category_id: "CAT-1" },
  { id: "KHOAI", name: "Khoai lang", category_id: "CAT-2" },
];
const variants = [
  { id: "V-TRA", product_id: "TRA", size_name: "Ly", price: 20000 },
  { id: "V-KHOAI", product_id: "KHOAI", size_name: "Phần", price: 15000 },
];
const optionGroups: OptionGroup[] = [
  { id: "MG-1", name: "Thêm Topping", selection_mode: "MANY", max_total: 3, allow_standalone: true, sort_order: 50, status: "ACTIVE" },
];
const optionGroupLinks: GroupLink[] = [
  { group_id: "MG-1", product_id: "TRA" },
];
const modifiers: OptionRow[] = [
  { id: "T1", name: "Trân châu trắng", price: 5000, status: "ACTIVE", group_id: "MG-1", is_default: false, max_qty: 2, product_id: null },
];

describe("POSScreen option group integration", () => {
  it("opens modal with option groups for linked drink dish, but not for unlinked dish", () => {
    render(
      <POSScreen
        categories={categories}
        products={products}
        variants={variants}
        modifiers={modifiers}
        optionGroups={optionGroups}
        optionGroupLinks={optionGroupLinks}
        bestSellers={["TRA", "KHOAI"]}
      />
    );

    // Click Trà sữa
    const traBtn = screen.getByText("Trà sữa");
    fireEvent.click(traBtn);

    // Trà sữa should show Thêm Topping
    expect(screen.getByText("Thêm Topping")).toBeInTheDocument();
    expect(screen.getByText("Trân châu trắng")).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole("button", { name: "Đóng" });
    fireEvent.click(closeBtn);

    // Click Khoai lang
    const khoaiBtn = screen.getByText("Khoai lang");
    fireEvent.click(khoaiBtn);

    // Khoai lang has no links, so no option group is shown
    expect(screen.queryByText("Thêm Topping")).toBeNull();
    expect(screen.queryByText("Trân châu trắng")).toBeNull();
  });
});

describe("one menu for both brands (BR-CATALOG-006)", () => {
  it.todo(
    "Hai thương hiệu bán chung một thực đơn; máy bán không lọc món theo thương hiệu (chủ quán chốt 15/10/2026)",
  );
});
