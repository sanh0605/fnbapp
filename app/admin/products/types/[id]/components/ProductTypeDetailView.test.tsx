// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { ProductTypeDetailView } from "./ProductTypeDetailView";
import type { DBProductType } from "@/types/db";

const { push, refresh, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    push: pushFn,
    refresh: refreshFn,
    router: { push: pushFn, refresh: refreshFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/products/types/PT-001",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/products/types/actions", () => ({
  deleteProductType: vi.fn(),
}));

import { deleteProductType } from "@/app/admin/products/types/actions";

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

describe("ProductTypeDetailView", () => {
  it("renders name, Tính là ly, groups using it, and 'Chỉnh sửa' link", () => {
    render(
      <ProductTypeDetailView
        type={sampleType}
        categoryNames={["Cà phê", "Trà"]}
        canDelete={false}
        returnTo="/admin/products/types"
      />
    );

    // The name is the page title (not duplicated in FieldList).
    expect(screen.getByRole("heading", { level: 1, name: "Thức uống" })).toBeInTheDocument();
    expect(screen.getAllByText("Thức uống")).toHaveLength(1);
    expect(screen.getByText("Có")).toBeInTheDocument();
    expect(screen.getByText("Nhóm món (2)")).toBeInTheDocument();
    expect(screen.getAllByText("Cà phê").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Trà").length).toBeGreaterThan(0);

    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink).toBeInTheDocument();
    expect(editLink.getAttribute("href")).toContain("/admin/products/types/PT-001/edit?returnTo=");

    // Non-owner: no Xoá button
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });

  it("shows 'Chưa có nhóm nào dùng loại món này.' when no category uses this type", () => {
    render(
      <ProductTypeDetailView
        type={{ ...sampleType, id: "PT-003", name: "Topping", is_drink: false }}
        categoryNames={[]}
        canDelete={true}
        returnTo="/admin/products/types"
      />
    );

    expect(screen.getByText("Chưa có nhóm nào dùng loại món này.")).toBeInTheDocument();
  });

  it("owner role sees 'Xoá' button and clicking it prompts inline confirmation without modal/popup", () => {
    render(
      <ProductTypeDetailView
        type={sampleType}
        categoryNames={[]}
        canDelete={true}
        returnTo="/admin/products/types"
      />
    );

    const deleteBtn = screen.getByRole("button", { name: "Xoá" });
    expect(deleteBtn).toBeInTheDocument();

    // No modal dialog
    expect(screen.queryByRole("dialog")).toBeNull();

    // Click Xoá
    fireEvent.click(deleteBtn);

    // Shows inline question "Xoá loại món này?" with "Xoá" and "Bỏ"
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Xoá loại món này?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();

    // Clicking Bỏ cancels confirmation
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(screen.queryByText("Xoá loại món này?")).toBeNull();
  });

  it("calls deleteProductType on confirmed deletion, displays Vietnamese error message in role=alert box on refusal", async () => {
    (deleteProductType as any).mockResolvedValue({
      error: "Loại món đang được dùng ở nhóm: Cà phê, Trà.",
    });

    render(
      <ProductTypeDetailView
        type={sampleType}
        categoryNames={["Cà phê", "Trà"]}
        canDelete={true}
        returnTo="/admin/products/types"
      />
    );

    // Click initial Xoá
    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));

    // Click confirm Xoá
    const confirmDeleteBtn = screen.getAllByRole("button", { name: "Xoá" })[0];
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteProductType).toHaveBeenCalled();
    });

    // Alert box shows refusal message
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Loại món đang được dùng ở nhóm: Cà phê, Trà.");
    });
  });

  it("navigates back to returnTo on successful deletion", async () => {
    (deleteProductType as any).mockResolvedValue({ success: true });

    render(
      <ProductTypeDetailView
        type={{ ...sampleType, id: "PT-003", name: "Topping" }}
        categoryNames={[]}
        canDelete={true}
        returnTo="/admin/products/types"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Xoá" })[0]);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/admin/products/types");
    });
  });

  it("renders category list on phone as a divide-y list of PhoneRow with px-4 py-2.5 and text-base title", () => {
    render(
      <ProductTypeDetailView
        type={sampleType}
        categoryNames={["Cà phê", "Trà"]}
        canDelete={false}
        returnTo="/admin/products/types"
      />
    );

    const mobileList = document.querySelector(".md\\:hidden") as HTMLElement;
    expect(mobileList).toBeInTheDocument();
    expect(mobileList.className).toContain("divide-y");

    const firstRow = mobileList.firstElementChild as HTMLElement;
    expect(firstRow.className).toContain("px-4");
    expect(firstRow.className).toContain("py-2.5");
    expect(firstRow.className).not.toContain("p-4");

    // Title is rendered via PhoneRow (text-base)
    const titleEl = within(firstRow).getByText("Cà phê");
    expect(titleEl.className).toContain("text-base");
  });
});
