// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UnitDetailView } from "./UnitDetailView";
import type { DBUnit } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/units",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/inventory/actions", () => ({
  deleteUnit: vi.fn(),
}));

const unit: DBUnit = {
  id: "UNT-001",
  name: "Hộp",
  abbreviation: "",
  description: "Hộp giấy 1000ml",
  status: "ACTIVE",
  created_at: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("UnitDetailView", () => {
  it("renders unit details and links", () => {
    const returnTo = "/admin/inventory/units";
    render(
      <UnitDetailView
        unit={unit}
        returnTo={returnTo}
        canDelete={false}
      />,
    );

    // Header back link
    const backLink = screen.getByRole("link", { name: /Đơn vị tính/ });
    expect(backLink).toHaveAttribute("href", returnTo);

    // "Chỉnh sửa" link
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink).toHaveAttribute(
      "href",
      `/admin/inventory/units/UNT-001/edit?returnTo=${encodeURIComponent(returnTo)}`,
    );

    // canDelete=false hides "Xoá"
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();

    // Fields: Mã, Tên, Ghi chú
    expect(screen.getAllByText("UNT-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hộp").length).toBeGreaterThan(0);
    expect(screen.getByText("Hộp giấy 1000ml")).toBeInTheDocument();
  });

  it("renders delete button when canDelete is true", () => {
    render(
      <UnitDetailView
        unit={unit}
        returnTo="/admin/inventory/units"
        canDelete={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Xoá/ })).toBeInTheDocument();
  });

  it("shows '—' when description is empty", () => {
    const noDescUnit: DBUnit = {
      id: "UNT-002",
      name: "Bộ",
      abbreviation: "",
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
    };

    render(
      <UnitDetailView
        unit={noDescUnit}
        returnTo="/admin/inventory/units"
        canDelete={false}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
