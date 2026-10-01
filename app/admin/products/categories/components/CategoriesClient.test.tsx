// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import CategoriesClient from "./CategoriesClient";
import type { DBProductCategory } from "@/types/db";

const { replace, refresh, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    router: { replace: replaceFn, refresh: refreshFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleCategories: DBProductCategory[] = [
  { id: "CAT-001", name: "Cà phê", status: "ACTIVE" },
  { id: "CAT-002", name: "Trà sữa", status: "ACTIVE" },
];

describe("CategoriesClient", () => {
  it("renders '+ Thêm Danh Mục' link pointing to new category page with returnTo", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={{ "CAT-001": 5, "CAT-002": 3 }}
        initialSearch="Cà"
      />
    );

    const addLink = screen.getByRole("link", { name: "+ Thêm Danh Mục" });
    expect(addLink).toHaveAttribute(
      "href",
      "/admin/products/categories/new?returnTo=" + encodeURIComponent("/admin/products/categories?q=C%C3%A0")
    );
  });

  it("renders 'Sửa' as a link pointing to the category's edit page", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={{ "CAT-001": 5, "CAT-002": 3 }}
        initialSearch=""
      />
    );

    const editLinks = screen.getAllByRole("link", { name: "Sửa" });
    expect(editLinks[0]).toHaveAttribute(
      "href",
      "/admin/products/categories/CAT-001/edit?returnTo=" + encodeURIComponent("/admin/products/categories")
    );
  });

  it("renders 'Xóa' button which opens confirm modal", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={{ "CAT-001": 5, "CAT-002": 3 }}
        initialSearch=""
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: "Xóa" });
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText(/Bạn có chắc chắn muốn xóa danh mục/i)).toBeInTheDocument();
  });

  it("typing in search field replaces URL with ?q= and scroll: false", () => {
    render(
      <CategoriesClient
        categories={sampleCategories}
        counts={{ "CAT-001": 5, "CAT-002": 3 }}
        initialSearch=""
      />
    );

    const searchInput = screen.getByPlaceholderText("Tên danh mục...");
    fireEvent.change(searchInput, { target: { value: "Trà" } });

    expect(replace).toHaveBeenLastCalledWith("/admin/products/categories?q=Tr%C3%A0", { scroll: false });
  });
});
