// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ModifierGroupForm } from "./ModifierGroupForm";
import type { DBModifierGroup, DBProductCategory, DBProduct } from "@/types/db";

const { push, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  return {
    push: pushFn,
    router: { push: pushFn, refresh: vi.fn() },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/app/admin/products/modifier-groups/actions", () => ({
  saveModifierGroup: vi.fn(),
  updateModifierGroup: vi.fn(),
}));

import { saveModifierGroup, updateModifierGroup } from "@/app/admin/products/modifier-groups/actions";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleCategories: DBProductCategory[] = [
  { id: "CAT-001", name: "Cà phê", status: "ACTIVE", type_id: "PT-001" },
  { id: "CAT-002", name: "Trà", status: "ACTIVE", type_id: "PT-001" },
];

const sampleProducts: DBProduct[] = [
  { id: "PROD-001", code: "CF01", name: "Cà phê đen", category_id: "CAT-001", status: "ACTIVE" },
  { id: "PROD-002", code: "CF02", name: "Cà phê sữa", category_id: "CAT-001", status: "ACTIVE" },
  { id: "PROD-003", code: "TR01", name: "Trà đào", category_id: "CAT-002", status: "ACTIVE" },
  { id: "PROD-004", code: "TR02", name: "Trà vải", category_id: "CAT-002", status: "ACTIVE" },
];

const sampleGroup: DBModifierGroup = {
  id: "MG-001",
  name: "Thêm Topping",
  selection_mode: "MANY",
  max_total: 3,
  allow_standalone: true,
  sort_order: 50,
  status: "ACTIVE",
};

describe("ModifierGroupForm", () => {
  it("the form hides 'Tối đa mấy phần' and 'Cho bán riêng' when Chọn một is chosen", () => {
    render(
      <ModifierGroupForm
        categories={sampleCategories}
        products={sampleProducts}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const modeSelect = screen.getByLabelText("Kiểu chọn") as HTMLSelectElement;

    // Default is MANY: both fields are visible
    expect(modeSelect.value).toBe("MANY");
    expect(screen.getByLabelText("Tối đa mấy phần")).toBeInTheDocument();
    expect(screen.getByLabelText(/Cho bán riêng/)).toBeInTheDocument();

    // Switch to ONE
    fireEvent.change(modeSelect, { target: { value: "ONE" } });

    // Both fields must be hidden
    expect(screen.queryByLabelText("Tối đa mấy phần")).toBeNull();
    expect(screen.queryByLabelText(/Cho bán riêng/)).toBeNull();

    // Switch back to MANY
    fireEvent.change(modeSelect, { target: { value: "MANY" } });
    expect(screen.getByLabelText("Tối đa mấy phần")).toBeInTheDocument();
    expect(screen.getByLabelText(/Cho bán riêng/)).toBeInTheDocument();
  });

  it("'Chọn cả nhóm' ticks every dish of one dish group", () => {
    render(
      <ModifierGroupForm
        categories={sampleCategories}
        products={sampleProducts}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const cfBlack = screen.getByLabelText("Cà phê đen") as HTMLInputElement;
    const cfMilk = screen.getByLabelText("Cà phê sữa") as HTMLInputElement;
    const teaPeach = screen.getByLabelText("Trà đào") as HTMLInputElement;

    expect(cfBlack.checked).toBe(false);
    expect(cfMilk.checked).toBe(false);
    expect(teaPeach.checked).toBe(false);

    // Find the "Chọn cả nhóm" button or checkbox for "Cà phê"
    const selectAllButtons = screen.getAllByRole("button", { name: "Chọn cả nhóm" });
    const selectAllCoffee = selectAllButtons[0];
    fireEvent.click(selectAllCoffee);

    // Both dishes in Cà phê become checked
    expect(cfBlack.checked).toBe(true);
    expect(cfMilk.checked).toBe(true);
    // Trà dishes remain unchecked
    expect(teaPeach.checked).toBe(false);

    // Clicking "Chọn cả nhóm" again unchecks all dishes in that group
    fireEvent.click(selectAllCoffee);
    expect(cfBlack.checked).toBe(false);
    expect(cfMilk.checked).toBe(false);

    // If only one is checked, clicking "Chọn cả nhóm" selects the rest of the group
    fireEvent.click(cfBlack);
    expect(cfBlack.checked).toBe(true);
    expect(cfMilk.checked).toBe(false);

    fireEvent.click(selectAllCoffee);
    expect(cfBlack.checked).toBe(true);
    expect(cfMilk.checked).toBe(true);
  });

  it("submits form and calls saveModifierGroup on create", async () => {
    (saveModifierGroup as any).mockResolvedValue({ success: true });
    render(
      <ModifierGroupForm
        categories={sampleCategories}
        products={sampleProducts}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const nameInput = screen.getByLabelText(/^Tên nhóm/);
    fireEvent.change(nameInput, { target: { value: "Mức đường" } });

    const sortOrderInput = screen.getByLabelText(/Thứ tự hiện/);
    fireEvent.change(sortOrderInput, { target: { value: "10" } });

    const modeSelect = screen.getByLabelText("Kiểu chọn");
    fireEvent.change(modeSelect, { target: { value: "ONE" } });

    // Tick Cà phê đen
    const cfBlack = screen.getByLabelText("Cà phê đen");
    fireEvent.click(cfBlack);

    const submitBtn = screen.getByRole("button", { name: "Tạo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(saveModifierGroup).toHaveBeenCalled();
    });

    const fd = (saveModifierGroup as any).mock.calls[0][0] as FormData;
    expect(fd.get("name")).toBe("Mức đường");
    expect(fd.get("sort_order")).toBe("10");
    expect(fd.get("selection_mode")).toBe("ONE");
    expect(fd.getAll("product_ids")).toEqual(["PROD-001"]);
    expect(push).toHaveBeenCalledWith("/admin/products/modifier-groups");
  });

  it("pre-fills fields when editing", () => {
    render(
      <ModifierGroupForm
        initialData={sampleGroup}
        initialProductIds={["PROD-001", "PROD-003"]}
        categories={sampleCategories}
        products={sampleProducts}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const nameInput = screen.getByLabelText(/^Tên nhóm/) as HTMLInputElement;
    expect(nameInput.value).toBe("Thêm Topping");

    const sortOrderInput = screen.getByLabelText(/Thứ tự hiện/) as HTMLInputElement;
    expect(sortOrderInput.value).toBe("50");

    const modeSelect = screen.getByLabelText("Kiểu chọn") as HTMLSelectElement;
    expect(modeSelect.value).toBe("MANY");

    const maxTotalInput = screen.getByLabelText("Tối đa mấy phần") as HTMLInputElement;
    expect(maxTotalInput.value).toBe("3");

    const allowStandalone = screen.getByLabelText(/Cho bán riêng/) as HTMLInputElement;
    expect(allowStandalone.checked).toBe(true);

    const cfBlack = screen.getByLabelText("Cà phê đen") as HTMLInputElement;
    expect(cfBlack.checked).toBe(true);

    const cfMilk = screen.getByLabelText("Cà phê sữa") as HTMLInputElement;
    expect(cfMilk.checked).toBe(false);

    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();
  });

  it("'Bỏ' navigates to returnTo without submitting", () => {
    render(
      <ModifierGroupForm
        categories={sampleCategories}
        products={sampleProducts}
        returnTo="/admin/products/modifier-groups?q=duong"
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Bỏ" });
    fireEvent.click(cancelButton);
    expect(push).toHaveBeenCalledWith("/admin/products/modifier-groups?q=duong");
    expect(saveModifierGroup).not.toHaveBeenCalled();
    expect(updateModifierGroup).not.toHaveBeenCalled();
  });

  it("displays server error in role=alert box on failure", async () => {
    (saveModifierGroup as any).mockResolvedValue({ error: "Tên nhóm đã có" });
    render(
      <ModifierGroupForm
        categories={sampleCategories}
        products={sampleProducts}
        returnTo="/admin/products/modifier-groups"
      />
    );

    const nameInput = screen.getByLabelText(/^Tên nhóm/);
    fireEvent.change(nameInput, { target: { value: "Thêm Topping" } });

    const submitBtn = screen.getByRole("button", { name: "Tạo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Tên nhóm đã có");
    });
  });

  it("shows FormActionBar with 'Tạo' and 'Bỏ' on create mode and controls use min-h-[48px] md:min-h-[40px] (BR-UI-014, BR-UI-015)", () => {
    render(
      <ModifierGroupForm
        categories={sampleCategories}
        products={sampleProducts}
        returnTo="/admin/products/modifier-groups"
      />
    );
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();

    const allowStandaloneLabel = screen.getByLabelText(/Cho bán riêng/).closest("label");
    expect(allowStandaloneLabel?.className).toContain("min-h-[48px]");
    expect(allowStandaloneLabel?.className).toContain("md:min-h-[40px]");
    expect(allowStandaloneLabel?.className).not.toContain("min-h-[44px]");

    const prodLabel = screen.getByLabelText("Cà phê đen").closest("label");
    expect(prodLabel?.className).toContain("min-h-[48px]");
    expect(prodLabel?.className).toContain("md:min-h-[40px]");
    expect(prodLabel?.className).not.toContain("min-h-[44px]");
  });
});
