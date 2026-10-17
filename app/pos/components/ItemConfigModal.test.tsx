// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { ItemConfigModal } from "./ItemConfigModal";
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

describe("ItemConfigModal with OptionGroupPicker", () => {
  it("renders product name, sizes and option groups", () => {
    render(
      <ItemConfigModal
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
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("Mức đường")).toBeInTheDocument();
    expect(screen.getByText("Thêm Topping")).toBeInTheDocument();
  });

  it("submits configured variant, quantity and modifiers", () => {
    const onSubmit = vi.fn();
    render(
      <ItemConfigModal
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

    // Add topping
    const addTc = screen.getByRole("button", { name: "Thêm một phần Trân châu trắng" });
    fireEvent.click(addTc);

    // Click THÊM button
    const submitBtn = screen.getByRole("button", { name: /^THÊM -/ });
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
      <ItemConfigModal
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

    expect(screen.queryByText("Mức đường")).toBeNull();
    expect(screen.queryByText("Thêm Topping")).toBeNull();
  });

  it("uses primary colour tokens instead of warning for selected size and main button", () => {
    render(
      <ItemConfigModal
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
    expect(screen.getByText("M").className).toContain("text-primary");

    const submitBtn = screen.getByRole("button", { name: /^THÊM -/ });
    expect(submitBtn.className).toContain("bg-primary");
    expect(submitBtn.className).not.toContain("bg-warning");
  });
});
