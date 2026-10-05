// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import ProductsClient from "./ProductsClient";

const { replace, refresh, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, push: pushFn },
  };
});

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/products",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./actions", () => ({
  pauseProduct: vi.fn(),
  resumeProduct: vi.fn(),
  eraseProduct: vi.fn(),
}));

vi.mock("@/app/admin/products/actions", () => ({
  pauseProduct: vi.fn(),
  resumeProduct: vi.fn(),
  eraseProduct: vi.fn(),
}));

const sampleProducts = [
  {
    id: "PROD-001",
    name: "Cà phê đen",
    category_id: "CAT-001",
    status: "ACTIVE",
    variants: [
      { id: "VAR-001", size_name: "360ml", price: 20000, status: "ACTIVE" },
      { id: "VAR-002", size_name: "500ml", price: 25000, status: "ACTIVE" },
    ],
    priceHistory: [],
    neverSold: true,
    hasNoSellableVariant: false,
  },
  {
    id: "PROD-002",
    name: "Cà phê sữa cũ",
    category_id: "CAT-001",
    status: "INACTIVE",
    variants: [
      { id: "VAR-003", size_name: "360ml", price: 22000, status: "ACTIVE" },
    ],
    priceHistory: [],
    neverSold: false,
    hasNoSellableVariant: false,
  },
  {
    id: "PROD-005",
    name: "Matcha latte",
    category_id: "CAT-002",
    status: "ACTIVE",
    variants: [
      { id: "VAR-005", size_name: "360ml", price: 20000, status: "ACTIVE" },
      { id: "VAR-006", size_name: "500ml", price: 23000, status: "ACTIVE" },
      { id: "VAR-007", size_name: "700ml", price: 27000, status: "ACTIVE" },
    ],
    priceHistory: [],
    neverSold: false,
    hasNoSellableVariant: false,
  },
];

const sampleCategories = [
  { id: "CAT-001", name: "Cà phê" },
  { id: "CAT-002", name: "Giải trí" },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductsClient", () => {
  it("renders no Sửa, Lịch sử, Bán lại, or Xoá vĩnh viễn links/buttons", () => {
    mockSearchParams = new URLSearchParams();
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
      />,
    );

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Lịch sử" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bán lại" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xoá vĩnh viễn" })).toBeNull();
    expect(screen.queryByText("Sửa")).toBeNull();
    expect(screen.queryByText("Lịch sử")).toBeNull();
    expect(screen.queryByText("Bán lại")).toBeNull();
    expect(screen.queryByText("Xoá vĩnh viễn")).toBeNull();

    const links = screen.getAllByRole("link");
    expect(links.every((l) => !l.getAttribute("href")?.includes("/edit"))).toBe(true);
  });

  it("renders row link for PROD-005 starting with /admin/products/PROD-005?returnTo=", () => {
    mockSearchParams = new URLSearchParams();
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
      />,
    );

    const prodLinks = screen.getAllByRole("link", { name: /Matcha latte/ });
    expect(prodLinks.length).toBeGreaterThan(0);
    expect(
      prodLinks.some((l) =>
        l.getAttribute("href")?.startsWith("/admin/products/PROD-005?returnTo="),
      ),
    ).toBe(true);
  });

  it("renders bin labelled 'Ngừng bán' with status ACTIVE, and hides it with status=INACTIVE", () => {
    mockSearchParams = new URLSearchParams();
    const { unmount } = render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
      />,
    );

    const bins = screen.getAllByRole("button", { name: /^Ngừng bán/ });
    expect(bins.length).toBeGreaterThan(0);

    unmount();

    mockSearchParams = new URLSearchParams("status=INACTIVE");
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
        initialStatus="INACTIVE"
      />,
    );

    expect(screen.queryByRole("button", { name: /^Ngừng bán/ })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("finds product when searching by code PROD-005", () => {
    mockSearchParams = new URLSearchParams();
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
      />,
    );

    const searchInput = screen.getByLabelText("Tìm món");
    fireEvent.change(searchInput, { target: { value: "PROD-005" } });

    expect(screen.getAllByText("Matcha latte").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cà phê đen")).toBeNull();
  });

  it("defaults order to newest code first", () => {
    mockSearchParams = new URLSearchParams();
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
      />,
    );

    const codeElements = screen.getAllByText(/PROD-00[15]/);
    const codes = codeElements.map((el) => el.textContent?.trim()).filter(Boolean);
    const uniqueCodes = Array.from(new Set(codes));
    expect(uniqueCodes[0]).toBe("PROD-005");
    expect(uniqueCodes[1]).toBe("PROD-001");
  });

  it("shows size and price text such as '360ml 20.000'", () => {
    mockSearchParams = new URLSearchParams();
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
      />,
    );

    expect(screen.getAllByText(/360ml 20\.000/).length).toBeGreaterThan(0);
  });

  it("shows other-status empty state when search finds match in another status", () => {
    mockSearchParams = new URLSearchParams();
    render(
      <ProductsClient
        enhancedProducts={sampleProducts}
        activeCategories={sampleCategories}
      />,
    );

    const searchInput = screen.getByLabelText("Tìm món");
    fireEvent.change(searchInput, { target: { value: "Cà phê sữa cũ" } });

    expect(
      screen.getByText(/Có món khớp nhưng đang ở trạng thái “Ngừng bán”\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Xem “Ngừng bán”/ }),
    ).toBeInTheDocument();
  });
});
