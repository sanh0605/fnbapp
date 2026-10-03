import { describe, it, expect, vi, beforeEach } from "vitest";
import PromotionDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { mockPromotions, mockBrands, mockProducts, mockVariants } = vi.hoisted(() => {
  const mockPromotions = [
    {
      id: "PRM-004",
      name: "202607 - GIẢM 10K",
      code: "GIAM10K",
      brand_id: "BR-002",
      type: "PRODUCT_DISCOUNT",
      discount_type: "FLAT_VND",
      discount_value: 10000,
      min_order_value: 0,
      start_date: "2026-07-01T00:00:00+07:00",
      end_date: "2026-07-15T05:59:00+00:00",
      applicable_products_json: '{"VAR-020":10000}',
      status: "ACTIVE",
    },
  ];

  const mockBrands = [
    { id: "BR-002", name: "Uchako" },
  ];

  const mockProducts = [
    { id: "PROD-001", name: "Trà đào" },
  ];

  const mockVariants = [
    { id: "VAR-020", product_id: "PROD-001", size_name: "Size M" },
  ];
  return { mockPromotions, mockBrands, mockProducts, mockVariants };
});

vi.mock("@/app/admin/promotions/actions", () => ({
  getPromotionsData: vi.fn().mockResolvedValue({
    promotions: mockPromotions,
    brands: mockBrands,
    products: mockProducts,
    variants: mockVariants,
    categories: [],
  }),
  deletePromotionAction: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "USR-001", role: "ADMIN" },
  }),
}));

describe("PromotionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when promotion id is unknown", async () => {
    await expect(
      PromotionDetailPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await PromotionDetailPage({
      params: { id: "PRM-004" },
      searchParams: { returnTo: "/admin/promotions" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
