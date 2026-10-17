// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { ItemPicker } from "./ItemPicker";
import type { OptionGroup, OptionRow, ProductOptionGroup } from "@/lib/sales/option-groups";

afterEach(() => {
  cleanup();
});

const product = { id: "P1", name: "Trà sữa truyền thống" };
const variants = [
  { id: "V1", product_id: "P1", size_name: "M", price: 18000 },
  { id: "V2", product_id: "P1", size_name: "L", price: 23000 },
];

const sugarGroup: OptionGroup = {
  id: "MG-2",
  name: "Mức đường",
  selection_mode: "ONE",
  max_total: null,
  allow_standalone: false,
  sort_order: 1,
  status: "ACTIVE",
};

const sugarOptions: OptionRow[] = [
  { id: "S1", name: "Ít đường", price: 0, status: "ACTIVE", group_id: "MG-2", is_default: false, max_qty: null, product_id: null },
  { id: "S2", name: "Bình thường", price: 0, status: "ACTIVE", group_id: "MG-2", is_default: true, max_qty: null, product_id: null },
];

const sugarProductGroup: ProductOptionGroup = {
  group: sugarGroup,
  options: sugarOptions,
  defaultId: "S2",
};

const toppingGroup: OptionGroup = {
  id: "MG-1",
  name: "Thêm Topping",
  selection_mode: "MANY",
  max_total: 3,
  allow_standalone: true,
  sort_order: 50,
  status: "ACTIVE",
};

const toppingOptions: OptionRow[] = [
  { id: "T1", name: "Trân châu trắng", price: 5000, status: "ACTIVE", group_id: "MG-1", is_default: false, max_qty: 2, product_id: null },
];

const toppingProductGroup: ProductOptionGroup = {
  group: toppingGroup,
  options: toppingOptions,
  defaultId: null,
};

describe("ItemPicker", () => {
  it("renders product name, sizes and option groups", () => {
    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[sugarProductGroup, toppingProductGroup]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={null}
        isEditing={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Trà sữa truyền thống")).toBeInTheDocument();
    expect(screen.getByText("Cỡ ly")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("Mức đường")).toBeInTheDocument();
    expect(screen.getByText("Thêm Topping")).toBeInTheDocument();
  });

  it("submits configured variant, quantity and modifiers", () => {
    const onSubmit = vi.fn();
    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[sugarProductGroup, toppingProductGroup]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={null}
        isEditing={false}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    );

    // Add topping (aria-label "Thêm một phần Trân châu trắng" preserved)
    const addTc = screen.getByRole("button", { name: "Thêm một phần Trân châu trắng" });
    fireEvent.click(addTc);

    // Click submit button (accessible name starting with "Thêm vào đơn")
    const submitBtn = screen.getByRole("button", { name: /^Thêm vào đơn/ });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: expect.objectContaining({ id: "V1" }),
        modifiers: [expect.objectContaining({ id: "T1", name: "Trân châu trắng", price: 5000 })],
        qty: 1,
      })
    );
  });

  it("renders with no option groups when groups is empty", () => {
    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={null}
        isEditing={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Cỡ ly")).toBeInTheDocument();
    expect(screen.queryByText("Mức đường")).toBeNull();
    expect(screen.queryByText("Thêm Topping")).toBeNull();
  });

  it("uses primary colour tokens instead of warning for selected size and main button", () => {
    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[sugarProductGroup, toppingProductGroup]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={null}
        isEditing={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const selectedSizeBtn = screen.getByText("M").closest("button")!;
    expect(selectedSizeBtn.className).toContain("border-primary");
    expect(selectedSizeBtn.className).not.toContain("border-warning");

    const submitBtn = screen.getByRole("button", { name: /^Thêm vào đơn/ });
    expect(submitBtn.className).toContain("bg-primary");
    expect(submitBtn.className).not.toContain("bg-warning");
  });

  // Task 4a Test 6
  it("inside the picker, the discount box is not type='number'", () => {
    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={null}
        isEditing={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // If discount is inside a collapsed disclosure, expand it
    const disclosureBtn = screen.queryByRole("button", { name: /Giảm giá món/i });
    if (disclosureBtn && disclosureBtn.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(disclosureBtn);
    }

    const discountInput = screen.getByLabelText("Giảm giá sản phẩm");
    expect(discountInput).not.toHaveAttribute("type", "number");
  });

  // Task 4a Test 9
  it("the picker's + is disabled at 99", () => {
    const lineAt99 = {
      product_id: product.id,
      product_name: product.name,
      variant_id: variants[0].id,
      size_name: variants[0].size_name,
      unit_price: variants[0].price,
      qty: 99,
      discount_amount: 0,
      discount_type: "VND",
      modifiers: [],
    };

    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={lineAt99 as any}
        isEditing={true}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const plusBtn = screen.getByRole("button", { name: "Thêm số lượng" });
    expect(plusBtn).toBeDisabled();
  });

  it("editing a line with quantity above 99 preserves quantity and caps at that quantity", () => {
    const lineAt105 = {
      product_id: product.id,
      product_name: product.name,
      variant_id: variants[0].id,
      size_name: variants[0].size_name,
      unit_price: variants[0].price,
      qty: 105,
      discount_amount: 0,
      discount_type: "VND",
      modifiers: [],
    };
    const onSubmit = vi.fn();

    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={lineAt105 as any}
        isEditing={true}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("105")).toBeInTheDocument();

    const plusBtn = screen.getByRole("button", { name: "Thêm số lượng" });
    expect(plusBtn).toBeDisabled();

    const submitBtn = screen.getByRole("button", { name: /^Cập nhật/ });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ qty: 105 })
    );
  });

  it("groups thousands while typing in per-item discount box (shows 10,000 and reflects total)", () => {
    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={null}
        isEditing={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const disclosureBtn = screen.getByRole("button", { name: /Giảm giá món/i });
    fireEvent.click(disclosureBtn);

    const itemDiscountInput = screen.getByLabelText("Giảm giá sản phẩm");
    fireEvent.change(itemDiscountInput, { target: { value: "10000" } });
    expect(itemDiscountInput).toHaveValue("10,000");
    // Variant 1 price is 18,000; with 10,000 discount, net total is 8,000
    expect(screen.getByRole("button", { name: /Thêm vào đơn · 8,000/ })).toBeInTheDocument();
  });

  it("shows max message when typing above limit and applied discount equals limit", () => {
    const onSubmit = vi.fn();
    render(
      <ItemPicker
        product={product}
        variants={variants}
        groups={[]}
        promoVariantsMap={new Map()}
        promotions={[]}
        brandId="BR-001"
        initialLine={null}
        isEditing={false}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    );

    const disclosureBtn = screen.getByRole("button", { name: /Giảm giá món/i });
    fireEvent.click(disclosureBtn);

    const itemDiscountInput = screen.getByLabelText("Giảm giá sản phẩm");
    // First over-limit entry: clamped value flows back into the box
    fireEvent.change(itemDiscountInput, { target: { value: "25000" } });
    expect(itemDiscountInput).toHaveValue("18,000");
    // Second over-limit entry clamps to the same value, so the box keeps the text: the message must explain
    fireEvent.change(itemDiscountInput, { target: { value: "180000" } });
    fireEvent.blur(itemDiscountInput);
    expect(screen.getByText("Tối đa 18,000đ")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /^Thêm vào đơn/ });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ discountAmount: 18_000 })
    );
  });
});
