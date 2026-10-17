// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { ProductCategoryForm } from "./ProductCategoryForm";
import type { DBProductCategory } from "@/types/db";

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

vi.mock("@/app/admin/products/categories/actions", () => ({
  saveCategory: vi.fn(),
  updateCategory: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleCategory: DBProductCategory = {
  id: "CAT-001",
  name: "Cà phê",
  status: "ACTIVE",
  type_id: "PT-001",
};

const TYPES = [
  { id: "PT-001", name: "Thức uống", is_drink: true, created_at: "2026-10-14T09:00:00Z" },
  { id: "PT-002", name: "Thức ăn", is_drink: false, created_at: "2026-10-14T09:00:00Z" },
];

describe("ProductCategoryForm", () => {
  it("renders the category name field on the page directly, not in a dialog", () => {
    render(<ProductCategoryForm types={TYPES} returnTo="/admin/products/categories" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText(/Tên nhóm món/)).toBeInTheDocument();
  });

  it("pre-fills category name when editing", () => {
    render(
      <ProductCategoryForm
        initialData={sampleCategory}
        types={TYPES}
        returnTo="/admin/products/categories"
      />
    );
    expect(screen.getByLabelText(/Tên nhóm món/)).toHaveValue("Cà phê");
  });

  it("'Bỏ' navigates to returnTo without submitting", () => {
    render(
      <ProductCategoryForm
        types={TYPES}
        returnTo="/admin/products/categories?q=tra"
      />
    );
    const cancelButton = screen.getByRole("button", { name: "Bỏ" });
    fireEvent.click(cancelButton);
    expect(push).toHaveBeenCalledWith("/admin/products/categories?q=tra");
  });

  it("shows FormActionBar with 'Tạo' and 'Bỏ' on create mode", () => {
    render(<ProductCategoryForm types={TYPES} returnTo="/admin/products/categories" />);
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("shows FormActionBar with 'Lưu thay đổi' and 'Bỏ thay đổi' on edit mode", () => {
    render(
      <ProductCategoryForm
        initialData={sampleCategory}
        types={TYPES}
        returnTo="/admin/products/categories"
      />
    );
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    const cancelButton = screen.getByRole("button", { name: "Bỏ thay đổi" });
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton);
    expect(push).toHaveBeenCalledWith("/admin/products/categories");
  });
});

// Plan 2026-10-14-tong-quan-moi Task 6: every dish group picks a Loại món.
describe("ProductCategoryForm product type", () => {
  const TYPES = [
    { id: "PT-001", name: "Thức uống", is_drink: true, created_at: "2026-10-14T09:00:00Z" },
    { id: "PT-002", name: "Thức ăn", is_drink: false, created_at: "2026-10-14T09:00:00Z" },
  ];

  it("asks for a Loại món, required, listing every type by name", () => {
    render(<ProductCategoryForm types={TYPES} />);
    const select = screen.getByLabelText(/^Loại món/) as HTMLSelectElement;
    expect(select.getAttribute("name")).toBe("type_id");
    expect(select.required).toBe(true);
    const labels = [...select.options].map(o => o.textContent);
    expect(labels).toEqual(["Chọn loại món", "Thức uống", "Thức ăn"]);
    expect(select.value).toBe("");
  });

  it("the edit form starts on the group's own type", () => {
    render(<ProductCategoryForm types={TYPES} initialData={{ ...sampleCategory, type_id: "PT-002" }} />);
    expect((screen.getByLabelText(/^Loại món/) as HTMLSelectElement).value).toBe("PT-002");
  });

  it("renders the optional Biểu tượng box with maxLength 8 and placeholder", () => {
    render(<ProductCategoryForm types={TYPES} />);
    const iconInput = screen.getByLabelText("Biểu tượng") as HTMLInputElement;
    expect(iconInput).toBeInTheDocument();
    expect(iconInput.name).toBe("icon");
    expect(iconInput.placeholder).toBe("Ví dụ: ☕");
    expect(iconInput.maxLength).toBe(8);
    expect(iconInput.value).toBe("");
  });

  it("pre-fills Biểu tượng when editing", () => {
    render(<ProductCategoryForm types={TYPES} initialData={{ ...sampleCategory, icon: "☕" }} />);
    const iconInput = screen.getByLabelText("Biểu tượng") as HTMLInputElement;
    expect(iconInput.value).toBe("☕");
  });
});

