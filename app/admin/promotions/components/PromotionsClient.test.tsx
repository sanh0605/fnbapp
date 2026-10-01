// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PromotionsClient from "./PromotionsClient";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";

const { replace, refresh, back, push, searchParams, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    push: pushFn,
    searchParams: new URLSearchParams("status=ACTIVE"),
    router: { replace: replaceFn, refresh: refreshFn, back: backFn, push: pushFn },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/promotions",
  useSearchParams: () => searchParams,
  useRouter: () => router,
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

const mockBrands: DBBrand[] = [
  { id: "BR-001", name: "Phin Đi", code: "PHD", start_date: "2026-01-01", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
];

function promo(id: string, name: string): DBPromotion {
  return {
    id,
    name,
    code: "PROMO",
    brand_id: "BR-001",
    type: "ORDER_DISCOUNT",
    discount_type: "PERCENT",
    discount_value: "10",
    min_order_value: "0",
    start_date: "2026-01-01T00:00:00.000Z",
    end_date: "2029-12-31T23:59:59.000Z",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
  };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
});

describe("PromotionsClient", () => {
  it("renders '+ Tạo Khuyến Mãi' as a link carrying the current returnTo URL", () => {
    render(
      <PromotionsClient
        promotions={[promo("PRM-001", "Giảm 10%")]}
        brands={mockBrands}
        products={[]}
        variants={[]}
        categories={[]}
        canDelete={false}
      />
    );
    const createLink = screen.getByRole("link", { name: "+ Tạo Khuyến Mãi" });
    expect(createLink).toHaveAttribute(
      "href",
      "/admin/promotions/new?returnTo=" + encodeURIComponent("/admin/promotions?status=ACTIVE")
    );
  });

  it("renders Sửa as a link to the edit page with returnTo", () => {
    render(
      <PromotionsClient
        promotions={[promo("PRM-001", "Giảm 10%")]}
        brands={mockBrands}
        products={[]}
        variants={[]}
        categories={[]}
        canDelete={false}
      />
    );
    const editLink = screen.getByRole("link", { name: "Sửa" });
    expect(editLink).toHaveAttribute(
      "href",
      "/admin/promotions/PRM-001/edit?returnTo=" + encodeURIComponent("/admin/promotions?status=ACTIVE")
    );
  });
});
