// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { OutletDetailView } from "./OutletDetailView";
import type { DBOutlet } from "@/types/db";

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

vi.mock("@/app/admin/outlets/actions", () => ({
  retireOutlet: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const sampleOutlet: DBOutlet = {
  id: "OUT-001",
  code: "001",
  name: "Điểm bán 1",
  brand_id: "BR-001",
  address: "123 Đường ABC",
  status: "ACTIVE",
  start_date: "2026-03-27",
  end_date: null,
  open_time: "07:00:00",
  close_time: "22:00:00",
  created_at: "",
  updated_at: "",
};

describe("OutletDetailView", () => {
  it("renders fields properly", () => {
    render(
      <OutletDetailView
        outlet={sampleOutlet}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    expect(screen.getAllByText("OUT-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Điểm bán 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phin Đi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("123 Đường ABC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("07:00 - 22:00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("27/03/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang hoạt động").length).toBeGreaterThan(0);
  });

  it("shows Ngừng hoạt động button when ACTIVE", () => {
    render(
      <OutletDetailView
        outlet={sampleOutlet}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Ngừng hoạt động" }),
    ).toBeInTheDocument();
  });

  it("hides Ngừng hoạt động button when INACTIVE and shows badge", () => {
    render(
      <OutletDetailView
        outlet={{ ...sampleOutlet, status: "INACTIVE" }}
        brandName="Phin Đi"
        returnTo="/admin/outlets"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Ngừng hoạt động" }),
    ).toBeNull();
    expect(screen.getAllByText("Ngừng hoạt động").length).toBeGreaterThan(0);
  });
});
