// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import React from "react";
import { OptionGroupPicker } from "./OptionGroupPicker";
import type {
  OptionGroup,
  OptionRow,
  ProductOptionGroup,
  Pick,
} from "@/lib/sales/option-groups";

afterEach(() => {
  cleanup();
});

const sugarGroup: OptionGroup = {
  id: "MG-2",
  name: "Mức đường",
  selection_mode: "ONE",
  max_total: null,
  allow_standalone: false,
  sort_order: 1,
  status: "ACTIVE",
};

const milkGroup: OptionGroup = {
  id: "MG-3",
  name: "Loại sữa",
  selection_mode: "ONE",
  max_total: null,
  allow_standalone: false,
  sort_order: 3,
  status: "ACTIVE",
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

const sugarOptions: OptionRow[] = [
  { id: "S1", name: "Ít đường", price: 0, status: "ACTIVE", group_id: "MG-2", is_default: false, max_qty: null, product_id: null },
  { id: "S2", name: "Bình thường", price: 0, status: "ACTIVE", group_id: "MG-2", is_default: true, max_qty: null, product_id: null },
];

const milkOptions: OptionRow[] = [
  { id: "K1", name: "Sữa tươi", price: 0, status: "ACTIVE", group_id: "MG-3", is_default: true, max_qty: null, product_id: null },
  { id: "K2", name: "Sữa yến mạch", price: 8000, status: "ACTIVE", group_id: "MG-3", is_default: false, max_qty: null, product_id: null },
];

const toppingOptions: OptionRow[] = [
  { id: "T1", name: "Trân châu trắng", price: 5000, status: "ACTIVE", group_id: "MG-1", is_default: false, max_qty: 2, product_id: null },
  { id: "T2", name: "Kem muối", price: 4000, status: "ACTIVE", group_id: "MG-1", is_default: false, max_qty: null, product_id: null },
];

const sugarProductGroup: ProductOptionGroup = {
  group: sugarGroup,
  options: sugarOptions,
  defaultId: "S2",
};

const milkProductGroup: ProductOptionGroup = {
  group: milkGroup,
  options: milkOptions,
  defaultId: "K1",
};

const toppingProductGroup: ProductOptionGroup = {
  group: toppingGroup,
  options: toppingOptions,
  defaultId: null,
};

describe("OptionGroupPicker (Task 5 Step 1)", () => {
  it("Bình thường is lit with no picks", () => {
    render(
      <OptionGroupPicker
        groups={[sugarProductGroup]}
        picks={[]}
        onChange={vi.fn()}
      />
    );

    const normalBtn = screen.getByRole("radio", { name: /Bình thường/i });
    const lessBtn = screen.getByRole("radio", { name: /Ít đường/i });

    expect(screen.getByRole("radiogroup", { name: "Mức đường" })).toBeInTheDocument();
    expect(normalBtn).toHaveAttribute("aria-checked", "true");
    expect(normalBtn.className).toContain("bg-primary-soft");
    expect(normalBtn.className).not.toContain("border-primary");
    expect(normalBtn.querySelector("span")?.className).toContain("text-primary");

    expect(lessBtn).toHaveAttribute("aria-checked", "false");
    expect(lessBtn.className).not.toContain("bg-primary-soft");
    expect(lessBtn.className).not.toContain("border-primary");
  });

  it("tapping Sữa yến mạch calls onChange with [K2]", () => {
    const onChange = vi.fn();
    render(
      <OptionGroupPicker
        groups={[milkProductGroup]}
        picks={[]}
        onChange={onChange}
      />
    );

    const oatBtn = screen.getByRole("radio", { name: /Sữa yến mạch/i });
    fireEvent.click(oatBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { id: "K2", name: "Sữa yến mạch", price: 8000 },
    ]);
  });

  it("'+' on Trân châu trắng is disabled at x2", () => {
    const picks: Pick[] = [
      { id: "T1", name: "Trân châu trắng", price: 5000 },
      { id: "T1", name: "Trân châu trắng", price: 5000 },
    ];

    render(
      <OptionGroupPicker
        groups={[toppingProductGroup]}
        picks={picks}
        onChange={vi.fn()}
      />
    );

    const tcRow = screen.getByText("Trân châu trắng").closest("div.flex")?.parentElement;
    expect(tcRow).toBeDefined();

    const plusBtn = within(tcRow as HTMLElement).getByRole("button", { name: /Thêm một phần Trân châu trắng|\+/i });
    expect(plusBtn).toBeDisabled();

    // Kem muối (0 portions) should still have + enabled
    const kmRow = screen.getByText("Kem muối").closest("div.flex")?.parentElement;
    expect(kmRow).toBeDefined();
    const kmPlusBtn = within(kmRow as HTMLElement).getByRole("button", { name: /Thêm một phần Kem muối|\+/i });
    expect(kmPlusBtn).not.toBeDisabled();
  });

  it("an orphan pick 'Kem muối' shows under 'Đã chọn trước' and its − removes it", () => {
    const onChange = vi.fn();
    const orphanPicks: Pick[] = [
      { id: "T2", name: "Kem muối", price: 4000 },
    ];

    render(
      <OptionGroupPicker
        groups={[sugarProductGroup, milkProductGroup]}
        picks={orphanPicks}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/Đã chọn trước/i)).toBeInTheDocument();
    expect(screen.getByText("Kem muối")).toBeInTheDocument();

    const orphanSection = screen.getByText(/Đã chọn trước/i).parentElement;
    expect(orphanSection).toBeDefined();

    const removeBtn = within(orphanSection as HTMLElement).getByRole("button", { name: /Bỏ Kem muối|-/i });
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("returns null when there are no groups and no orphan picks", () => {
    const { container } = render(
      <OptionGroupPicker
        groups={[]}
        picks={[]}
        onChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("disables all '+' buttons when group max_total is reached", () => {
    const picks: Pick[] = [
      { id: "T1", name: "Trân châu trắng", price: 5000 },
      { id: "T2", name: "Kem muối", price: 4000 },
      { id: "T2", name: "Kem muối", price: 4000 },
    ];

    render(
      <OptionGroupPicker
        groups={[toppingProductGroup]}
        picks={picks}
        onChange={vi.fn()}
      />
    );

    const tcRow = screen.getByText("Trân châu trắng").closest("div.flex")?.parentElement;
    const kmRow = screen.getByText("Kem muối").closest("div.flex")?.parentElement;

    const tcPlus = within(tcRow as HTMLElement).getByRole("button", { name: /Thêm một phần Trân châu trắng|\+/i });
    const kmPlus = within(kmRow as HTMLElement).getByRole("button", { name: /Thêm một phần Kem muối|\+/i });

    expect(tcPlus).toBeDisabled();
    expect(kmPlus).toBeDisabled();
  });

  it("tapping the lit non-default option deselects it", () => {
    const onChange = vi.fn();
    const picks: Pick[] = [
      { id: "K2", name: "Sữa yến mạch", price: 8000 },
    ];

    render(
      <OptionGroupPicker
        groups={[milkProductGroup]}
        picks={picks}
        onChange={onChange}
      />
    );

    const oatBtn = screen.getByRole("radio", { name: /Sữa yến mạch/i });
    fireEvent.click(oatBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("tapping the default option when a non-default was picked restores default (removes pick)", () => {
    const onChange = vi.fn();
    const picks: Pick[] = [
      { id: "K2", name: "Sữa yến mạch", price: 8000 },
    ];

    render(
      <OptionGroupPicker
        groups={[milkProductGroup]}
        picks={picks}
        onChange={onChange}
      />
    );

    const freshBtn = screen.getByRole("radio", { name: /Sữa tươi/i });
    fireEvent.click(freshBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
