// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import PromotionsClient from "./PromotionsClient";
import type { DBPromotion, DBBrand, DBProductVariant } from "@/types/db";

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
  usePathname: () => "/admin/promotions",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/promotions/actions", () => ({
  deletePromotionAction: vi.fn(),
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
    id: "BR-002",
    name: "Uchako",
    code: "UCK",
    status: "ACTIVE",
    start_date: "2026-06-01",
    created_at: "",
  },
];

const sampleVariants: DBProductVariant[] = [
  { id: "VAR-020", product_id: "PROD-001", size_name: "M", price: "20000", status: "ACTIVE" },
  { id: "VAR-021", product_id: "PROD-001", size_name: "L", price: "25000", status: "ACTIVE" },
  { id: "VAR-022", product_id: "PROD-002", size_name: "M", price: "30000", status: "ACTIVE" },
];

const samplePromotions: DBPromotion[] = [
  {
    id: "PRM-001",
    name: "Khuyến mãi cũ",
    code: "OLD",
    brand_id: "",
    type: "ORDER_DISCOUNT",
    discount_type: "PERCENT",
    discount_value: "10",
    min_order_value: "0",
    start_date: "2026-01-01T00:00:00+07:00",
    end_date: "2026-01-10T00:00:00+07:00",
    applicable_products_json: "",
    status: "ACTIVE",
    created_at: "",
  },
  {
    id: "PRM-004",
    name: "202607 - GIẢM 10K",
    code: "GIAM10K",
    brand_id: "BR-002",
    type: "PRODUCT_DISCOUNT",
    discount_type: "FLAT_VND",
    discount_value: "10000",
    min_order_value: "0",
    start_date: "2026-07-01T00:00:00+07:00",
    end_date: "2026-07-15T05:59:00+00:00",
    applicable_products_json: JSON.stringify({
      "VAR-020": 10000,
      "VAR-021": 10000,
      "VAR-022": 10000,
    }),
    status: "ACTIVE",
    created_at: "",
  },
];

describe("PromotionsClient", () => {
  it("renders no 'Sửa' or '/edit' link", () => {
    render(
      <PromotionsClient
        promotions={samplePromotions}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={true}
      />,
    );

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("renders row link for PRM-004 starting with /admin/promotions/PRM-004?returnTo=", () => {
    render(
      <PromotionsClient
        promotions={samplePromotions}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={true}
      />,
    );

    const allLinks = screen.getAllByRole("link");
    const prm4Links = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/promotions/PRM-004?returnTo="),
    );
    expect(prm4Links.length).toBeGreaterThan(0);
  });

  it("renders bin when canDelete is true, and hides bin when canDelete is false", () => {
    const { unmount } = render(
      <PromotionsClient
        promotions={samplePromotions}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={true}
      />,
    );

    const binButtons = screen.getAllByRole("button", { name: /^Xoá/i });
    expect(binButtons.length).toBeGreaterThan(0);

    unmount();

    render(
      <PromotionsClient
        promotions={samplePromotions}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Xoá/i })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("PRM-004 fixture shows expected fields", () => {
    render(
      <PromotionsClient
        promotions={[samplePromotions[1]]}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={true}
      />,
    );

    expect(screen.getAllByText("Giảm 10.000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Uchako").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đã hết hạn").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/15\/07\/2026 12:59/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 món, 3 size").length).toBeGreaterThan(0);
  });

  it("renders in default order newest code first", () => {
    render(
      <PromotionsClient
        promotions={samplePromotions}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={true}
      />,
    );

    const codes = screen.getAllByText(/^PRM-00[14]$/);
    expect(codes[0].textContent).toBe("PRM-004");
    expect(codes[1].textContent).toBe("PRM-001");
  });
});
