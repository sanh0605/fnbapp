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
};

describe("ProductCategoryForm", () => {
  it("renders the category name field on the page directly, not in a dialog", () => {
    render(<ProductCategoryForm returnTo="/admin/products/categories" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Tên Danh Mục")).toBeInTheDocument();
  });

  it("pre-fills category name when editing", () => {
    render(
      <ProductCategoryForm
        initialData={sampleCategory}
        returnTo="/admin/products/categories"
      />
    );
    expect(screen.getByLabelText("Tên Danh Mục")).toHaveValue("Cà phê");
  });

  it("'Bỏ' navigates to returnTo without submitting", () => {
    render(
      <ProductCategoryForm
        returnTo="/admin/products/categories?q=tra"
      />
    );
    const cancelButton = screen.getByRole("button", { name: "Bỏ" });
    fireEvent.click(cancelButton);
    expect(push).toHaveBeenCalledWith("/admin/products/categories?q=tra");
  });
});
