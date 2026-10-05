// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { BrandDetailView, type BrandOutletItem } from "./BrandDetailView";
import type { DBBrand } from "@/types/db";

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

vi.mock("@/app/admin/brands/actions", () => ({
  deleteBrand: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const sampleBrand: DBBrand = {
  id: "BR-001",
  name: "Phin Đi",
  code: "PHD",
  start_date: "2026-03-27",
  status: "ACTIVE",
  created_at: "",
};

const sampleOutlets: BrandOutletItem[] = [
  { id: "OUT-001", name: "Điểm bán 1" },
];

describe("BrandDetailView", () => {
  it("renders fields and outlet links properly", () => {
    render(
      <BrandDetailView
        brand={sampleBrand}
        outlets={sampleOutlets}
        canDelete={true}
        returnTo="/admin/brands"
      />,
    );

    expect(screen.getAllByText("BR-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phin Đi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PHD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("27/03/2026").length).toBeGreaterThan(0);

    const outletLink = screen.getByRole("link", { name: "Điểm bán 1" });
    expect(outletLink).toHaveAttribute("href", "/admin/outlets/OUT-001");
  });

  it("shows '—' when no outlets use the brand", () => {
    render(
      <BrandDetailView
        brand={sampleBrand}
        outlets={[]}
        canDelete={true}
        returnTo="/admin/brands"
      />,
    );

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows Xoá button only when canDelete is true", () => {
    const { unmount } = render(
      <BrandDetailView
        brand={sampleBrand}
        outlets={sampleOutlets}
        canDelete={true}
        returnTo="/admin/brands"
      />,
    );

    expect(screen.getByRole("button", { name: /^Xoá/i })).toBeInTheDocument();

    unmount();

    render(
      <BrandDetailView
        brand={sampleBrand}
        outlets={sampleOutlets}
        canDelete={false}
        returnTo="/admin/brands"
      />,
    );

    expect(screen.queryByRole("button", { name: /^Xoá/i })).toBeNull();
  });
});
