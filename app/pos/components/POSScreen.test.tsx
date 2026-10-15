// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import POSScreen from "./POSScreen";
import { formatNumber } from "@/lib/shared/format";
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
  it("shows a dish whose brand differs from the outlet's brand", () => {
    render(
      <POSScreen
        brandId="BR-002"
        categories={categories}
        products={[{ id: "TRA", name: "Trà sữa", category_id: "CAT-1", brand_id: "BR-001" }]}
        variants={variants}
        modifiers={[]}
        optionGroups={[]}
        optionGroupLinks={[]}
        bestSellers={["TRA"]}
      />
    );

    expect(screen.getByText("Trà sữa")).toBeInTheDocument();
  });
});

describe("priceCart in POS till (Phiếu G6)", () => {
  it("BR-SALE-010: one line 100.000đ, whole-order promotion 10%, cashier's whole-order discount 5.000đ → total shows 85.000", async () => {
    render(
      <POSScreen
        brandId="BR-001"
        outletId="OUT-001"
        categories={[{ id: "CAT-1", name: "Đồ uống" }]}
        products={[{ id: "TRA-LON", name: "Trà lớn", category_id: "CAT-1", brand_id: "BR-001" }]}
        variants={[{ id: "V-TRA-LON", product_id: "TRA-LON", size_name: "L", price: 100000 }]}
        modifiers={[]}
        optionGroups={[]}
        optionGroupLinks={[]}
        promotions={[
          {
            id: "PR-ORD-10",
            name: "Giảm 10% cả đơn",
            type: "ORDER_DISCOUNT",
            discount_type: "PERCENT",
            discount_value: 10,
            status: "ACTIVE",
            start_date: "2020-01-01T00:00:00.000Z",
            end_date: "2030-01-01T00:00:00.000Z",
            min_order_value: 0,
            brand_id: "",
            code: "",
          },
        ]}
        bestSellers={["TRA-LON"]}
      />
    );

    // Open Trà lớn modal and add to cart
    fireEvent.click(screen.getByText("Trà lớn"));
    fireEvent.click(screen.getByRole("button", { name: /THÊM/i }));

    // Cart shows promotion
    expect(screen.getByText("Khuyến mãi hệ thống")).toBeInTheDocument();

    // Enter cashier's whole-order discount 5.000
    const customDiscountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
    fireEvent.change(customDiscountInput, { target: { value: "5000" } });

    // Both discounts show and stack
    expect(screen.getByText("Giảm giá Hoá đơn")).toBeInTheDocument();
    expect(screen.getByText("Khuyến mãi hệ thống")).toBeInTheDocument();

    // Total shows 85.000
    expect(screen.getAllByText(formatNumber(85000)).length).toBeGreaterThan(0);
  });

  it("BR-SALE-009: Bạc xỉu 29.000 with a 4.000đ dish discount + Cà phê sữa 25.000, cashier's 10% whole order → 45.000", async () => {
    render(
      <POSScreen
        brandId="BR-001"
        outletId="OUT-001"
        categories={[{ id: "CAT-1", name: "Đồ uống" }]}
        products={[
          { id: "P-BX", name: "Bạc xỉu", category_id: "CAT-1", brand_id: "BR-001" },
          { id: "P-CPS", name: "Cà phê sữa", category_id: "CAT-1", brand_id: "BR-001" },
        ]}
        variants={[
          { id: "V-BX", product_id: "P-BX", size_name: "M", price: 29000 },
          { id: "V-CPS", product_id: "P-CPS", size_name: "M", price: 25000 },
        ]}
        modifiers={[]}
        optionGroups={[]}
        optionGroupLinks={[]}
        promotions={[]}
        bestSellers={["P-BX", "P-CPS"]}
      />
    );

    // Add Bạc xỉu with 4.000 manual dish discount
    fireEvent.click(screen.getByText("Bạc xỉu"));
    const dishDiscountInput = screen.getByLabelText("Giảm giá sản phẩm");
    fireEvent.change(dishDiscountInput, { target: { value: "4000" } });
    fireEvent.click(screen.getByRole("button", { name: /THÊM/i }));

    // Add Cà phê sữa with no discount
    fireEvent.click(screen.getByText("Cà phê sữa"));
    fireEvent.click(screen.getByRole("button", { name: /THÊM/i }));

    // Switch order discount type to %
    const percentButtons = screen.getAllByRole("button", { name: "%" });
    fireEvent.click(percentButtons[percentButtons.length - 1]);

    // Enter 10%
    const customDiscountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
    fireEvent.change(customDiscountInput, { target: { value: "10" } });

    // Total shows 45.000
    expect(screen.getAllByText(formatNumber(45000)).length).toBeGreaterThan(0);
  });

  it("BR-SALE-011: Bạc xỉu ×4 = 116.000 with a 5.000đ dish discount per cup typed by the cashier, whole-order promotion min 100.000 → total 96.000", async () => {
    render(
      <POSScreen
        brandId="BR-001"
        outletId="OUT-001"
        categories={[{ id: "CAT-1", name: "Đồ uống" }]}
        products={[{ id: "P-BX", name: "Bạc xỉu", category_id: "CAT-1", brand_id: "BR-001" }]}
        variants={[{ id: "V-BX", product_id: "P-BX", size_name: "M", price: 29000 }]}
        modifiers={[]}
        optionGroups={[]}
        optionGroupLinks={[]}
        promotions={[
          {
            id: "PR-ORD-MIN100",
            name: "Giảm 10% đơn từ 100k",
            type: "ORDER_DISCOUNT",
            discount_type: "PERCENT",
            discount_value: 10,
            status: "ACTIVE",
            start_date: "2020-01-01T00:00:00.000Z",
            end_date: "2030-01-01T00:00:00.000Z",
            min_order_value: 100000,
            brand_id: "",
            code: "",
          },
        ]}
        bestSellers={["P-BX"]}
      />
    );

    // Open Bạc xỉu modal
    fireEvent.click(screen.getByText("Bạc xỉu"));

    // Increase qty to 4 (click '+' button 3 times)
    const plusBtn = screen.getByRole("button", { name: "+" });
    fireEvent.click(plusBtn);
    fireEvent.click(plusBtn);
    fireEvent.click(plusBtn);

    // Cashier types 5.000/cup dish discount = 20.000
    const dishDiscountInput = screen.getByLabelText("Giảm giá sản phẩm");
    fireEvent.change(dishDiscountInput, { target: { value: "20000" } });
    fireEvent.click(screen.getByRole("button", { name: /THÊM/i }));

    // Promotion min order value is 100.000; base after dish discount is 96.000 < 100.000, so does not apply
    expect(screen.queryByText("Khuyến mãi hệ thống")).toBeNull();
    expect(screen.getAllByText(formatNumber(96000)).length).toBeGreaterThan(0);
  });

  it("A coded promotion sends promo_code in the submit payload", async () => {
    const { submitOrderV2 } = await import("@/app/pos/actions");
    (submitOrderV2 as any).mockResolvedValue({ success: true });

    render(
      <POSScreen
        brandId="BR-001"
        outletId="OUT-001"
        categories={[{ id: "CAT-1", name: "Đồ uống" }]}
        products={[{ id: "P-BX", name: "Bạc xỉu", category_id: "CAT-1", brand_id: "BR-001" }]}
        variants={[{ id: "V-BX", product_id: "P-BX", size_name: "M", price: 29000 }]}
        modifiers={[]}
        optionGroups={[]}
        optionGroupLinks={[]}
        promotions={[
          {
            id: "PR-CODE",
            name: "Mã khai trương",
            type: "ORDER_DISCOUNT",
            discount_type: "FLAT_VND",
            discount_value: 5000,
            status: "ACTIVE",
            start_date: "2020-01-01T00:00:00.000Z",
            end_date: "2030-01-01T00:00:00.000Z",
            min_order_value: 0,
            brand_id: "",
            code: "KHAITRUONG",
          },
        ]}
        bestSellers={["P-BX"]}
      />
    );

    // Add Bạc xỉu to cart
    fireEvent.click(screen.getByText("Bạc xỉu"));
    fireEvent.click(screen.getByRole("button", { name: /THÊM/i }));

    // Type promo code
    const promoCodeInput = screen.getByLabelText("Mã giảm giá");
    fireEvent.change(promoCodeInput, { target: { value: "KHAITRUONG" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    // Promotion is applied
    expect(screen.getByText("Mã khai trương")).toBeInTheDocument();

    // Confirm checkout via Tiền mặt
    fireEvent.click(screen.getByText("TIỀN MẶT"));

    expect(submitOrderV2).toHaveBeenCalled();
    const submittedPayload = (submitOrderV2 as any).mock.calls[0][0];
    expect(submittedPayload.applied_promotion_id).toBe("PR-CODE");
    expect(submittedPayload.promo_code).toBe("KHAITRUONG");
  });

  it("ItemConfigModal shows promotion price from priceCart for a single item", () => {
    render(
      <POSScreen
        brandId="BR-001"
        outletId="OUT-001"
        categories={[{ id: "CAT-1", name: "Đồ uống" }]}
        products={[{ id: "TRA-LON", name: "Trà lớn", category_id: "CAT-1", brand_id: "BR-001" }]}
        variants={[{ id: "V-TRA-LON", product_id: "TRA-LON", size_name: "L", price: 100000 }]}
        modifiers={[]}
        optionGroups={[]}
        optionGroupLinks={[]}
        promotions={[
          {
            id: "PR-ORD-10",
            name: "Giảm 10% cả đơn",
            type: "ORDER_DISCOUNT",
            discount_type: "PERCENT",
            discount_value: 10,
            status: "ACTIVE",
            start_date: "2020-01-01T00:00:00.000Z",
            end_date: "2030-01-01T00:00:00.000Z",
            min_order_value: 0,
            brand_id: "",
            code: "",
          },
        ]}
        bestSellers={["TRA-LON"]}
      />
    );

    // Add first item so appliedPromo is active
    fireEvent.click(screen.getByText("Trà lớn"));
    fireEvent.click(screen.getByRole("button", { name: /THÊM/i }));

    // Open modal again for another item - appliedPromo is Giảm 10% cả đơn
    fireEvent.click(screen.getAllByText("Trà lớn")[0]);
    expect(screen.getByRole("button", { name: new RegExp(`THÊM - ${formatNumber(90000)}`, "i") })).toBeInTheDocument();
    expect(screen.getByText(`Gốc: ${formatNumber(100000)}`)).toBeInTheDocument();
  });

  it("a promotion whose end date is in the past at pricing time is not applied", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-06-01T10:00:00.000Z"));

      render(
        <POSScreen
          brandId="BR-001"
          outletId="OUT-001"
          categories={[{ id: "CAT-1", name: "Đồ uống" }]}
          products={[{ id: "TRA-LON", name: "Trà lớn", category_id: "CAT-1", brand_id: "BR-001" }]}
          variants={[{ id: "V-TRA-LON", product_id: "TRA-LON", size_name: "L", price: 100000 }]}
          modifiers={[]}
          optionGroups={[]}
          optionGroupLinks={[]}
          promotions={[
            {
              id: "PR-EXP",
              name: "Khuyến mãi hết hạn",
              type: "ORDER_DISCOUNT",
              discount_type: "PERCENT",
              discount_value: 10,
              status: "ACTIVE",
              start_date: "2026-06-01T00:00:00.000Z",
              end_date: "2026-06-01T11:00:00.000Z",
              min_order_value: 0,
              brand_id: "",
              code: "",
            },
          ]}
          bestSellers={["TRA-LON"]}
        />
      );

      // Advance time past the promotion's end date
      vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));

      // Open Trà lớn modal and add to cart (pricing memo runs at current system time)
      fireEvent.click(screen.getByText("Trà lớn"));
      fireEvent.click(screen.getByRole("button", { name: /THÊM/i }));

      // Promotion is not applied because end_date is in the past
      expect(screen.queryByText("Khuyến mãi hệ thống")).toBeNull();
      expect(screen.getAllByText(formatNumber(100000)).length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("100,000 order, a 10% whole-order promotion, cashier 10% → the line shows 9,000 and the total is 81,000", () => {
    render(
      <POSScreen
        brandId="BR-001"
        outletId="OUT-001"
        categories={[{ id: "CAT-1", name: "Đồ uống" }]}
        products={[{ id: "TRA-LON", name: "Trà lớn", category_id: "CAT-1", brand_id: "BR-001" }]}
        variants={[{ id: "V-TRA-LON", product_id: "TRA-LON", size_name: "L", price: 100000 }]}
        modifiers={[]}
        optionGroups={[]}
        optionGroupLinks={[]}
        promotions={[
          {
            id: "PR-ORD-10",
            name: "Giảm 10% cả đơn",
            type: "ORDER_DISCOUNT",
            discount_type: "PERCENT",
            discount_value: 10,
            status: "ACTIVE",
            start_date: "2020-01-01T00:00:00.000Z",
            end_date: "2030-01-01T00:00:00.000Z",
            min_order_value: 0,
            brand_id: "",
            code: "",
          },
        ]}
        bestSellers={["TRA-LON"]}
      />
    );

    // Add 100,000 item to cart
    fireEvent.click(screen.getByText("Trà lớn"));
    fireEvent.click(screen.getByRole("button", { name: /THÊM/i }));

    // Switch custom discount to %
    const percentButtons = screen.getAllByRole("button", { name: "%" });
    fireEvent.click(percentButtons[percentButtons.length - 1]);

    // Cashier types 10%
    const customDiscountInput = screen.getByLabelText("Giảm giá tùy chỉnh");
    fireEvent.change(customDiscountInput, { target: { value: "10" } });

    // The "Giảm giá Hoá đơn" line shows 9,000 (10% of 90,000 remaining after 10% promo)
    expect(screen.getByText("Giảm giá Hoá đơn")).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(formatNumber(9000))).length).toBeGreaterThan(0);

    // Total shows 81,000
    expect(screen.getAllByText(new RegExp(formatNumber(81000))).length).toBeGreaterThan(0);
  });
});
