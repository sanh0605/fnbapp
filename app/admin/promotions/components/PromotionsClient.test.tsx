// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
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
    const { container } = render(
      <PromotionsClient
        promotions={[samplePromotions[1]]}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={true}
      />,
    );

    expect(screen.getAllByText("Giảm 10,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Uchako").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đã hết hạn").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/15\/07\/2026 12:59:00/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("2 món,").some((el) => el.parentElement?.textContent === "2 món, 3 size"),
    ).toBe(true);

    const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
    expect(within(phone).getByText("202607 - GIẢM 10K")).toBeInTheDocument();
    expect(within(phone).getByText("Giảm 10,000đ")).toBeInTheDocument();
    expect(
      within(phone).getByText("Đến 15/07/2026 12:59:00").parentElement?.textContent,
    ).toBe("Đến 15/07/2026 12:59:00 · 2 món, 3 size · Uchako");
    expect(within(phone).getByText("2 món, 3 size")).toHaveClass("whitespace-nowrap");
    expect(within(phone).getByText("Đã hết hạn")).toBeInTheDocument();
    expect(within(phone).queryByText("PRM-004")).toBeNull();
  });

  it("shows a day-only start_date as 00:00:00 (BR-DATA-006)", () => {
    const promoWithPlainDate: DBPromotion = {
      ...samplePromotions[0],
      start_date: "2026-06-01",
    };
    render(
      <PromotionsClient
        promotions={[promoWithPlainDate]}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={false}
      />,
    );
    expect(screen.getByText("01/06/2026 00:00:00")).toBeInTheDocument();
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
    expect(within(screen.getByRole("table")).getByText("Toàn đơn")).toHaveClass("whitespace-nowrap");
  });

  it("create link reads 'Tạo' and points to /admin/promotions/new", () => {
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

    const createLink = screen.getByRole("link", { name: "Tạo" });
    expect(createLink).toBeInTheDocument();
    expect(createLink.getAttribute("href")).toContain("/admin/promotions/new?returnTo=");
  });

  it("shows 'không hết hạn' on phone meta when end_date is empty", () => {
    const promoWithoutDates: DBPromotion = {
      ...samplePromotions[0],
      start_date: "",
      end_date: "",
    };
    const { container } = render(
      <PromotionsClient
        promotions={[promoWithoutDates]}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={false}
      />,
    );
    const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
    expect(
      within(phone).getByText("Không hết hạn").parentElement?.textContent,
    ).toBe("Không hết hạn · Toàn đơn · Toàn hệ thống");
    expect(within(phone).queryByText(/→/)).toBeNull();
  });

  it("shows '→ Không hết hạn' in table cell when end_date is empty", () => {
    const promoWithoutEndDate: DBPromotion = {
      ...samplePromotions[0],
      end_date: "",
    };
    render(
      <PromotionsClient
        promotions={[promoWithoutEndDate]}
        brands={sampleBrands}
        products={[]}
        variants={sampleVariants}
        categories={[]}
        canDelete={false}
      />,
    );

    const table = screen.getByRole("table");
    const cell = within(table)
      .getAllByRole("cell")
      .find((td) => td.textContent?.includes("→ Không hết hạn"));
    expect(cell).toBeDefined();
    expect(within(table).getByText("→ Không hết hạn")).toBeInTheDocument();
  });

  it("renders Thời gian column header (no Bắt đầu or Kết thúc headers) and shows start and end in the same cell", () => {
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

    expect(screen.getByRole("columnheader", { name: "Thời gian" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Bắt đầu" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Kết thúc" })).toBeNull();

    const table = screen.getByRole("table");
    const cell = within(table)
      .getAllByRole("cell")
      .find(
        (td) =>
          td.textContent?.includes("01/07/2026 00:00:00") &&
          td.textContent?.includes("→ 15/07/2026 12:59:00"),
      );
    expect(cell).toBeDefined();
    // Each date-time stays on one line: two lines in the cell, not four.
    expect(cell!.querySelector(".tabular-nums")).toHaveClass("whitespace-nowrap");
  });
});
