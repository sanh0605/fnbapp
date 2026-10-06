// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import BrandsClient from "./BrandsClient";
import type { DBBrand } from "@/types/db";

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
  usePathname: () => "/admin/brands",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
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
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleBrands: DBBrand[] = [
  {
    id: "BR-001",
    name: "Phin Đi",
    code: "PHD",
    start_date: "2026-03-27",
    status: "ACTIVE",
    created_at: "",
  },
  {
    id: "BR-002",
    name: "Uchako",
    code: "UCK",
    start_date: "2026-06-01",
    status: "ACTIVE",
    created_at: "",
  },
];

describe("BrandsClient", () => {
  it("renders no 'Sửa' or '/edit' link", () => {
    render(
      <BrandsClient
        brands={sampleBrands}
        canDelete={true}
      />,
    );

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("renders row link for BR-001 starting with /admin/brands/BR-001?returnTo=", () => {
    render(
      <BrandsClient
        brands={sampleBrands}
        canDelete={true}
      />,
    );

    const allLinks = screen.getAllByRole("link");
    const br1Links = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/brands/BR-001?returnTo="),
    );
    expect(br1Links.length).toBeGreaterThan(0);
  });

  it("renders bin when canDelete is true, and hides bin when canDelete is false", () => {
    const { unmount } = render(
      <BrandsClient
        brands={sampleBrands}
        canDelete={true}
      />,
    );

    const binButtons = screen.getAllByRole("button", { name: /^Xoá/i });
    expect(binButtons.length).toBeGreaterThan(0);

    unmount();

    render(
      <BrandsClient
        brands={sampleBrands}
        canDelete={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Xoá/i })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("renders in default order newest code first", () => {
    render(
      <BrandsClient
        brands={sampleBrands}
        canDelete={true}
      />,
    );

    const codes = screen.getAllByText(/^BR-00[12]$/);
    expect(codes[0].textContent).toBe("BR-002");
    expect(codes[1].textContent).toBe("BR-001");
  });

  it("shows name, code and formatted start date", () => {
    render(
      <BrandsClient
        brands={sampleBrands}
        canDelete={true}
      />,
    );

    expect(screen.getAllByText("Phin Đi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PHD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("27/03/2026").length).toBeGreaterThan(0);
  });

  it("create link reads 'Tạo' and points to /admin/brands/new", () => {
    render(
      <BrandsClient
        brands={sampleBrands}
        canDelete={true}
      />,
    );

    const createLink = screen.getByRole("link", { name: "Tạo" });
    expect(createLink).toBeInTheDocument();
    expect(createLink.getAttribute("href")).toContain("/admin/brands/new?returnTo=");
  });
});
