// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import {
  PromotionDetailView,
  type ApplicableProductItem,
} from "./PromotionDetailView";
import type { DBPromotion } from "@/types/db";

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

vi.mock("@/app/admin/promotions/actions", () => ({
  deletePromotionAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const samplePromo: DBPromotion = {
  id: "PRM-004",
  name: "202607 - GIẢM 10K",
  code: "GIAM10K",
  brand_id: "BR-002",
  type: "PRODUCT_DISCOUNT",
  discount_type: "FLAT_VND",
  discount_value: "10000",
  min_order_value: "50000",
  start_date: "2026-07-01T00:00:00+07:00",
  end_date: "2026-07-15T05:59:00+00:00",
  applicable_products_json: '{"VAR-020":10000,"VAR-021":10000}',
  status: "ACTIVE",
  created_at: "",
};

const sampleItems: ApplicableProductItem[] = [
  { variantId: "VAR-020", dishName: "Trà đào", sizeName: "Size M", appliedValue: "10,000đ" },
  { variantId: "VAR-021", dishName: "Trà đào", sizeName: "Size L", appliedValue: "10,000đ" },
];

describe("PromotionDetailView", () => {
  it("renders fields properly", () => {
    render(
      <PromotionDetailView
        promo={samplePromo}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={true}
        returnTo="/admin/promotions"
      />,
    );

    expect(screen.getAllByText("PRM-004").length).toBeGreaterThan(0);
    expect(screen.getAllByText("202607 - GIẢM 10K").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Uchako").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Giảm theo món").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Giảm 10,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("GIAM10K").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/15\/07\/2026 12:59:00/).length).toBeGreaterThan(0);
  });

  it("shows a day-only start_date as 00:00:00 (BR-DATA-006)", () => {
    render(
      <PromotionDetailView
        promo={{ ...samplePromo, start_date: "2026-07-01" }}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={false}
        returnTo="/admin/promotions"
      />,
    );
    expect(screen.getAllByText("01/07/2026 00:00:00").length).toBeGreaterThan(0);
  });

  it("renders 'Món áp dụng (N)' section for PRODUCT_DISCOUNT", () => {
    render(
      <PromotionDetailView
        promo={samplePromo}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={true}
        returnTo="/admin/promotions"
      />,
    );

    expect(screen.getByText("Món áp dụng (2)")).toBeInTheDocument();
    // Two sizes, each drawn in the desktop table and again as a phone card.
    expect(screen.getAllByText("Trà đào").length).toBe(4);
    expect(screen.getAllByText("Size M").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Size L").length).toBeGreaterThan(0);
  });

  it("draws the computer table's titles in a single header row (not a row inside a row)", () => {
    const { container } = render(
      <PromotionDetailView
        promo={samplePromo}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={true}
        returnTo="/admin/promotions"
      />,
    );

    expect(container.querySelectorAll("tr tr")).toHaveLength(0);
    const headRow = container.querySelector("thead > tr")!;
    expect([...headRow.children].map((c) => c.textContent)).toEqual(["Món", "Size", "Giá áp dụng"]);
  });

  it("shows Xoá button only when canDelete is true", () => {
    const { unmount } = render(
      <PromotionDetailView
        promo={samplePromo}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={true}
        returnTo="/admin/promotions"
      />,
    );

    expect(screen.getByRole("button", { name: /^Xoá/i })).toBeInTheDocument();

    unmount();

    render(
      <PromotionDetailView
        promo={samplePromo}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={false}
        returnTo="/admin/promotions"
      />,
    );

    expect(screen.queryByRole("button", { name: /^Xoá/i })).toBeNull();
  });

  it("shows 'Dùng chung với khuyến mãi khác' field (Có when stackable true, Không when false)", () => {
    const { unmount } = render(
      <PromotionDetailView
        promo={{ ...samplePromo, stackable: true }}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={false}
        returnTo="/admin/promotions"
      />,
    );

    expect(screen.getByText("Dùng chung với khuyến mãi khác")).toBeInTheDocument();
    expect(screen.getByText("Có")).toBeInTheDocument();

    unmount();

    render(
      <PromotionDetailView
        promo={{ ...samplePromo, stackable: false }}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={false}
        returnTo="/admin/promotions"
      />,
    );

    expect(screen.getByText("Dùng chung với khuyến mãi khác")).toBeInTheDocument();
    expect(screen.getByText("Không")).toBeInTheDocument();
  });

  it("renders applicable items on phone as a divide-y list of PhoneRow (title/value on line 1, meta on line 2)", () => {
    render(
      <PromotionDetailView
        promo={samplePromo}
        brandName="Uchako"
        applicableItems={sampleItems}
        canDelete={false}
        returnTo="/admin/promotions"
      />
    );

    const mobileList = document.querySelector(".md\\:hidden") as HTMLElement;
    expect(mobileList).toBeInTheDocument();
    expect(mobileList.className).toContain("divide-y");

    const firstRow = mobileList.firstElementChild as HTMLElement;
    expect(firstRow.className).toContain("px-4");
    expect(firstRow.className).toContain("py-2.5");
    expect(firstRow.className).not.toContain("p-4");

    // PhoneRow: line 1 has dishName (text-base) and appliedValue; line 2 has sizeName (text-sm)
    const titleEl = within(firstRow).getByText("Trà đào");
    expect(titleEl.className).toContain("text-base");
    expect(within(firstRow).getByText("10,000đ")).toBeInTheDocument();
    const metaEl = within(firstRow).getByText("Size M");
    expect(metaEl.className).toContain("text-sm");
    expect(metaEl.className).not.toContain("text-xs");
  });
});

