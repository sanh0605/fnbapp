// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import OutletsClient from "./OutletsClient";
import type { DBOutlet, DBBrand } from "@/types/db";

const { replace, refresh, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    router: { replace: replaceFn, refresh: refreshFn },
  };
});

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/outlets",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
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
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleBrands: DBBrand[] = [
  { id: "BR-001", name: "Phin Đi", code: "PHD", status: "ACTIVE", start_date: "", created_at: "" },
  { id: "BR-002", name: "Uchako", code: "UCK", status: "ACTIVE", start_date: "", created_at: "" },
];

const sampleOutlets: DBOutlet[] = [
  {
    id: "OUT-001",
    code: "001",
    name: "Điểm bán 1",
    brand_id: "BR-001",
    address: "123 Đường A",
    status: "ACTIVE",
    start_date: "2026-03-27",
    end_date: null,
    open_time: "07:00:00",
    close_time: "22:00:00",
    created_at: "",
    updated_at: "",
  },
  {
    id: "OUT-002",
    code: "002",
    name: "Điểm bán 2",
    brand_id: "BR-002",
    address: "456 Đường B",
    status: "INACTIVE",
    start_date: "2026-06-01",
    end_date: "2026-08-01",
    open_time: null,
    close_time: null,
    created_at: "",
    updated_at: "",
  },
];

describe("OutletsClient", () => {
  it("renders no 'Sửa' or '/edit' link", () => {
    render(
      <OutletsClient
        outlets={sampleOutlets}
        brands={sampleBrands}
      />,
    );

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("renders row link for OUT-001 starting with /admin/outlets/OUT-001?returnTo=", () => {
    render(
      <OutletsClient
        outlets={sampleOutlets}
        brands={sampleBrands}
      />,
    );

    const allLinks = screen.getAllByRole("link");
    const out1Links = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/outlets/OUT-001?returnTo="),
    );
    expect(out1Links.length).toBeGreaterThan(0);
  });

  it("renders bin labelled 'Ngừng hoạt động' when status is ACTIVE", () => {
    render(
      <OutletsClient
        outlets={sampleOutlets}
        brands={sampleBrands}
      />,
    );

    const binButtons = screen.getAllByRole("button", { name: /^Ngừng hoạt động/i });
    expect(binButtons.length).toBeGreaterThan(0);
  });

  it("hides bin when status=INACTIVE in URL", () => {
    mockSearchParams = new URLSearchParams("status=INACTIVE");
    render(
      <OutletsClient
        outlets={sampleOutlets}
        brands={sampleBrands}
        initialStatus="INACTIVE"
      />,
    );

    expect(screen.queryByRole("button", { name: /^Ngừng hoạt động/i })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("'Tất cả' shows both active and inactive statuses", () => {
    mockSearchParams = new URLSearchParams("status=ALL");
    render(
      <OutletsClient
        outlets={sampleOutlets}
        brands={sampleBrands}
        initialStatus="ALL"
      />,
    );

    expect(screen.getAllByText("Điểm bán 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Điểm bán 2").length).toBeGreaterThan(0);
  });

  it("renders in default order newest code first", () => {
    render(
      <OutletsClient
        outlets={sampleOutlets}
        brands={sampleBrands}
        initialStatus="ALL"
      />,
    );

    const codes = screen.getAllByText(/^OUT-00[12]$/);
    expect(codes[0].textContent).toBe("OUT-002");
    expect(codes[1].textContent).toBe("OUT-001");
  });

  it("displays formatted hours or 'Chưa đặt'", () => {
    render(
      <OutletsClient
        outlets={sampleOutlets}
        brands={sampleBrands}
        initialStatus="ALL"
      />,
    );

    expect(screen.getAllByText("07:00 - 22:00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chưa đặt").length).toBeGreaterThan(0);
  });
});
