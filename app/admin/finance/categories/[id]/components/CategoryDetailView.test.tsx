// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { CategoryDetailView } from "./CategoryDetailView";
import type { DBCashCategory } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/finance/categories/actions", () => ({
  setCashCategoryStatus: vi.fn(),
  deleteCashCategory: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const sampleCategory = {
  id: "CFC-001",
  name: "Vận hành",
  kind: "EXPENSE",
  affects_pnl: true,
  is_sales_revenue: false,
  status: "ACTIVE",
} as unknown as DBCashCategory;

describe("CategoryDetailView", () => {
  it("renders fields properly", () => {
    render(
      <CategoryDetailView
        category={sampleCategory}
        returnTo="/admin/finance/categories"
        canDelete={false}
      />,
    );

    expect(screen.getAllByText("CFC-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vận hành").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Có").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);
  });

  it("shows Ngừng dùng button when status is ACTIVE", () => {
    render(
      <CategoryDetailView
        category={sampleCategory}
        returnTo="/admin/finance/categories"
        canDelete={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Ngừng dùng" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dùng lại" })).toBeNull();
  });

  it("shows Dùng lại button and Ngừng dùng badge when status is INACTIVE", () => {
    render(
      <CategoryDetailView
        category={{ ...sampleCategory, status: "INACTIVE" }}
        returnTo="/admin/finance/categories"
        canDelete={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Dùng lại" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ngừng dùng" })).toBeNull();
    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);
  });

  it("shows Xoá hẳn button only when canDelete is true", () => {
    const { unmount } = render(
      <CategoryDetailView
        category={sampleCategory}
        returnTo="/admin/finance/categories"
        canDelete={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Xoá hẳn" })).toBeNull();
    unmount();

    render(
      <CategoryDetailView
        category={sampleCategory}
        returnTo="/admin/finance/categories"
        canDelete={true}
      />,
    );
    expect(screen.getByRole("button", { name: "Xoá hẳn" })).toBeInTheDocument();
  });
});
