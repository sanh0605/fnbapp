import { describe, it, expect, vi, beforeEach } from "vitest";
import ProductDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { mockProducts, mockCategories, resolveActorMock } = vi.hoisted(() => ({ resolveActorMock: vi.fn(), mockProducts: [
  {
    id: "PROD-005",
    name: "Matcha latte",
    category_id: "CAT-002",
    status: "ACTIVE",
    variants: [],
    priceHistory: [],
    neverSold: false,
    hasNoSellableVariant: false,
    isLinkedTopping: false,
  },
  {
    id: "PROD-099",
    name: "Món đã xoá",
    category_id: "CAT-001",
    status: "DELETED",
    variants: [],
    priceHistory: [],
    neverSold: true,
    hasNoSellableVariant: false,
    isLinkedTopping: false,
  },
],
mockCategories: [
  { id: "CAT-001", name: "Cà phê" },
  { id: "CAT-002", name: "Giải trí" },
] }));

vi.mock("@/app/admin/products/load-product-rows", () => ({
  loadProductRows: vi.fn().mockResolvedValue({
    enhancedProducts: mockProducts,
    activeCategories: mockCategories,
    canDelete: true,
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: resolveActorMock,
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockResolvedValue([]),
}));

describe("ProductDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActorMock.mockResolvedValue({ ok: true, actor: { role: "ADMIN" } });
  });

  it("calls notFound when product id is unknown", async () => {
    await expect(
      ProductDetailPage({ params: { id: "UNKNOWN-ID" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("renders a DELETED product without calling notFound", async () => {
    const element = await ProductDetailPage({
      params: { id: "PROD-099" },
      searchParams: {},
    });
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(element).toBeDefined();
    expect(element.props.product.id).toBe("PROD-099");
    expect(element.props.product.status).toBe("DELETED");
  });

  it("does not pass function props to Client Component", async () => {
    const element = await ProductDetailPage({
      params: { id: "PROD-005" },
      searchParams: { returnTo: "/admin/products?q=matcha" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });

  // BR-ACCESS-003: "Xoá vĩnh viễn" is offered to ADMIN only; the list no
  // longer offers it, so the detail page is where canDelete is computed.
  it("passes canDelete true for ADMIN and false for MANAGER", async () => {
    const asAdmin: any = await ProductDetailPage({ params: { id: "PROD-099" }, searchParams: {} });
    expect(asAdmin.props.canDelete).toBe(true);

    resolveActorMock.mockResolvedValue({ ok: true, actor: { role: "MANAGER" } });
    const asManager: any = await ProductDetailPage({ params: { id: "PROD-099" }, searchParams: {} });
    expect(asManager.props.canDelete).toBe(false);
  });
});
