// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ProductTypeForm } from "./ProductTypeForm";
import type { DBProductType } from "@/types/db";

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

vi.mock("@/app/admin/products/types/actions", () => ({
  saveProductType: vi.fn(),
  updateProductType: vi.fn(),
}));

import { saveProductType, updateProductType } from "@/app/admin/products/types/actions";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleType: DBProductType = {
  id: "PT-001",
  name: "Thức uống",
  is_drink: true,
  created_at: "2026-10-14T09:00:00Z",
};

describe("ProductTypeForm", () => {
  it("renders the type name input and drink checkbox on the page directly", () => {
    render(<ProductTypeForm returnTo="/admin/products/types" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    const nameInput = screen.getByLabelText(/^Tên loại món/) as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.name).toBe("name");
    expect(nameInput.required).toBe(true);

    const drinkCheckbox = screen.getByLabelText("Là thức uống (tính là ly)") as HTMLInputElement;
    expect(drinkCheckbox).toBeInTheDocument();
    expect(drinkCheckbox.name).toBe("is_drink");
    expect(drinkCheckbox.checked).toBe(false);

    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
  });

  it("pre-fills fields when editing", () => {
    render(
      <ProductTypeForm
        initialData={sampleType}
        returnTo="/admin/products/types"
      />
    );

    const nameInput = screen.getByLabelText(/^Tên loại món/) as HTMLInputElement;
    expect(nameInput.value).toBe("Thức uống");

    const drinkCheckbox = screen.getByLabelText("Là thức uống (tính là ly)") as HTMLInputElement;
    expect(drinkCheckbox.checked).toBe(true);

    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();
  });

  it("'Bỏ' navigates to returnTo without submitting", () => {
    render(<ProductTypeForm returnTo="/admin/products/types?q=tra" />);
    const cancelButton = screen.getByRole("button", { name: "Bỏ" });
    fireEvent.click(cancelButton);
    expect(push).toHaveBeenCalledWith("/admin/products/types?q=tra");
    expect(saveProductType).not.toHaveBeenCalled();
    expect(updateProductType).not.toHaveBeenCalled();
  });

  it("shows FormActionBar with 'Tạo' and 'Bỏ' on create mode (BR-UI-015)", () => {
    render(<ProductTypeForm returnTo="/admin/products/types" />);
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("shows FormActionBar with 'Lưu thay đổi' and 'Bỏ thay đổi' on edit mode (BR-UI-015)", () => {
    render(<ProductTypeForm initialData={sampleType} returnTo="/admin/products/types" />);
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    const cancelButton = screen.getByRole("button", { name: "Bỏ thay đổi" });
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton);
    expect(push).toHaveBeenCalledWith("/admin/products/types");
  });

  it("controls use min-h-[48px] md:min-h-[40px] (BR-UI-014) and drink checkbox is 16px (BR-UI-014)", () => {
    render(<ProductTypeForm returnTo="/admin/products/types" />);
    const checkbox = screen.getByLabelText("Là thức uống (tính là ly)");
    expect(checkbox.className).toContain("w-4");
    expect(checkbox.className).toContain("h-4");

    const checkboxLabel = checkbox.closest("label");
    expect(checkboxLabel?.className).toContain("min-h-[48px]");
    expect(checkboxLabel?.className).toContain("md:min-h-[40px]");
    expect(checkboxLabel?.className).not.toContain("min-h-[44px]");
  });

  it("submits form and calls saveProductType with is_drink on when checked", async () => {
    (saveProductType as any).mockResolvedValue({ success: true });
    render(<ProductTypeForm returnTo="/admin/products/types" />);

    const nameInput = screen.getByLabelText(/^Tên loại món/);
    fireEvent.change(nameInput, { target: { value: "Trà sữa" } });

    const drinkCheckbox = screen.getByLabelText("Là thức uống (tính là ly)");
    fireEvent.click(drinkCheckbox);

    const submitBtn = screen.getByRole("button", { name: "Tạo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(saveProductType).toHaveBeenCalled();
    });

    const fd = (saveProductType as any).mock.calls[0][0] as FormData;
    expect(fd.get("name")).toBe("Trà sữa");
    expect(fd.get("is_drink")).toBe("on");
    expect(push).toHaveBeenCalledWith("/admin/products/types");
  });

  it("displays server error in role=alert box on failure", async () => {
    (saveProductType as any).mockResolvedValue({ error: "Tên loại món đã có" });
    render(<ProductTypeForm returnTo="/admin/products/types" />);

    const nameInput = screen.getByLabelText(/^Tên loại món/);
    fireEvent.change(nameInput, { target: { value: "Thức uống" } });

    const submitBtn = screen.getByRole("button", { name: "Tạo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Tên loại món đã có");
    });
  });

  it("displays network error on unexpected throw", async () => {
    (saveProductType as any).mockRejectedValue(new Error("network failure"));
    render(<ProductTypeForm returnTo="/admin/products/types" />);

    const nameInput = screen.getByLabelText(/^Tên loại món/);
    fireEvent.change(nameInput, { target: { value: "Thức uống" } });

    const submitBtn = screen.getByRole("button", { name: "Tạo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Không lưu được. Kiểm tra mạng rồi bấm lại.");
    });
  });
});
